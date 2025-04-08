import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ShipmentStatus, Location, Prisma, ApiKey } from "@prisma/client";
import { z } from 'zod';
import { generateShortId } from '@/lib/utils'; // Import from utils
import bcrypt from 'bcryptjs'; // Import bcryptjs
import { sendEmail } from "@/lib/email"; // Import email utility
import NewShipmentNotification from "@/emails/NewShipmentNotification"; // Import email component
import React from 'react'; // Import React

// --- Removed Environment Variable Check ---
// const PROGRAMMATIC_API_KEY = process.env.PROGRAMMATIC_API_KEY;

// --- Zod Schemas for Validation ---
const deviceSchema = z.object({
    serialNumber: z.string().trim().min(1, { message: "Serial number cannot be empty." }),
    assetTag: z.string().trim().nullish(), // Optional, allow null or undefined
    model: z.string().trim().nullish(),    // Optional, allow null or undefined
});

const createShipmentPayloadSchema = z.object({
    senderName: z.string().trim().min(1, { message: "Sender name is required." }),
    senderEmail: z.string().trim().email({ message: "Invalid sender email format." }),
    destinationIdentifier: z.string().trim().min(1, { message: "Destination identifier is required." }),
    clientReferenceId: z.string().trim().nullish(),
    carrier: z.string().trim().nullish(),
    trackingNumber: z.string().trim().nullish(),
    notes: z.string().trim().nullish(),
    devices: z.array(deviceSchema).min(1, { message: "At least one device is required." }),
    notifyEmails: z.union([z.string(), z.array(z.string())]).nullish(),
});

// --- Updated API Key Authentication ---
async function authenticateApiKey(request: Request): Promise<boolean> {
    const apiKeyHeader = request.headers.get('X-API-Key');
    
    if (!apiKeyHeader) {
        console.log("API Key authentication failed: No API key provided in X-API-Key header.");
        return false;
    }
    
    try {
        // Fetch all active API key hashes from the database
        const activeApiKeys = await prisma.apiKey.findMany({
            where: { isActive: true },
            select: { keyHash: true } // Only select the hash
        });

        if (activeApiKeys.length === 0) {
            console.warn("API Key authentication failed: No active API keys found in the database.");
            return false;
        }

        // Compare the provided key against each stored hash
        for (const keyRecord of activeApiKeys) {
            const match = await bcrypt.compare(apiKeyHeader, keyRecord.keyHash);
            if (match) {
                console.log("API Key authentication successful.");
                return true; // Found a valid, matching key
            }
        }

        // If no match was found after checking all active keys
        console.log("API Key authentication failed: Provided key does not match any active keys.");
        return false;
        
    } catch (error) {
        console.error("Error during API key database lookup:", error);
        return false; // Fail closed on database error
    }
}

// --- Helper to find Location ---
async function findLocationByIdentifier(identifier: string): Promise<Location | null> {
    // Try finding by ID first (more specific)
    try {
        const locationById = await prisma.location.findUnique({ where: { id: identifier } });
        if (locationById) return locationById;
    } catch (error) {
        // Ignore potential errors if identifier is not a valid ID format
        console.log(`Identifier ${identifier} is not a valid CUID/UUID, trying by name.`);
    }
    
    // If not found by ID, try finding by name (case-insensitive search might be useful)
    const locationByName = await prisma.location.findFirst({ 
        where: { name: { equals: identifier, mode: 'insensitive' } } // Case-insensitive name match
    });
    return locationByName;
}

// --- POST Handler ---
export async function POST(request: Request) {
    console.log("Received POST request to /api/shipments/new"); // Updated log message

    // 1. Authenticate API Key
    if (!await authenticateApiKey(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log("API Key authenticated successfully.");

    // 2. Validate Request Body
    let payload;
    try {
        payload = await request.json();
        console.log("Received Payload:", payload); // Log incoming data
    } catch (error) {
        console.error("Failed to parse request body:", error);
        return NextResponse.json({ error: 'Invalid JSON format in request body.' }, { status: 400 });
    }

    const validation = createShipmentPayloadSchema.safeParse(payload);
    if (!validation.success) {
        console.error("Request body validation failed:", validation.error.flatten());
        return NextResponse.json({ error: 'Invalid request body', details: validation.error.flatten().fieldErrors }, { status: 400 });
    }
    console.log("Payload validated successfully.");
    const validatedData = validation.data;
    const parsedNotifyEmails: string[] = [];
    if (typeof validatedData.notifyEmails === 'string') {
        parsedNotifyEmails.push(...validatedData.notifyEmails.split(',').map(e => e.trim()).filter(e => e !== ''));
    } else if (Array.isArray(validatedData.notifyEmails)) {
        parsedNotifyEmails.push(...validatedData.notifyEmails.filter(e => typeof e === 'string' && e.trim() !== ''));
    }

    try {
        // 3. Find Location ID
        const location = await findLocationByIdentifier(validatedData.destinationIdentifier);
        if (!location) {
            console.log(`Location not found for identifier: ${validatedData.destinationIdentifier}`);
            return NextResponse.json({ error: `Location not found for identifier: ${validatedData.destinationIdentifier}` }, { status: 404 });
        }
        console.log(`Found Location ID: ${location.id} for identifier: ${validatedData.destinationIdentifier}`);
        const locationId = location.id;

        // 4. Create Shipment & Devices in Transaction
        const maxAttempts = 5; // Prevent infinite loops on collision
        let attempts = 0;
        let newShipment = null;

        while (attempts < maxAttempts && !newShipment) {
            attempts++;
            const shortId = generateShortId(); // Use the imported utility function
            console.log(`Attempt ${attempts}: Trying shortId ${shortId}...`);

            try {
                newShipment = await prisma.$transaction(async (tx) => {
                    console.log(`Transaction attempt ${attempts} with shortId ${shortId}...`);
                    const shipment = await tx.shipment.create({
                        data: {
                            shortId: shortId, // Use generated shortId
                            senderName: validatedData.senderName,
                            senderEmail: validatedData.senderEmail,
                            locationId: locationId,
                            status: ShipmentStatus.PENDING, // Default status
                            trackingNumber: validatedData.trackingNumber,
                            carrier: validatedData.carrier,
                            clientReferenceId: validatedData.clientReferenceId, 
                            notes: validatedData.notes, 
                            devices: {
                                create: validatedData.devices.map(device => ({
                                    serialNumber: device.serialNumber,
                                    assetTag: device.assetTag,
                                    model: device.model,
                                }))
                            }
                        },
                        include: { // Include devices in the response
                            devices: true,
                            location: true, // Also include location details
                        }
                    });
                    console.log(`Shipment created successfully in transaction with shortId: ${shipment.shortId}`);
                    return shipment;
                }); // End transaction
            
            } catch (error) {
                // Check specifically for the unique constraint violation on shortId
                if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                    const target = (error.meta?.target as string[]) ?? [];
                    if (target.includes('shortId')) {
                        console.warn(`shortId collision detected (${shortId}). Retrying shipment creation (attempt ${attempts})...`);
                        if (attempts >= maxAttempts) {
                            console.error("Max attempts reached for generating unique shortId.");
                            throw new Error("Failed to generate a unique Shipment ID after multiple attempts.");
                        }
                        // Loop will continue to try a new ID
                    } else {
                         console.error("Database unique constraint error on a field other than shortId:", error);
                        // If unique constraint is on another field (e.g., serialNumber), throw the error
                        throw new Error(`Database error: Unique constraint violation on ${target.join(', ')}.`);
                    }
                } else {
                    // If it's not a P2002 error, rethrow it to be caught by the outer handler
                    console.error("Non-P2002 Error during transaction:", error);
                    throw error;
                }
            } // End catch
        } // End while loop

        // Check if shipment was created after retries
        if (!newShipment) {
            // This should only happen if maxAttempts was reached due to shortId collisions
            return NextResponse.json({ error: 'Failed to create shipment after multiple attempts due to ID collisions.' }, { status: 500 });
        }

        // --- Send Email Notification (Async, Non-blocking) --- 
        // Use the populated newShipment object which includes location
        if (newShipment) { 
            try {
                const adminBaseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"; 
                const adminEmails = (process.env.ADMIN_NOTIFY_EMAILS || '').split(',').map((e: string) => e.trim()).filter((e: string) => e);
                const locationEmails = (newShipment.location?.recipientEmails || []).map((e: string) => e.trim()).filter((e: string) => e);
                
                const recipientSet = new Set([...adminEmails, ...locationEmails, ...parsedNotifyEmails]);
                const recipients = Array.from(recipientSet);

                if (recipients.length > 0) {
                     await sendEmail({
                         to: recipients,
                         subject: `New Shipment Created (API): ${newShipment.shortId}`,
                         react: NewShipmentNotification({ shipment: newShipment, adminBaseUrl: adminBaseUrl }) as React.ReactElement,
                     });
                     console.log(`Sent API shipment notification for ${newShipment.shortId} to:`, recipients);
                } else {
                    console.warn(`No recipients found for API shipment notification ${newShipment.shortId}`);
                }
            } catch (emailError: any) {
                 console.error(`Failed to send API shipment notification for ${newShipment.shortId}:`, emailError);
            }
        } // End if(newShipment)
        // --- End Email Notification --- 

        // 5. Return Response (if successful)
        console.log("Transaction completed successfully after retries (if any).");
        return NextResponse.json(newShipment, { status: 201 }); // 201 Created status

    } catch (error) {
        console.error("Outer error during shipment creation process:", error);
        // Handle specific errors passed up from the transaction, or other general errors
        if (error instanceof Error && error.message.includes('Unique constraint violation')) {
             return NextResponse.json({ error: error.message }, { status: 409 }); // Conflict
        } else if (error instanceof Error && error.message.includes('Failed to generate a unique Shipment ID')) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ error: 'Internal Server Error during shipment creation.' }, { status: 500 });
    }
} 