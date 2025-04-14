import { NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import bcrypt from 'bcryptjs';
import { z } from 'zod';

// Zod schema for input validation
const resetSchema = z.object({
  token: z.string().length(64, { message: "Invalid token format." }), // Expecting a 64-char hex string
  password: z.string().min(8, { message: "Password must be at least 8 characters long." }),
});

export async function POST(request: Request) {
    let payload;
    try {
        payload = await request.json();
    } catch (error) {
        return NextResponse.json({ error: 'Invalid JSON format' }, { status: 400 });
    }

    // Validate payload
    const validation = resetSchema.safeParse(payload);
    if (!validation.success) {
        return NextResponse.json({ error: 'Invalid input data', details: validation.error.flatten().fieldErrors }, { status: 400 });
    }
    const { token: plainToken, password } = validation.data;

    try {
        // 1. Find potential tokens by iterating (cannot directly query hashed token)
        // This is less efficient but necessary as we only have the plain token.
        // Consider alternative strategies for very high scale (e.g., different token structure).
        const potentialTokens = await prisma.passwordResetToken.findMany({
            where: {
                expires: { gt: new Date() } // Only consider non-expired tokens
            },
            include: { user: true } // Include user data
        });

        let validTokenRecord = null;
        for (const record of potentialTokens) {
            const isMatch = await bcrypt.compare(plainToken, record.token);
            if (isMatch) {
                validTokenRecord = record;
                break;
            }
        }

        // 2. Check if a valid, non-expired token was found
        if (!validTokenRecord) {
            return NextResponse.json({ error: 'Invalid or expired password reset token.' }, { status: 400 });
        }

        // 3. Hash the new password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // 4. Update the user's password
        await prisma.user.update({
            where: { id: validTokenRecord.userId },
            data: { password: hashedPassword },
        });

        // 5. Delete the used reset token (or all for that user)
        await prisma.passwordResetToken.delete({
            where: { id: validTokenRecord.id },
        });
        // Optionally delete all expired tokens for this user for cleanup:
        // await prisma.passwordResetToken.deleteMany({ where: { userId: validTokenRecord.userId } });

        // 6. Return success response
        return NextResponse.json({ message: 'Password successfully reset.' });

    } catch (error: any) {
        console.error("Error resetting password:", error);
         // Handle case where user associated with token doesn't exist anymore (should be rare)
        if (error.code === 'P2025') {
             return NextResponse.json({ error: 'User associated with token not found.' }, { status: 404 });
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
} 