import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route"; // Adjust path if needed
import { prisma } from "@/lib/prisma";

// GET /api/admin/locations - Fetch all locations (minimal data)
export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) { // TODO: Add role check if applicable
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const locations = await prisma.location.findMany({
            select: {
                id: true,
                // shortId: true, // <-- Add back later if schema fixed
                name: true,
                _count: { 
                    select: { shipments: true } 
                },
                // Include the latest shipment's creation date
                shipments: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: { createdAt: true }
                }
            },
            orderBy: {
                name: 'asc'
            }
        });
        return NextResponse.json(locations);
    } catch (error) {
        console.error("Error fetching locations:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// POST /api/admin/locations - Add a new location (Optional - can be added later)
// export async function POST(request: Request) { ... } 