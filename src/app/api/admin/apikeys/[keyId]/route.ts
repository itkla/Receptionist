import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { Prisma } from '@prisma/client';

// Define an interface for the route context params
interface ApiKeyRouteContext {
    params: {
        keyId: string;
    };
}

// PATCH: Update an API Key (e.g., toggle isActive)
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ keyId: string }> }
): Promise<NextResponse> {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const keyId = (await params).keyId;
        const body = await request.json();
        const { isActive } = body;

        if (typeof isActive !== 'boolean') {
            return NextResponse.json({ error: 'isActive field (boolean) is required' }, { status: 400 });
        }

        const updatedKey = await prisma.apiKey.update({
            where: { id: keyId },
            data: {
                isActive: isActive,
            },
            select: { // Return updated status
                id: true,
                isActive: true,
                description: true,
            },
        });

        return NextResponse.json(updatedKey);

    } catch (error: any) {
        console.error(`Error updating API key ${(await params).keyId}:`, error);
        if (error.code === 'P2025') { // Prisma record not found
            return NextResponse.json({ error: 'API Key not found' }, { status: 404 });
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// DELETE: Streamlined handler
export const DELETE = async (
    request: NextRequest,
    { params }: { params: Promise<{ keyId: string }> }
) => {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const keyId = (await params).keyId;

    if (!keyId) {
        return NextResponse.json({ error: 'API Key ID is required' }, { status: 400 });
    }

    try {
        // Attempt to update the key directly
        await prisma.apiKey.update({
            where: { id: keyId },
            data: { isActive: false }, // Set isActive to false instead of deleting
        });

        // If update succeeds, return success
        return NextResponse.json({ message: 'API Key revoked successfully' }, { status: 200 });

    } catch (error) {
        console.error(`Error revoking API key ${keyId}:`, error);
        
        // Check if the error is because the record to update was not found
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            return NextResponse.json({ error: 'API Key not found' }, { status: 404 });
        }
        
        // Handle other potential errors
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}; 