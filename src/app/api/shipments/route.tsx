import { NextResponse } from 'next/server';
import { prisma, Prisma } from '@/lib/prisma';
import { generateManifestPdf } from '@/lib/pdf';
import fs from 'fs/promises';
import path from 'path';
import { lockDevice } from '@/lib/jamf';
import { sendEmail } from '@/lib/email';
// TODO: Import API Key validation logic later
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { NextRequest } from 'next/server';
import { ShipmentStatus } from "@prisma/client";
import cuid2 from "@paralleldrive/cuid2";
import NewShipmentNotification from "@/emails/NewShipmentNotification";

type ShipmentPayload = Prisma.ShipmentGetPayload<{
    include: {
        devices: true;
        location: true;
    }
}>

interface DeviceInput {
    serialNumber: string;
    assetTag?: string;
    model?: string;
}

function generateShortId(length = 6): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { senderName, senderEmail, devices, locationValue, trackingNumber, notifyEmails, notes, clientReferenceId } = body;

        if (!senderName || !senderEmail || !locationValue || !Array.isArray(devices) || devices.length === 0) {
            return NextResponse.json({ error: 'Missing required fields (senderName, senderEmail, locationValue, devices array)' }, { status: 400 });
        }
        if (typeof locationValue !== 'string' || locationValue.trim().length === 0) {
            return NextResponse.json({ error: 'Location value cannot be empty' }, { status: 400 });
        }
        if (!devices.every((d: any) => d.serialNumber)) {
            return NextResponse.json({ error: 'Each device must have a serialNumber' }, { status: 400 });
        }

        if (notifyEmails && !Array.isArray(notifyEmails) && typeof notifyEmails !== 'string') {
            return NextResponse.json({ error: 'notifyEmails must be an array of strings or a single string.' }, { status: 400 });
        }
        let parsedNotifyEmails: string[] = [];
        if (typeof notifyEmails === 'string') {
            parsedNotifyEmails = notifyEmails.split(',').map(e => e.trim()).filter(e => e !== '');
        } else if (Array.isArray(notifyEmails)) {
            parsedNotifyEmails = notifyEmails.filter(e => typeof e === 'string' && e.trim() !== '');
        }
        // TODO: Add stricter email format validation if needed

        if (
            (notes !== undefined && notes !== null && typeof notes !== 'string') ||
            (clientReferenceId !== undefined && clientReferenceId !== null && typeof clientReferenceId !== 'string')
        ) {
            return NextResponse.json({ error: 'Missing required fields or invalid data types for new fields.' }, { status: 400 });
        }

        const isPotentialId = cuid2.isCuid(locationValue);
        let locationConnectOrCreate;

        if (isPotentialId) {
            locationConnectOrCreate = { connect: { id: locationValue } };
        } else {
            const newLocationName = locationValue.trim();
            locationConnectOrCreate = {
                connectOrCreate: {
                    where: { name: newLocationName },
                    create: {
                        name: newLocationName,
                        recipientEmails: [`${newLocationName.toLowerCase().replace(/\s+/g, '_')}@example.com`]
                    }
                }
            };
        }

        let newShipment: ShipmentPayload | null = null;
        let attempts = 0;
        const maxAttempts = 5;

        while (attempts < maxAttempts && !newShipment) {
            attempts++;
            const shortId = generateShortId();

            try {
                newShipment = await prisma.shipment.create({
                    data: {
                        shortId: shortId,
                        senderName,
                        senderEmail,
                        status: ShipmentStatus.PENDING,
                        location: locationConnectOrCreate,
                        trackingNumber: trackingNumber || null,
                        notifyEmails: parsedNotifyEmails,
                        notes: notes?.trim() || null,
                        clientReferenceId: clientReferenceId?.trim() || null,
                        devices: {
                            create: devices.map((device: DeviceInput) => ({
                                serialNumber: device.serialNumber,
                                assetTag: device.assetTag,
                                model: device.model,
                            })),
                        },
                    },
                    include: {
                        devices: true,
                        location: true,
                    },
                }) as ShipmentPayload;

            } catch (error) {
                if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                    const target = (error.meta?.target as string[]) ?? [];
                    if (target.includes('shortId')) {
                        console.warn(`shortId collision detected (${shortId}). Retrying shipment creation (attempt ${attempts})...`);
                        if (attempts >= maxAttempts) {
                            console.error("Max attempts reached for generating unique shortId.");
                            throw new Error("Failed to generate a unique Shipment ID after multiple attempts.");
                        }
                    } else {
                        throw error;
                    }
                } else {
                    throw error;
                }
            }
        }

        if (!newShipment) {
            return NextResponse.json({ error: 'Failed to create shipment after multiple attempts.' }, { status: 500 });
        }

        if (newShipment && newShipment.devices) {
            console.log(`Shipment ${newShipment.shortId} created, triggering Jamf lock for ${newShipment.devices.length} devices...`);
            newShipment.devices.forEach(device => {
                lockDevice(device.serialNumber).catch(err => {
                    console.error(`[Non-blocking] Failed to trigger lock for ${device.serialNumber} on shipment ${newShipment?.shortId}:`, err);
                });
            });
        }

        try {
            const adminBaseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
            const adminEmails = (process.env.ADMIN_NOTIFY_EMAILS || '').split(',').map((e: string) => e.trim()).filter((e: string) => e);
            const locationEmails = (newShipment.location?.recipientEmails || []).map((e: string) => e.trim()).filter((e: string) => e);

            const recipientSet = new Set([...adminEmails, ...locationEmails, ...parsedNotifyEmails]);
            const recipients = Array.from(recipientSet);

            if (recipients.length > 0) {
                await sendEmail({
                    to: recipients,
                    subject: `New Shipment Created: ${newShipment.shortId}`,
                    react: <NewShipmentNotification shipment={newShipment} adminBaseUrl={adminBaseUrl} />,
                });
                console.log(`Sent new shipment notification for ${newShipment.shortId} to:`, recipients);
            } else {
                console.warn(`No recipients found for new shipment notification ${newShipment.shortId}`);
            }
        } catch (emailError: any) {
            console.error(`Failed to send new shipment notification for ${newShipment.shortId}:`, emailError);
        }

        return NextResponse.json(newShipment, { status: 201 });

    } catch (error: any) {
        console.error("Error creating shipment:", error);
        if (error.code === 'P2025') {
            return NextResponse.json({ error: 'Invalid Location ID provided.' }, { status: 400 });
        }
        if (error.code === 'P2002' && error.meta?.target?.includes('serialNumber')) {
            return NextResponse.json({ error: 'One or more serial numbers already exist in another shipment.' }, { status: 409 });
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// TODO: Add GET handler for listing shipments (admin dashboard) 
export async function GET(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const statusFilter = searchParams.get('status');
    const searchTerm = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '15', 10);

    if (isNaN(page) || page < 1 || isNaN(limit) || limit < 1) {
        return NextResponse.json({ error: 'Invalid pagination parameters. page and limit must be positive integers.' }, { status: 400 });
    }

    if (!['asc', 'desc'].includes(sortOrder)) {
        return NextResponse.json({ error: 'Invalid sortOrder parameter. Use \'asc\' or \'desc\'.' }, { status: 400 });
    }

    let whereClause: any = {};

    if (statusFilter) {
        if (Object.values(ShipmentStatus).includes(statusFilter as ShipmentStatus)) {
            whereClause.status = statusFilter as ShipmentStatus;
        } else {
            return NextResponse.json({ error: `Invalid status filter value: ${statusFilter}` }, { status: 400 });
        }
    }

    if (searchTerm) {
        whereClause.OR = [
            { senderName: { contains: searchTerm, mode: 'insensitive' } },
            { senderEmail: { contains: searchTerm, mode: 'insensitive' } },
            { location: { name: { contains: searchTerm, mode: 'insensitive' } } },
            {
                devices: {
                    some: {
                        OR: [
                            { serialNumber: { contains: searchTerm, mode: 'insensitive' } },
                            { assetTag: { contains: searchTerm, mode: 'insensitive' } }
                        ]
                    }
                }
            }
        ];
    }

    const skip = (page - 1) * limit;

    try {
        const [shipments, totalCount] = await Promise.all([
            prisma.shipment.findMany({
                where: whereClause,
                select: {
                    id: true,
                    shortId: true,
                    senderName: true,
                    senderEmail: true,
                    status: true,
                    manifestUrl: true,
                    createdAt: true,
                    updatedAt: true,
                    devices: {
                        select: {
                            id: true,
                            serialNumber: true,
                            assetTag: true,
                            model: true,
                            isCheckedIn: true,
                            checkedInAt: true,
                            shipmentId: true,
                            isExtraDevice: true
                        }
                    },
                    location: { select: { name: true } },
                    recipientName: true,
                    recipientSignature: true,
                    receivedAt: true
                },
                orderBy: {
                    [sortBy]: sortOrder,
                },
                skip: skip,
                take: limit,
            }),
            prisma.shipment.count({
                where: whereClause,
            })
        ]);

        return NextResponse.json({ shipments, totalCount }, { status: 200 });

    } catch (error: any) {
        console.error("Detailed Error fetching shipments:", error); // Log the full error
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
} 