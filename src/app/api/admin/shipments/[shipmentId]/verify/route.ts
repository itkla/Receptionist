import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route"; // Adjust path as needed
import { prisma } from '@/lib/prisma';
import { ShipmentStatus } from '@prisma/client';
import { z } from 'zod';

interface RouteParams {
    params: {
        shipmentId: string;
    }
}

// Schema for the request body
const verifyShipmentSchema = z.object({
    verifiedDeviceIds: z.array(z.string().cuid2({ message: "Invalid Device ID format" })).min(1, { message: "At least one device must be verified." }),
});

// PUT /api/admin/shipments/[shipmentId]/verify
// Requires admin session. Updates shipment status to COMPLETED and marks devices as checked in.
export async function PUT(request: Request, { params }: RouteParams) {
    const session = await getServerSession(authOptions);
    // TODO: Add more robust role checking if necessary
    if (!session || !session.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { shipmentId } = params;
    if (!shipmentId) {
        return NextResponse.json({ error: 'Shipment ID is required' }, { status: 400 });
    }

    try {
        // 1. Validate Request Body
        const body = await request.json();
        const validationResult = verifyShipmentSchema.safeParse(body);

        if (!validationResult.success) {
            return NextResponse.json({ error: 'Invalid input', details: validationResult.error.flatten().fieldErrors }, { status: 400 });
        }

        const { verifiedDeviceIds } = validationResult.data;

        // 2. Fetch Shipment to check status and associated devices
        const shipment = await prisma.shipment.findUnique({
            where: { id: shipmentId },
            select: { status: true, devices: { select: { id: true } } } // Get status and device IDs
        });

        if (!shipment) {
            return NextResponse.json({ error: 'Shipment not found' }, { status: 404 });
        }

        // 3. Check Current Status - Should be RECEIVED
        if (shipment.status !== ShipmentStatus.RECEIVED) {
            return NextResponse.json(
                { error: `Shipment cannot be verified, status is ${shipment.status.toLowerCase()}, expected RECEIVED.` },
                { status: 409 } // Conflict
            );
        }

        // 4. Ensure verified IDs belong to this shipment (optional but good practice)
        const shipmentDeviceIds = new Set(shipment.devices.map(d => d.id));
        const invalidIds = verifiedDeviceIds.filter(id => !shipmentDeviceIds.has(id));
        if (invalidIds.length > 0) {
             return NextResponse.json(
                { error: `Invalid device IDs provided that do not belong to this shipment: ${invalidIds.join(", ")}` },
                { status: 400 }
            );
        }

        // 5. Perform updates in a transaction
        const transactionResult = await prisma.$transaction(async (tx) => {
            // Update Shipment status
            const updatedShipment = await tx.shipment.update({
                where: { id: shipmentId },
                data: {
                    status: ShipmentStatus.COMPLETED,
                },
                select: { id: true, status: true } // Select only needed fields
            });

            // Update Devices - set isCheckedIn and checkedInAt for verified devices
            const updateDeviceStatus = await tx.device.updateMany({
                where: {
                    shipmentId: shipmentId,
                    id: { in: verifiedDeviceIds }
                },
                data: {
                    isCheckedIn: true,
                    checkedInAt: new Date(),
                }
            });

             // Optional: Mark devices NOT in verifiedDeviceIds as NOT checked in (if needed)
             // const markUnverified = await tx.device.updateMany({
             //     where: {
             //         shipmentId: shipmentId,
             //         id: { notIn: verifiedDeviceIds }
             //     },
             //     data: {
             //         isCheckedIn: false,
             //         checkedInAt: null,
             //     }
             // });

            return { updatedShipment, updateDeviceStatus };
        });

        // 6. Return Success Response
        // Consider returning only a success message or the updated shipment status
        return NextResponse.json(
            { 
                message: `Shipment ${transactionResult.updatedShipment.id} marked as COMPLETED.`,
                verifiedDevicesCount: transactionResult.updateDeviceStatus.count
            },
            { status: 200 }
        );

    } catch (error: any) {
        console.error(`Error verifying shipment ${shipmentId}:`, error);
        if (error.code === 'P2023' || error.message.includes('Malformed UUID')) {
             return NextResponse.json({ error: 'Invalid Shipment ID format' }, { status: 400 });
        }
         if (error.code === 'P2025') { // Record not found during update
            return NextResponse.json({ error: 'Shipment or Device not found during update' }, { status: 404 });
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
} 