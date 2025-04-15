import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from 'zod';

interface RouteParams {
    params: {
        locationId: string;
    }
}

interface UpdateRecipientsPayload {
    recipientEmails?: string[];
    addEmail?: string;
    removeEmail?: string;
}

const updateRecipientsSchema = z.object({
    recipientEmails: z.array(z.string().email({ message: "Invalid email address provided" })).optional(),
    addEmail: z.string().email().optional(),
    removeEmail: z.string().email().optional()
}).refine((data: UpdateRecipientsPayload) => !(data.addEmail && data.removeEmail), {
    message: "Cannot add and remove email in the same request",
    path: ["addEmail", "removeEmail"],
}).refine((data: UpdateRecipientsPayload) => !(data.recipientEmails && (data.addEmail || data.removeEmail)), {
    message: "Cannot specify full list and add/remove operation simultaneously",
    path: ["recipientEmails"],
});

// PUT /api/admin/locations/[locationId]/recipients
// Update the recipient email list for a location
export async function PUT(
    request: Request,
    // { params }: Promise<{ locationId: string }>
    { params }: { params: Promise<{ locationId: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const locationId = (await params).locationId;
    if (!locationId) {
        return NextResponse.json({ error: 'Location ID is required' }, { status: 400 });
    }

    try {
        const body = await request.json();
        const validation = updateRecipientsSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ error: 'Invalid input', details: validation.error.flatten().fieldErrors }, { status: 400 });
        }

        const { recipientEmails, addEmail, removeEmail } = validation.data;
        const location = await prisma.location.findUnique({
            where: { id: locationId },
        });

        if (!location) {
            return NextResponse.json({ error: 'Location not found' }, { status: 404 });
        }
        console.log("[API PUT Recipient] Fetched location:", JSON.stringify(location));
        let currentEmails: string[] = Array.isArray(location.recipientEmails) ? location.recipientEmails as string[] : [];
        console.log("[API PUT Recipient] Current emails initialized as:", currentEmails); // Log initialized current emails

        let updatedEmails: string[] = [...currentEmails];

        if (recipientEmails !== undefined) {
            updatedEmails = [...new Set(recipientEmails)];
        } else if (addEmail) {
            console.log(`[API PUT Recipient] Attempting to add email: ${addEmail}`); // Log add attempt
            if (!currentEmails.includes(addEmail)) {
                updatedEmails.push(addEmail);
            }
        } else if (removeEmail) {
            console.log(`[API PUT Recipient] Attempting to remove email: ${removeEmail}`); // Log remove attempt
            updatedEmails = currentEmails.filter(email => email !== removeEmail);
        }

        console.log("[API PUT Recipient] Updated emails before save:", updatedEmails); // Log before saving
        const updatedLocation = await prisma.location.update({
            where: { id: locationId },
            data: {
                recipientEmails: updatedEmails,
            },
        });

        console.log("[API PUT Recipient] Result after update:", JSON.stringify(updatedLocation)); // Log result after update

        return NextResponse.json(updatedLocation);

    } catch (error) {
        console.error(`Error updating recipients for location ${locationId}:`, error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
} 