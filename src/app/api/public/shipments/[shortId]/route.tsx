import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ShipmentStatus, Shipment, Device, Location } from "@prisma/client";
import { unlockDevice } from '@/lib/jamf';
import { sendEmail } from "@/lib/email";
import ShipmentReceivedNotification from "@/emails/ShipmentReceivedNotification";

// Define the expected structure for the PUBLIC shipment response
// Only include fields needed for the receiving page
type PublicShipmentDetail = Pick<Shipment, 'id' | 'shortId' | 'senderName' | 'createdAt' | 'status'> & {
    devices: Pick<Device, 'id' | 'serialNumber' | 'assetTag' | 'model'>[];
    // Don't include sensitive location details, maybe just name if needed, or omit entirely for public view
    location?: { name: string } | null;
};

// --- Public GET Handler (No Auth) --- 
export async function GET(
    request: Request, // Keep request param
    { params }: { params: Promise<{ shortId: string }> }
) {
    const shortId = (await params).shortId?.toUpperCase(); 

    if (!shortId || shortId.length !== 6) {
        return NextResponse.json({ error: 'Invalid Shipment ID format.' }, { status: 400 });
    }

    try {
        const shipment = await prisma.shipment.findUnique({
            where: { shortId: shortId },
            select: { // Select only necessary fields for the public page
                id: true, 
                shortId: true,
                senderName: true, // Maybe show sender name?
                createdAt: true,
                status: true,
                devices: { 
                    select: {
                        id: true,
                        serialNumber: true, // Needed for matching
                        assetTag: true, // Display info
                        model: true,   // Display info
                        // DO NOT SELECT isCheckedIn or checkedInAt for public view initially
                    }
                },
                location: { select: { name: true } } // Only include location name if desired
                // DO NOT include senderEmail, recipient details, signature, etc.
            }
        });

        if (!shipment) {
            return NextResponse.json({ error: 'Shipment not found' }, { status: 404 });
        }

        return NextResponse.json(shipment as PublicShipmentDetail);

    } catch (error) {
        console.error(`Error fetching public shipment ${shortId}:`, error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// --- Public PUT Handler (No Auth) ---
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ shortId: string }> }
) {
    const shortId = (await params).shortId?.toUpperCase();
    if (!shortId || shortId.length !== 6) {
        return NextResponse.json({ error: 'Invalid Shipment ID format.' }, { status: 400 });
    }

    try {
        const body = await request.json();
        const { recipientName, signature, receivedSerials, extraDevices } = body;

        // --- Input Validation ---
        if (!recipientName || typeof recipientName !== 'string' || recipientName.trim() === '') {
            return NextResponse.json({ error: 'Recipient name is required.' }, { status: 400 });
        }
        if (!signature || typeof signature !== 'string' || !signature.startsWith('data:image/png;base64,')) {
            return NextResponse.json({ error: 'Invalid signature format.' }, { status: 400 });
        }
        if (!Array.isArray(receivedSerials) || !receivedSerials.every(s => typeof s === 'string')) {
             return NextResponse.json({ error: 'Invalid format for received serials.' }, { status: 400 });
        }
        // Optional: Validate extraDevices structure if needed
        if (extraDevices && (!Array.isArray(extraDevices) || !extraDevices.every(d => typeof d === 'object' && d !== null && typeof d.serialNumber === 'string'))) {
             return NextResponse.json({ error: 'Invalid format for extra devices.' }, { status: 400 });
        }
        // --- End Validation ---

        // --- Fetch Full Shipment Data for Email --- 
        // We need more details than just status for the email
        const fullShipmentDataForEmail = await prisma.shipment.findUnique({
            where: { shortId: shortId },
            include: {
                devices: { select: { serialNumber: true, model: true, assetTag: true, isCheckedIn: true } }, // Include isCheckedIn for email lists
                location: { select: { name: true, recipientEmails: true } }, // Need emails for sender/location notification
                // Include senderName/senderEmail for context
            }
        });

        if (!fullShipmentDataForEmail) {
            // If shipment not found here, transaction below would also fail
             return NextResponse.json({ error: 'Shipment not found.' }, { status: 404 });
        }
        // --- End Fetch --- 

        const now = new Date();
        let finalShipmentStatus: ShipmentStatus | null = null;

        // Use a transaction to ensure atomicity
        const transactionResult = await prisma.$transaction(async (tx) => {
            // 1. Find the shipment ID and verify its status (can use data fetched above, but re-fetch in tx for safety)
            const shipment = await tx.shipment.findUnique({
                where: { shortId: shortId },
                select: { id: true, status: true } 
            });
            // ... handle not found / status conflict errors using shipment ...
            if (!shipment) { throw new Error('ShipmentNotFound'); }
            if (shipment.status !== ShipmentStatus.PENDING && 
                shipment.status !== ShipmentStatus.IN_TRANSIT && 
                shipment.status !== ShipmentStatus.DELIVERED) {
                 throw new Error(`Conflict: Shipment status (${shipment.status}) does not allow receiving.`); 
            }

            // 2. Update the shipment itself
            const updatedShipment = await tx.shipment.update({
                where: { id: shipment.id }, // Use internal ID for update
                data: {
                    status: ShipmentStatus.RECEIVED,
                    recipientName: recipientName.trim(),
                    recipientSignature: signature,
                    receivedAt: now,
                    // Add extra devices info to a field if schema supports it, e.g., a JSON field or notes
                    // notes: `Received extra devices: ${JSON.stringify(extraDevices)}` 
                },
                select: { status: true } // Return only the new status
            });

            // 3. Update the check-in status for received devices
            if (receivedSerials && receivedSerials.length > 0) {
                await tx.device.updateMany({
                    where: {
                        shipmentId: shipment.id, // Ensure devices belong to this shipment
                        serialNumber: { in: receivedSerials }
                    },
                    data: {
                        isCheckedIn: true,
                        checkedInAt: now
                    }
                });
            }
            
            // 4. Optional: Handle extraDevices - Create new Device records?
            // Requires careful consideration: How to link them? Default values?
            // Example (Needs refinement based on Device schema):
            if (extraDevices && extraDevices.length > 0) {
                console.log(`Received ${extraDevices.length} extra devices for shipment ${shortId}. Creating records...`);
                await tx.device.createMany({
                    data: extraDevices.map((device: any) => ({
                        shipmentId: shipment.id, // Link to the current shipment
                        serialNumber: device.serialNumber,
                        assetTag: device.assetTag || null, // Provide defaults or null
                        model: device.model || null,      // Provide defaults or null
                        isCheckedIn: true, // Mark extra devices as received immediately
                        checkedInAt: now,  // Use the current timestamp
                        isExtraDevice: true // Set the flag for extra devices
                        // Add any other required fields for Device model here
                    })),
                    skipDuplicates: true // Avoid errors if somehow submitted twice
                });
                console.log(`Successfully created records for ${extraDevices.length} extra devices.`);
            }

            return updatedShipment; // Return the result (just the status)
        });

        finalShipmentStatus = transactionResult.status;

        // --- Trigger Jamf Unlock (Conditional) ---
        // Check if necessary JAMF environment variables are set
        // IMPORTANT: Replace JAMF_URL, JAMF_USER, JAMF_PASSWORD with the actual variable names used by your @/lib/jamf module
        const jamfUrl = process.env.JAMF_URL;
        const jamfUser = process.env.JAMF_USER;
        const jamfPassword = process.env.JAMF_PASSWORD; 
        const isJamfConfigured = !!jamfUrl && !!jamfUser && !!jamfPassword;

        if (isJamfConfigured) {
            if (receivedSerials && Array.isArray(receivedSerials) && receivedSerials.length > 0) {
                console.log(`JAMF configured. Receipt for ${shortId} submitted, triggering Jamf unlock for ${receivedSerials.length} devices...`);
                // Use Promise.allSettled for better error handling if you need to know all results
                const unlockPromises = receivedSerials.map((serial: string) => 
                    unlockDevice(serial).catch(err => {
                        console.error(`[Non-blocking] Failed to trigger unlock for ${serial} on receipt ${shortId}:`, err);
                        return { serial, status: 'failed', error: err }; // Return identifiable error object
                    })
                );
                // We don't await Promise.allSettled here to keep it non-blocking,
                // but you could if you needed to wait for Jamf results before responding.
                Promise.allSettled(unlockPromises).then(results => {
                    // Optional: Log detailed results after all promises settle
                    // console.log(`Jamf unlock results for ${shortId}:`, results);
                });
            } else {
                 console.log(`JAMF configured, but no received serials provided for ${shortId}. Skipping unlock.`);
            }
        } else {
            console.log(`JAMF not configured (missing required URL/User/Password env variables). Skipping Jamf unlock for ${shortId}.`);
        }
        // --- End Jamf Unlock ---

        // --- Send Received Email Notification (Async, Non-blocking) ---
        try {
            // Prepare data structure for email component
            const emailData = {
                ...fullShipmentDataForEmail, // Use the data fetched earlier
                // Ensure required fields are present (recipientName is from body)
                recipientName: recipientName.trim(), 
                receivedAt: now, // Use the timestamp from this request
                devices: fullShipmentDataForEmail.devices.map(d => ({ 
                    ...d, 
                    isCheckedIn: receivedSerials.includes(d.serialNumber) // Reflect the state JUST submitted
                })),
            };

            const adminEmails = (process.env.ADMIN_NOTIFY_EMAILS || '').split(',').map((e: string) => e.trim()).filter((e: string) => e);
            // Notify sender? 
            const senderEmail = fullShipmentDataForEmail.senderEmail; 
            // Notify location emails?
            const locationEmails = (fullShipmentDataForEmail.location?.recipientEmails || []).map((e: string) => e.trim()).filter((e: string) => e);
            
            const recipientSet = new Set([...adminEmails, senderEmail, ...locationEmails].filter(Boolean)); // Filter out null/empty senderEmail
            const recipients = Array.from(recipientSet);

            if (recipients.length > 0) {
                await sendEmail({
                    to: recipients,
                    subject: `Shipment Received: ${shortId}`,
                    react: <ShipmentReceivedNotification shipment={emailData as any} /> // Cast needed due to type construction
                });
                console.log(`Sent shipment received notification for ${shortId} to:`, recipients);
            } else {
                console.warn(`No recipients found for shipment received notification ${shortId}`);
            }

        } catch(emailError: any) {
            console.error(`Failed to send shipment received notification for ${shortId}:`, emailError);
        }
        // --- End Email Notification ---

        // Transaction successful - return status confirmation
        return NextResponse.json({ status: finalShipmentStatus });

    } catch (error: any) {
        console.error(`Error submitting receipt for ${shortId}:`, error);
        if (error.message === 'ShipmentNotFound') {
            return NextResponse.json({ error: 'Shipment not found.' }, { status: 404 });
        }
        if (error.message?.startsWith('Conflict:')) {
            return NextResponse.json({ error: error.message }, { status: 409 }); // Conflict status
        }
        // Handle other potential errors (e.g., Prisma validation errors)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// TODO: Re-add public PUT handler later 