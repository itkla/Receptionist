// src/app/api/public/shipments/[shortId]/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { ShipmentStatus, Shipment, Device, Location } from "@prisma/client";

// Define the expected structure for the detailed shipment response
type ShipmentDetailApiResponse = Shipment & {
    devices: Device[];
    location: Location | null;
    // Add trackingNumber if it exists directly on Shipment model
    trackingNumber?: string | null;
    // Add other relations if needed
};

// Public GET Handler - No Auth Required
export async function GET(
    request: Request,
    { params }: { params: Promise<{ shortId: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        // No active session found
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const shortId = (await params).shortId?.toUpperCase();

    if (!shortId || shortId.length !== 6) {
        return NextResponse.json({ error: 'Invalid Shipment ID format.' }, { status: 400 });
    }

    try {
        const shipment = await prisma.shipment.findUnique({
            where: { shortId: shortId },
            include: {
                devices: true,   // Include all device fields
                location: true, // Include all location fields
                // Ensure all needed fields are included here based on ShipmentDetailApiResponse
            }
        });

        if (!shipment) {
            return NextResponse.json({ error: 'Shipment not found' }, { status: 404 });
        }

        // Remove the incorrect status check that prevents viewing based on receiving status
        // if (shipment.status !== ShipmentStatus.PENDING && shipment.status !== ShipmentStatus.IN_TRANSIT && shipment.status !== ShipmentStatus.DELIVERED) { ... }

        // --- Authorization Check Placeholder ---
        // TODO: Add specific authorization logic here if needed.
        // For example, check if session.user.role === 'ADMIN' or session.user.id === shipment.createdById etc.
        // --- End Placeholder ---

        // Explicitly cast to the defined type for clarity
        return NextResponse.json(shipment as ShipmentDetailApiResponse);

    } catch (error) {
        console.error(`Error fetching public shipment ${shortId}:`, error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// Public PUT Handler - Needs update later
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ shortId: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const shortId = (await params).shortId?.toUpperCase();
    if (!shortId || shortId.length !== 6) {
        return NextResponse.json({ error: 'Invalid Shipment ID format.' }, { status: 400 });
    }

    try {
        const body = await request.json();
        // Destructure potentially including adminCheckedSerials
        const { senderName, senderEmail, status, trackingNumber, adminCheckedSerials } = body;

        // Basic validation (add check for adminCheckedSerials if needed)
        if (typeof senderName !== 'string' || typeof senderEmail !== 'string' || !Object.values(ShipmentStatus).includes(status) || (adminCheckedSerials && !Array.isArray(adminCheckedSerials))) {
            return NextResponse.json({ error: 'Invalid input data.' }, { status: 400 });
        }

        const now = new Date(); // Capture current time for potential check-ins

        // Use a transaction for atomicity
        const updatedShipment = await prisma.$transaction(async (tx) => {
            // Find existing shipment first (needed for status checks and potentially ID)
            const existingShipment = await tx.shipment.findUnique({
                where: { shortId: shortId },
                select: { id: true, status: true } 
            });

            if (!existingShipment) {
                throw new Error('ShipmentNotFound'); // Use specific error to handle in catch
            }
            
            // Prevent updates if already completed/cancelled (existing check is fine)
            if (existingShipment.status === ShipmentStatus.COMPLETED || existingShipment.status === ShipmentStatus.CANCELLED ) {
                 // Allow updating from RECEIVED to COMPLETED, but not from CANCELLED/COMPLETED to something else
                 if (status !== ShipmentStatus.COMPLETED || existingShipment.status === ShipmentStatus.CANCELLED) { 
                    throw new Error(`Conflict: Shipment status (${existingShipment.status}) prevents updates.`);
                 }
            }

            // Update the main shipment record (prepare promise)
            const shipmentUpdatePromise = tx.shipment.update({
                where: { shortId: shortId }, 
                data: {
                    senderName: senderName.trim(),
                    senderEmail: senderEmail.trim(),
                    status: status,
                    trackingNumber: trackingNumber?.trim() || null,
                },
                 include: { 
                     devices: true,
                     location: true,
                 }
            });

            // --- Conditional Device Update (await directly) --- 
            if (status === ShipmentStatus.COMPLETED && adminCheckedSerials && Array.isArray(adminCheckedSerials) && adminCheckedSerials.length > 0) {
                 console.log(`Admin completing shipment ${shortId}, checking devices:`, adminCheckedSerials);
                 // Only update devices specified by admin *that are not already checked in*
                 await tx.device.updateMany({ // Await the update directly
                     where: {
                         shipmentId: existingShipment.id, 
                         serialNumber: { in: adminCheckedSerials },
                         isCheckedIn: false 
                     },
                     data: {
                         isCheckedIn: true,
                         checkedInAt: now 
                     }
                 });
            }
            // --- End Conditional Device Update --- 

            // Now await the main shipment update and return its result
            const updatedShipmentResult = await shipmentUpdatePromise;
            return updatedShipmentResult;
        });


        return NextResponse.json(updatedShipment as ShipmentDetailApiResponse);

    } catch (error: any) {
        console.error(`Error updating shipment ${shortId}:`, error);
        if (error.message === 'ShipmentNotFound') {
             return NextResponse.json({ error: 'Shipment not found.' }, { status: 404 });
        }
        if (error.message?.startsWith('Conflict:')) {
             return NextResponse.json({ error: error.message }, { status: 409 }); // Conflict status
        }
        // Prisma errors etc.
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}