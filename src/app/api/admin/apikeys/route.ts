import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// GET /api/admin/apikeys - Fetch all API keys (excluding hash)
export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const apiKeys = await prisma.apiKey.findMany({
            select: {
                id: true,
                description: true,
                createdAt: true,
                lastUsedAt: true,
                isActive: true,
                // keyHash: false // Excluded by default if not selected
            },
            orderBy: {
                createdAt: 'desc' // Show newest first
            }
        });
        return NextResponse.json(apiKeys);
    } catch (error) {
        console.error("Error fetching API keys:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// POST /api/admin/apikeys - Generate a new API key
export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) { // TODO: Add role check if applicable
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { description } = body;

        if (!description || typeof description !== 'string' || description.trim() === '') {
            return NextResponse.json({ error: 'Description is required' }, { status: 400 });
        }
        const keyBytes = crypto.randomBytes(32);
        const apiKey = `concierge_${keyBytes.toString('hex')}`;
        const saltRounds = 10;
        const keyHash = await bcrypt.hash(apiKey, saltRounds);

        const createdKey = await prisma.apiKey.create({
            data: {
                description: description.trim(),
                keyHash: keyHash,
                isActive: true,
                // Optional: Link to the user who created it if needed
                // createdById: session.user.id,
            },
            select: {
                id: true,
                description: true,
                createdAt: true,
                isActive: true,
            }
        });
        return NextResponse.json({ ...createdKey, apiKey: apiKey }, { status: 201 });

    } catch (error) {
        console.error("Error generating API key:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// TODO: Add PUT/PATCH for activating/deactivating keys?
// TODO: Add DELETE for removing keys? 