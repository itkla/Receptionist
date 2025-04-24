import { Resend } from 'resend';
import { ReactElement } from 'react';
import { render } from '@react-email/render';
import React from 'react';
import { prisma } from './prisma';
import cuid2 from "@paralleldrive/cuid2";
// Removed unused Prisma types import if they were only for old functions

const resendApiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.RESEND_FROM_EMAIL;

if (!resendApiKey) {
    console.warn("Resend API Key (RESEND_API_KEY) is not set. Email sending will be disabled.");
}
if (!fromEmail) {
    console.warn("Resend From Email (RESEND_FROM_EMAIL) is not set. Email sending will be disabled.");
}

const resend = resendApiKey ? new Resend(resendApiKey) : null;

// --- Main Email Sending Utility --- 
interface EmailPayload {
    to: string | string[];
    subject: string;
    react: React.ReactElement;
    shipmentId?: string;
    emailType?: string;
}

export const sendEmail = async ({
    to,
    subject,
    react,
    shipmentId,
    emailType
}: EmailPayload) => {
    if (!resend || !fromEmail) {
        const message = "Email prerequisites (API Key or From Email) are not configured.";
        console.error("sendEmail failed:", message);
        return;
    }

    const emailLogId = cuid2.createId();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const viewUrl = `${appUrl}/emails/view/${emailLogId}`;

    let html = '';
    try {
        const emailComponentWithLink = React.cloneElement(react as React.ReactElement<{ viewUrl?: string }>, { viewUrl });
        html = await render(emailComponentWithLink);

        const { data, error } = await resend.emails.send({
            from: process.env.EMAIL_FROM || 'Concierge <noreply@yourdomain.com>',
            to: typeof to === 'string' ? [to] : to,
            subject: subject,
            html: html,
        });

        if (error) {
            console.error(`Resend error sending email to ${Array.isArray(to) ? to.join(', ') : to}:`, error);
            // Log failed attempt with the pre-generated ID
            await logEmailAttempt(emailLogId, to, subject, html, shipmentId, emailType, "FAILED");
            throw error;
        }

        console.log(`Email sent successfully to ${Array.isArray(to) ? to.join(', ') : to}. ID: ${data?.id}`);
        await logEmailAttempt(emailLogId, to, subject, html, shipmentId, emailType, "SENT");

        return data;

    } catch (error: any) {
        console.error(`Unexpected error in sendEmail to ${Array.isArray(to) ? to.join(', ') : to}:`, error);
        // Log attempt even if rendering or sending fails
        await logEmailAttempt(emailLogId, to, subject, html || "<RenderError>", shipmentId, emailType, "FAILED");
        throw error;
    }
};

// Helper function to log email attempts to the database
async function logEmailAttempt(
    logId: string, // Accept pre-generated ID
    to: string | string[],
    subject: string,
    htmlContent: string,
    shipmentId?: string,
    emailType?: string,
    status?: string // Optional status
) {
    if (!emailType) {
        console.warn("Skipping email log: emailType is missing.");
        return;
    }
    
    try {
        await prisma.emailLog.create({
            data: {
                id: logId, // Use the pre-generated ID
                shipmentId: shipmentId,
                emailType: emailType || 'UNKNOWN',
                recipient: Array.isArray(to) ? to.join(', ') : to,
                subject: subject,
                htmlContent: htmlContent,
            }
        });
        console.log(`Email attempt logged: ${emailType} to ${Array.isArray(to) ? to.join(', ') : to} (Log ID: ${logId})`);
    } catch (logError) {
        console.error(`Failed to log email attempt (Log ID: ${logId}):`, logError);
    }
} 