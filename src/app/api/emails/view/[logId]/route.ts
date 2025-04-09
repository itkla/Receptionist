import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Note: No session check here for simplicity, relies on unguessable logId.
// Add authentication if viewing emails requires login.

export async function GET(
    request: Request,
    { params }: { params: Promise<{ logId: string }> }
) {
    const logId = (await params).logId;

    if (!logId) {
        return NextResponse.json({ error: 'Missing email log ID' }, { status: 400 });
    }

    try {
        const emailLog = await prisma.emailLog.findUnique({
            where: { id: logId },
            select: { 
                htmlContent: true, 
                subject: true, 
                sentAt: true 
            } // Select only needed fields
        });

        if (!emailLog) {
            return NextResponse.json({ error: 'Email log not found' }, { status: 404 });
        }

        // Return the HTML content directly (or the whole log object)
        // Sending HTML directly in JSON is fine, but can be large.
        // Consider if just the content is needed or more metadata.
        return NextResponse.json(emailLog);

    } catch (error) {
        console.error(`Error fetching email log ${logId}:`, error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
} 