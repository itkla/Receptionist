import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route"; // Adjust path if needed
import { prisma } from "@/lib/prisma";
import { z } from 'zod'; // For input validation

interface RouteParams {
    params: {
        locationId: string;
    }
}

// Define the input type structure explicitly FIRST
interface UpdateRecipientsPayload {
    recipientEmails?: string[];
    addEmail?: string;
    removeEmail?: string;
}

// Then define the Zod schema
const updateRecipientsSchema = z.object({
    recipientEmails: z.array(z.string().email({ message: "Invalid email address provided" })).optional(),
    addEmail: z.string().email().optional(),
    removeEmail: z.string().email().optional()
}).refine((data: UpdateRecipientsPayload) => !(data.addEmail && data.removeEmail), { // Use the interface type
    message: "Cannot add and remove email in the same request",
    path: ["addEmail", "removeEmail"],
}).refine((data: UpdateRecipientsPayload) => !(data.recipientEmails && (data.addEmail || data.removeEmail)), { // Use the interface type
    message: "Cannot specify full list and add/remove operation simultaneously",
    path: ["recipientEmails"],
});

// PUT /api/admin/locations/[locationId]/recipients
// Update the recipient email list for a location
export async function PUT(request: Request, { params }: RouteParams) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) { // TODO: Add role check
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { locationId } = params;
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

        // Fetch location ensuring it exists
        const location = await prisma.location.findUnique({
            where: { id: locationId },
        });

        if (!location) {
            return NextResponse.json({ error: 'Location not found' }, { status: 404 });
        }
        console.log("[API PUT Recipient] Fetched location:", JSON.stringify(location)); // Log fetched location

        // Ensure current emails are treated as string[]
        let currentEmails: string[] = Array.isArray(location.recipientEmails) ? location.recipientEmails as string[] : [];
        console.log("[API PUT Recipient] Current emails initialized as:", currentEmails); // Log initialized current emails

        let updatedEmails: string[] = [...currentEmails]; // Work with a copy

        if (recipientEmails !== undefined) {
            // Replace the entire list (handle potential empty array)
            updatedEmails = [...new Set(recipientEmails)];
        } else if (addEmail) {
            // Add an email if it doesn't exist
            console.log(`[API PUT Recipient] Attempting to add email: ${addEmail}`); // Log add attempt
            if (!currentEmails.includes(addEmail)) {
                updatedEmails.push(addEmail);
            }
        } else if (removeEmail) {
            // Remove an email
            console.log(`[API PUT Recipient] Attempting to remove email: ${removeEmail}`); // Log remove attempt
            updatedEmails = currentEmails.filter(email => email !== removeEmail);
        }

        console.log("[API PUT Recipient] Updated emails before save:", updatedEmails); // Log before saving

        // Update the location in the database
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