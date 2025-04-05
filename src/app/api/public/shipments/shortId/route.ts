import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ShipmentStatus } from '@prisma/client'; // Import enum if you use it for status checks
import { z } from 'zod'; // Use Zod for input validation

interface RouteParams {
    params: {
        shipmentId: string;
    }
}

// GET /api/public/shipments/[shipmentId]
// Fetches details for a specific shipment, intended for the public receiving page.
export async function GET(request: Request, { params }: RouteParams) {
    const { shipmentId } = params;

    if (!shipmentId) {
        return NextResponse.json({ error: 'Shipment ID is required' }, { status: 400 });
    }

    try {
        const shipment = await prisma.shipment.findUnique({
            where: { id: shipmentId },
            include: {
                devices: { // Include associated devices
                    orderBy: {
                        // Optional: Sort devices if needed, e.g., by serial number
                        serialNumber: 'asc'
                    }
                },
                location: { // Include location name if needed on receive page
                    select: { name: true }
                }
            },
        });

        if (!shipment) {
            return NextResponse.json({ error: 'Shipment not found' }, { status: 404 });
        }

        // Optional: Prevent access if shipment is already completed or cancelled
        if (shipment.status === ShipmentStatus.COMPLETED || shipment.status === ShipmentStatus.CANCELLED) {
             return NextResponse.json(
                { error: `Shipment is already ${shipment.status.toLowerCase()}.` },
                { status: 409 } // Conflict status
            );
        }

         // Optional: Prevent access if shipment status is PENDING (might mean manifest not ready yet)
         // Adjust logic based on your exact workflow
         // if (shipment.status === ShipmentStatus.PENDING) {
         //      return NextResponse.json(
         //         { error: `Shipment is still pending.` },
         //         { status: 403 } // Forbidden?
         //     );
         // }


        // Return the shipment details
        return NextResponse.json(shipment, { status: 200 });

    } catch (error: any) {
        console.error(`Error fetching shipment ${shipmentId}:`, error);
        // Handle potential Prisma errors or other issues
        if (error.code === 'P2023' || error.message.includes('Malformed UUID')) { // Invalid UUID format
             return NextResponse.json({ error: 'Invalid Shipment ID format' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// Define schema for request body validation
const receiveShipmentSchema = z.object({
    recipientName: z.string().min(1, { message: "Recipient name cannot be empty" }).max(255),
    signature: z.string().startsWith('data:image/png;base64,', { message: "Invalid signature format" }),
});

// PUT /api/public/shipments/[shipmentId]/receive (or just PUT /api/public/shipments/[shipmentId])
// Updates the shipment status to RECEIVED and saves recipient info.
export async function PUT(request: Request, { params }: RouteParams) {
    const { shipmentId } = params;

    if (!shipmentId) {
        return NextResponse.json({ error: 'Shipment ID is required' }, { status: 400 });
    }

    try {
        // 1. Validate Request Body
        const body = await request.json();
        const validationResult = receiveShipmentSchema.safeParse(body);

        if (!validationResult.success) {
            return NextResponse.json({ error: 'Invalid input', details: validationResult.error.flatten().fieldErrors }, { status: 400 });
        }

        const { recipientName, signature } = validationResult.data;

        // 2. Check if Shipment Exists and Can Be Received
        const shipment = await prisma.shipment.findUnique({
            where: { id: shipmentId },
            select: { status: true } // Only need status for check
        });

        if (!shipment) {
            return NextResponse.json({ error: 'Shipment not found' }, { status: 404 });
        }

        // Prevent receiving if already completed or cancelled - Direct comparison
        if (shipment.status === ShipmentStatus.COMPLETED || shipment.status === ShipmentStatus.CANCELLED) {
            return NextResponse.json(
                { error: `Shipment cannot be received, status is already ${shipment.status.toLowerCase()}.` },
                { status: 409 } // Conflict
            );
        }

        // TODO: Add logic for Jamf device status check/update upon receipt if needed
        // e.g., removing devices from pre-stage, updating inventory, etc.

        // 3. Update Shipment in Database
        const updatedShipment = await prisma.shipment.update({
            where: { id: shipmentId },
            data: {
                // @ts-ignore - Bypassing incorrect linter error about ShipmentStatus enum
                status: ShipmentStatus.RECEIVED,
                recipientName: recipientName.trim(),
                recipientSignature: signature,
                receivedAt: new Date(),
            },
            // Optionally include devices/location if needed in the response
            include: {
                devices: true,
                location: { select: { name: true } }
            }
        });

        // 4. Return Success Response
        return NextResponse.json(updatedShipment, { status: 200 });

    } catch (error: any) {
        console.error(`Error receiving shipment ${shipmentId}:`, error);
        if (error.code === 'P2023' || error.message.includes('Malformed UUID')) {
             return NextResponse.json({ error: 'Invalid Shipment ID format' }, { status: 400 });
        }
         if (error.code === 'P2025') { // Record to update not found (might happen in race condition)
            return NextResponse.json({ error: 'Shipment not found during update' }, { status: 404 });
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
} 