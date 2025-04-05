import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// PATCH: Update an API Key (e.g., toggle isActive)
export async function PATCH(
  request: Request,
  { params }: { params: { keyId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const keyId = params.keyId;
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
    console.error(`Error updating API key ${params.keyId}:`, error);
     if (error.code === 'P2025') { // Prisma record not found
        return NextResponse.json({ error: 'API Key not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE: Remove an API Key
export async function DELETE(
  request: Request,
  { params }: { params: { keyId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { keyId } = params;

  if (!keyId) {
    return NextResponse.json({ error: 'API Key ID is required' }, { status: 400 });
  }

  try {
    // Find the key first to make sure it exists
    const existingKey = await prisma.apiKey.findUnique({
      where: { id: keyId },
    });

    if (!existingKey) {
      return NextResponse.json({ error: 'API Key not found' }, { status: 404 });
    }

    // Update the key to set isActive to false
    await prisma.apiKey.update({
      where: { id: keyId },
      data: { isActive: false },
    });

    return NextResponse.json({ message: 'API Key revoked successfully' }, { status: 200 });

  } catch (error) {
    console.error(`Error revoking API key ${keyId}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 