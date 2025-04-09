import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const SALT_ROUNDS = 10;

// Zod schema for input validation
const createUserSchema = z.object({
  name: z.string().trim().min(1, { message: "Name is required." }),
  email: z.string().trim().email({ message: "Invalid email address." }),
  password: z.string().min(8, { message: "Password must be at least 8 characters long." }), // Add password complexity if needed
});

// POST /api/admin/users - Create a new user
export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    // TODO: Add role-based authorization if necessary (e.g., check session.user.role)
    if (!session || !session.user) { 
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let payload;
    try {
        payload = await request.json();
    } catch (error) {
        return NextResponse.json({ error: 'Invalid JSON format' }, { status: 400 });
    }

    // Validate payload
    const validation = createUserSchema.safeParse(payload);
    if (!validation.success) {
        return NextResponse.json({ error: 'Invalid input data', details: validation.error.flatten().fieldErrors }, { status: 400 });
    }
    const { name, email, password } = validation.data;

    try {
        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email: email },
        });
        if (existingUser) {
            return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 }); // Conflict
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        // Create user
        const newUser = await prisma.user.create({
            data: {
                name: name,
                email: email,
                password: hashedPassword,
            },
            select: { // Return only safe fields
                id: true,
                name: true,
                email: true,
                createdAt: true,
            }
        });

        return NextResponse.json(newUser, { status: 201 });

    } catch (error) {
        console.error("Error creating user:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// GET /api/admin/users - Fetch all users
export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    // Ensure user is authenticated (add role checks if necessary)
    if (!session || !session.user) { 
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                name: true,
                email: true,
                createdAt: true, 
                // Add other fields needed by UserData interface in page.tsx
            },
            orderBy: {
                createdAt: 'desc', // Or name: 'asc', etc.
            },
        });

        // Explicitly type the response data to match UserData if needed,
        // although the select clause should align it.
        return NextResponse.json(users);

    } catch (error) {
        console.error("Error fetching users:", error);
        return NextResponse.json({ error: 'Internal Server Error fetching users' }, { status: 500 });
    }
}

// GET handler could be added here later if needed for client-side fetching/searching
// export async function GET(request: Request) { ... } 