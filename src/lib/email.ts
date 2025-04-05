import { Resend } from 'resend';
import { ReactElement } from 'react';
import { render } from '@react-email/render';
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

// Remove old constants and type alias if only used by deleted functions
// const FROM_EMAIL = ...
// const ADMIN_EMAIL = ...
// type ShipmentWithDevices = ...

// Remove old sendShipmentNotification function
// export async function sendShipmentNotification(...) { ... }

// Remove old sendNewShipmentEmails helper function
// export async function sendNewShipmentEmails(...) { ... }

// --- Main Email Sending Utility --- 
interface SendEmailOptions {
    to: string | string[];
    subject: string;
    react: ReactElement;
}

export const sendEmail = async ({ to, subject, react }: SendEmailOptions): Promise<{ success: boolean; message: string }> => {
    if (!resend || !fromEmail) {
        const message = "Email prerequisites (API Key or From Email) are not configured.";
        console.error("sendEmail failed:", message);
        return { success: false, message };
    }

    try {
        // Render the React component to HTML (this is synchronous)
        const html = render(react);

        const { data, error } = await resend.emails.send({
            from: fromEmail, // Use the validated fromEmail from env
            to: to,
            subject: subject,
            // @ts-expect-error Linter incorrectly assumes render() is async
            html: html,
        });

        if (error) {
            console.error(`Resend error sending email to ${Array.isArray(to) ? to.join(', ') : to}:`, error);
            return { success: false, message: error.message || 'Failed to send email via Resend.' };
        }

        console.log(`Email sent successfully to ${Array.isArray(to) ? to.join(', ') : to}. ID: ${data?.id}`);
        return { success: true, message: `Email sent successfully. ID: ${data?.id}` };

    } catch (error: any) {
        console.error(`Unexpected error in sendEmail to ${Array.isArray(to) ? to.join(', ') : to}:`, error);
        return { success: false, message: error.message || 'An unexpected error occurred during email sending.' };
    }
}; 