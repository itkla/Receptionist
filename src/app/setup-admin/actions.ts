'use server';

import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

interface CreateAdminUserInput {
    name: string;
    email: string;
    password: string;
}

interface ActionResult {
    success: boolean;
    error?: string;
}

export async function createAdminUser(input: CreateAdminUserInput): Promise<ActionResult> {
    try {
        const userCount = await prisma.user.count();
        if (userCount > 0) {
            console.warn("Attempted to create admin user when users already exist.");
            return { success: false, error: 'An administrator account already exists.' };
        }

        if (!input.name || !input.email || !input.password) {
            return { success: false, error: 'Missing required fields.' };
        }

        if (!/\S+@\S+\.\S+/.test(input.email)) {
            return { success: false, error: 'Invalid email format.' };
        }

        if (input.password.length < 8) {
            return { success: false, error: 'Password must be at least 8 characters long.' };
        }

        const hashedPassword = await bcrypt.hash(input.password, SALT_ROUNDS);

        await prisma.user.create({
            data: {
                name: input.name,
                email: input.email,
                password: hashedPassword,
            },
        });

        console.log(`Successfully created initial admin user: ${input.email}`);
        return { success: true };

    } catch (error: any) {
        console.error("Error creating admin user:", error);

        if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
            return { success: false, error: 'An account with this email already exists.' };
        }

        return { success: false, error: 'Failed to create administrator account due to a server error.' };
    }
} 