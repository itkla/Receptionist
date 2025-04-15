import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RouteParams {
    params: {
        locationId: string;
    }
}

// GET /api/admin/locations/[locationId]
// Fetch details for a specific location and its associated shipments
export async function GET(
    request: Request,
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
        // Fetch location details
        const location = await prisma.location.findUnique({
            where: { id: locationId },
        });

        if (!location) {
            return NextResponse.json({ error: 'Location not found' }, { status: 404 });
        }

        // Fetch associated shipments including devices
        const shipments = await prisma.shipment.findMany({
            where: { locationId: locationId },
            include: {
                devices: true, // Include device details for each shipment
            },
            orderBy: {
                createdAt: 'desc' // Show most recent shipments first
            }
        });

        // Combine data and return
        return NextResponse.json({ location, shipments });

    } catch (error) {
        console.error(`Error fetching location ${locationId} data:`, error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
} 