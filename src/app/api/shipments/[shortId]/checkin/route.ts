import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> } // Shipment ID from route
) {
  try {
    const shipmentId = (await params).id;
    const body = await request.json();
    const { serialNumber } = body;

    if (!shipmentId) {
      return NextResponse.json({ error: 'Shipment ID is required in the URL' }, { status: 400 });
    }
    if (!serialNumber || typeof serialNumber !== 'string') {
      return NextResponse.json({ error: 'Device serialNumber is required in the request body' }, { status: 400 });
    }

    // Find the device by serial number *within this specific shipment*
    // Use findFirst because serialNumber is not unique globally
    const deviceToUpdate = await prisma.device.findFirst({ 
      where: {
        serialNumber: serialNumber,
        // Ensure the device belongs to the specified shipment to prevent cross-shipment check-ins
        shipmentId: shipmentId, 
      }
    });

    if (!deviceToUpdate) {
      return NextResponse.json({ error: `Device with serial ${serialNumber} not found in shipment ${shipmentId}` }, { status: 404 });
    }

    if (deviceToUpdate.isCheckedIn) {
        // Optional: Return success but indicate it was already checked in
        return NextResponse.json({ message: `Device ${serialNumber} was already checked in`, status: 'already_checked_in', timestamp: deviceToUpdate.checkedInAt }, { status: 200 });
    }

    // Update the device status
    const updatedDevice = await prisma.device.update({
      where: {
        id: deviceToUpdate.id,
      },
      data: {
        isCheckedIn: true,
        checkedInAt: new Date(),
      },
    });

    // Optional: Consider updating Shipment status to RECEIVING if it was PENDING/IN_TRANSIT
    // await prisma.shipment.updateMany({
    //   where: { id: shipmentId, status: { in: ['PENDING', 'IN_TRANSIT'] } },
    //   data: { status: 'RECEIVING' }
    // });

    return NextResponse.json({ status: 'checked_in', timestamp: updatedDevice.checkedInAt }, { status: 200 });

  } catch (error: any) {
    console.error("Error checking in device:", error);
    // Handle potential errors (e.g., database errors)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 