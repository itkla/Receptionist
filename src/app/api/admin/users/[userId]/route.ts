import { NextResponse } from 'next/server';
// Use getServerSession and authOptions based on project structure
import { getServerSession } from "next-auth/next"; 
import { authOptions } from "@/lib/auth"; 
// Use prisma import based on project structure
import { prisma } from "@/lib/prisma"; 
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client'; // Import Prisma for types

// --- GET User Details ---
export async function GET(
    request: Request,
    { params }: { params: Promise<{ userId: string }> }
) {
    const session = await getServerSession(authOptions); // Use correct session retrieval
    // --- Authorization Check ---
    // TODO: Implement proper authorization if needed (e.g., checking roles if added later)
    if (!session) { // Basic auth check
       return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // -------------------------

    const userId = (await params).userId;

    if (!userId) {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            // Select only the fields needed for the edit form
            select: {
                id: true,
                name: true,
                email: true,
                createdAt: true,
                notificationsEnabled: true, // Include notification status
            }
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json(user);

    } catch (error) {
        console.error("Error fetching user details:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// --- PUT (Update User) ---
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ userId: string }> }
) {
     const session = await getServerSession(authOptions); // Use correct session retrieval
     // --- Authorization Check ---
     // TODO: Implement proper authorization if needed (e.g., checking roles if added later)
     if (!session) { // Basic auth check
       return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // -------------------------

    const userId = (await params).userId;
    if (!userId) {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    try {
        const body = await request.json();
        // Destructure new fields
        const { name, email, password, notificationsEnabled } = body;

        // Basic validation
        if (!name || !email || typeof notificationsEnabled !== 'boolean') {
            return NextResponse.json({ error: 'Name, Email, and Notification Preference are required' }, { status: 400 });
        }
        if (typeof name !== 'string' || typeof email !== 'string') {
             return NextResponse.json({ error: 'Invalid data types for name or email' }, { status: 400 });
        }
        // Password validation (only if provided)
        if (password && typeof password !== 'string') {
             return NextResponse.json({ error: 'Invalid data type for password' }, { status: 400 });
        }
        if (password && password.length < 8) {
             return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
        }

        // Prepare data for update
        const updateData: Prisma.UserUpdateInput = {
            name: name.trim(),
            email: email.trim(),
            notificationsEnabled: notificationsEnabled,
        };

        // Hash password if provided
        if (password) {
            const saltRounds = 10;
            updateData.password = await bcrypt.hash(password, saltRounds);
        }

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: updateData,
            select: { // Return relevant fields (exclude password hash)
                id: true,
                name: true,
                email: true,
                createdAt: true,
                notificationsEnabled: true,
            }
        });

        return NextResponse.json(updatedUser);

    } catch (error: any) {
        console.error("Error updating user:", error);
         // Handle potential unique constraint errors (e.g., email already exists)
        if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
            return NextResponse.json({ error: 'Email address is already in use.' }, { status: 409 }); // 409 Conflict
        }
        // Handle case where user to update is not found
        if (error.code === 'P2025') {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// --- DELETE User ---
export async function DELETE(
    request: Request, // Request object might not be needed but included for consistency
    { params }: { params: { userId: string } }
) {
    const session = await getServerSession(authOptions);
    // --- Authorization Check ---
    // TODO: Implement proper authorization if needed
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // -------------------------

    const userId = params.userId;
    if (!userId) {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // --- Prevent Self-Deletion ---
    if (session.user?.id === userId) {
        return NextResponse.json({ error: 'Cannot delete the currently logged-in user.' }, { status: 403 });
    }
    // ---------------------------

    try {
        await prisma.user.delete({
            where: { id: userId },
        });

        return NextResponse.json({ message: 'User deleted successfully' }, { status: 200 });

    } catch (error: any) {
        console.error("Error deleting user:", error);
        if (error.code === 'P2025') {
            // Prisma error code for "Record to delete does not exist."
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// --- Optional: DELETE User ---
// export async function DELETE(...) { ... } 