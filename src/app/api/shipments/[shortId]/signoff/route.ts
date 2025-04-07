import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { unlockDevice } from '@/lib/jamf'; // Import mock Jamf function

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> } // Shipment ID from route
) {
  try {
    const shipmentId = (await params).id;
    const body = await request.json();
    const { recipientName, signatureDataUrl } = body;

    // Validation
    if (!shipmentId) {
      return NextResponse.json({ error: 'Shipment ID is required in the URL' }, { status: 400 });
    }
    if (!recipientName || typeof recipientName !== 'string' || recipientName.trim() === '') {
      return NextResponse.json({ error: 'Recipient name is required' }, { status: 400 });
    }
    if (!signatureDataUrl || typeof signatureDataUrl !== 'string') {
      return NextResponse.json({ error: 'Signature data URL is required' }, { status: 400 });
    }

    // Use a transaction for final update and fetching device info
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update the Shipment status, recipient info, and received date
      const updatedShipment = await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          recipientName: recipientName.trim(),
          recipientSignature: signatureDataUrl,
          status: 'COMPLETED', // Final status
          receivedAt: new Date(),
        },
        include: {
          // Include devices to know which ones were actually checked in for unlock command
          devices: {
            where: { isCheckedIn: true } // Only select checked-in devices
          }
        }
      });

      if (!updatedShipment) {
        throw new Error('Shipment not found during sign-off transaction');
      }

      // --- Trigger Jamf Unlock for each *checked-in* device (async, non-blocking) ---
      updatedShipment.devices.forEach(device => {
        // Don't await, let them run in background
        unlockDevice(device.serialNumber).catch(err => {
          console.error(`Failed to trigger unlock for ${device.serialNumber}:`, err);
          // Log or potentially add a note about unlock failure?
        });
      });
      // ----------------------------------------------------------------------------------

      return updatedShipment;
    });

    // Respond with final status and timestamp
    return NextResponse.json({ status: result.status, timestamp: result.receivedAt }, { status: 200 });

  } catch (error: any) {
    console.error("Error signing off shipment:", error);
    if (error.code === 'P2025' || error.message.includes('Shipment not found')) { // Prisma error for record not found
      return NextResponse.json({ error: 'Shipment not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 