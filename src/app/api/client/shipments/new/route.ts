import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ShipmentStatus, Prisma, Location, ApiKey } from "@prisma/client";
import { z } from 'zod';
import { generateShortId } from '@/lib/utils';
import { authenticateClientApiKey, ApiAuthError } from '@/lib/apiAuth';
import { sendEmail } from "@/lib/email";
import NewShipmentNotification from "@/emails/NewShipmentNotification";
import React from 'react';

// --- Zod Schemas (Assuming clientShipmentSchema is defined correctly) ---
const deviceSchema = z.object({
    serialNumber: z.string().min(1, "Serial number cannot be empty"),
    assetTag: z.string().optional().nullable(),
    model: z.string().optional().nullable(),
});

const clientShipmentSchema = z.object({
    locationName: z.string().min(1, "Location name is required"),
    trackingNumber: z.string().optional().nullable(),
    clientReferenceId: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    devices: z.array(deviceSchema).min(1, "At least one device is required"),
    recipientEmails: z.array(z.string().email("Invalid recipient email format")).optional().nullable(),
});
// --- End Zod Schemas ---

const API_SENDER_EMAIL = process.env.API_SENDER_EMAIL || 'noreply-api@receptionist'; // Define constant if needed

// --- POST Handler for Client Shipments --- 
export async function POST(request: Request) {
    try {
        // 1. Authenticate API Key
        const apiKeyData = await authenticateClientApiKey(request);
        // Use description which is available, fallback to ID if null
        const apiKeyIdentifier = apiKeyData.description ?? `Key ID: ${apiKeyData.id}`;
        console.log(`Client shipment: Authenticated API key: ${apiKeyIdentifier}`);

        // 2. Validate Request Body
        const body = await request.json();
        const parseResult = clientShipmentSchema.safeParse(body);

        if (!parseResult.success) {
            console.error("Client shipment: Validation error:", parseResult.error.errors);
            return NextResponse.json({ error: "Invalid request body", details: parseResult.error.errors }, { status: 400 });
        }
        const validData = parseResult.data;
        console.log("Client shipment: Validated data received:", { ...validData, devices: `${validData.devices.length} devices` });

        // 3. Process Data and Create Shipment (Including Location lookup BY NAME)
        const location = await prisma.location.findUnique({
            where: { name: validData.locationName },
        });

        if (!location) {
            return NextResponse.json({ error: `Location with name '${validData.locationName}' not found.` }, { status: 404 });
        }
        console.log(`Client shipment: Found location: ${location.name} (ID: ${location.id})`);
        
        let newShipment = null; 
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts && !newShipment) {
            attempts++;
            const shortId = generateShortId();
            try {
                newShipment = await prisma.shipment.create({
                    data: {
                        shortId: shortId,
                        senderName: apiKeyIdentifier,
                        senderEmail: API_SENDER_EMAIL,
                        locationId: location.id,
                        status: ShipmentStatus.PENDING, 
                        trackingNumber: validData.trackingNumber,
                        clientReferenceId: validData.clientReferenceId,
                        notes: validData.notes,
                        notifyEmails: validData.recipientEmails ?? [],
                        devices: {
                            create: validData.devices.map(device => ({
                                serialNumber: device.serialNumber,
                                assetTag: device.assetTag,
                                model: device.model,
                            })),
                        },
                    },
                    include: {
                        location: true,
                        devices: true,
                    },
                });
                console.log(`Client shipment: Created shipment ${newShipment.shortId} for location ${location.name}`);
            } catch (error) {
                 if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                    console.warn(`Client shipment: shortId collision (${shortId}), retrying... (${attempts}/${maxAttempts})`);
                    if (attempts >= maxAttempts) {
                         throw new Error(`Failed to generate unique shortId after ${maxAttempts} attempts.`);
                    }
                 } else {
                    throw error;
                 }
            }
        }

        if (!newShipment) { 
            throw new Error('Failed to create shipment record.');
        }

        // 4. Send Email Notification (Asynchronous)
        (async () => {
            try {
                const adminBaseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
                
                const requestEmails = validData.recipientEmails?.filter(email => !!email) ?? [];

                // Get all users and filter in code (workaround for potential type issues)
                const allUsers = await prisma.user.findMany({ 
                    select: { email: true } // Select only the email
                });
                // Filter out users without a valid email
                const userEmails = allUsers.map(user => user.email).filter((email): email is string => typeof email === 'string' && email.length > 0);

                const combinedEmails = [...new Set([...requestEmails, ...userEmails])];

                if (combinedEmails.length > 0 && newShipment) { 
                     await sendEmail({
                         to: combinedEmails,
                         subject: `New Shipment Created - ${newShipment.shortId}`,
                         react: NewShipmentNotification({ shipment: newShipment, adminBaseUrl: adminBaseUrl }) as React.ReactElement,
                     });
                     console.log(`Client shipment: Sent notification for ${newShipment.shortId} to combined list:`, combinedEmails);
                } else if (newShipment) {
                    console.warn(`Client shipment: No emails found in request or database for notification ${newShipment.shortId}`);
                }
            } catch (emailError: any) {
                 console.error(`Client shipment: Failed to send notification for ${newShipment?.shortId}:`, emailError);
            }
        })();

        // --- 6. Return JSON Response (Simplified) --- 
        console.log(`Client shipment: Successfully created shipment ${newShipment.shortId}.`);

        return NextResponse.json({ 
            message: "Shipment created successfully.",
            shortId: newShipment.shortId,
        }, { 
            status: 201
        });

    } catch (error) {
        if (error instanceof ApiAuthError) {
            console.error("Client shipment: Authentication error:", error.message);
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            console.error("Client shipment: Prisma Error:", error.code, error.message);
             return NextResponse.json({ error: 'Database operation failed.', code: error.code }, { status: 409 });
        }

        console.error("Client shipment: Unexpected outer error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
} 