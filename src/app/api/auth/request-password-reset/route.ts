import { NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { Resend } from 'resend';
import { z } from 'zod';
import PasswordResetEmail from '@/emails/PasswordResetEmail';

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

const TOKEN_EXPIRY_MINUTES = 60; // Token valid for 1 hour

// Zod schema for input validation
const requestSchema = z.object({
  email: z.string().trim().email({ message: "Invalid email address." }),
});

export async function POST(request: Request) {
    // Check if Resend is configured
    if (!resend || !resendApiKey) {
        console.error("RESEND_API_KEY is not configured. Cannot send password reset email.");
        return NextResponse.json({ error: 'Email service is not configured. Password reset unavailable.' }, { status: 503 }); // 503 Service Unavailable
    }

    let payload;
    try {
        payload = await request.json();
    } catch (error) {
        return NextResponse.json({ error: 'Invalid JSON format' }, { status: 400 });
    }

    // Validate payload
    const validation = requestSchema.safeParse(payload);
    if (!validation.success) {
        return NextResponse.json({ error: 'Invalid input data', details: validation.error.flatten().fieldErrors }, { status: 400 });
    }
    const { email } = validation.data;

    try {
        // 1. Find user by email (case-insensitive recommended)
        const user = await prisma.user.findUnique({
            where: { email: email }, // Adjust query for case-insensitivity if needed in DB/Prisma setup
        });

        // --- Security Note: Don't reveal if the user exists --- 
        // Proceed whether user is found or not, but only perform actions if found.

        if (user) {
            // 2. Generate a secure random token (plain text)
            const plainToken = crypto.randomBytes(32).toString('hex');

            // 3. Hash the token for database storage
            const saltRounds = 10;
            const hashedToken = await bcrypt.hash(plainToken, saltRounds);

            // 4. Calculate expiry date
            const expires = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000);

            // 5. Store the *hashed* token in the database
            await prisma.passwordResetToken.create({
                data: {
                    userId: user.id,
                    token: hashedToken,
                    expires: expires,
                },
            });

            // 6. Construct the reset link
            const resetLink = `${process.env.NEXTAUTH_URL}/auth/reset-password/${plainToken}`;

            // 7. Send the email using Resend
            // Ensure PasswordResetEmail component exists and accepts props
            const { data, error } = await resend.emails.send({
                from: 'Password Reset <noreply@yourdomain.com>', // Replace with your verified Resend domain/email
                to: [user.email!], // Ensure email is not null
                subject: 'Reset Your Password',
                react: PasswordResetEmail({ userFirstName: user.name, resetPasswordLink: resetLink }),
            });

            if (error) {
                console.error("Resend failed to send email:", error);
                // Even if email fails, don't reveal user existence. Return generic success.
            }
            // Log success for monitoring if needed
             console.log(`Password reset email sent to ${user.email} (or attempted). Link: ${resetLink.replace(plainToken, '[REDACTED]')}`);
        }

        // 8. Always return a generic success message for security
        return NextResponse.json({ message: 'If an account with that email exists, a password reset link has been sent.' });

    } catch (error: any) {
        console.error("Error requesting password reset:", error);
        // Log the error but return a generic message to the user
        return NextResponse.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
        // Or, if you want to indicate a server error occurred without revealing user existence:
        // return NextResponse.json({ error: 'An internal error occurred. Please try again later.' }, { status: 500 }); 
    }
} 