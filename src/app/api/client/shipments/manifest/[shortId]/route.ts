import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { stat } from 'fs/promises'; // Import stat for checking file existence

export async function GET(
    request: Request,
    { params }: { params: { shortId: string } }
) {
    const shortId = params.shortId;

    if (!shortId) {
        return NextResponse.json({ error: 'Missing shipment shortId' }, { status: 400 });
    }

    console.log(`Manifest request: Received request for shortId: ${shortId}`);

    try {
        // Construct the expected file path
        const manifestsDir = path.join(process.cwd(), '.temp', 'manifests');
        const filePath = path.join(manifestsDir, `manifest-${shortId}.pdf`);

        // Check if the file exists first using stat
        try {
            await stat(filePath);
            console.log(`Manifest request: Found manifest file at: ${filePath}`);
        } catch (statError: any) {
            // If stat fails, the file likely doesn't exist (ENOENT)
            if (statError.code === 'ENOENT') {
                console.warn(`Manifest request: Manifest file not found for shortId ${shortId} at path ${filePath}`);
                return NextResponse.json({ error: 'Manifest not found.' }, { status: 404 });
            }
            // Re-throw other stat errors
            throw statError;
        }

        // Read the file content
        const fileBuffer = await fs.readFile(filePath);
        console.log(`Manifest request: Read ${fileBuffer.length} bytes from ${filePath}`);

        // Return the file content as a PDF response
        return new Response(fileBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                // Optional: Add content disposition to suggest filename
                // 'Content-Disposition': `inline; filename="manifest-${shortId}.pdf"`, 
                // Optional: Add cache control headers
                'Cache-Control': 'private, max-age=600', // Cache for 10 minutes
            },
        });

    } catch (error: any) {
        console.error(`Manifest request: Error retrieving manifest for shortId ${shortId}:`, error);

        // Handle potential file system errors more specifically if needed
        if (error.code === 'ENOENT') { // Double-check just in case stat passed but readFile failed
             return NextResponse.json({ error: 'Manifest not found.' }, { status: 404 });
        }

        return NextResponse.json({ error: 'Internal Server Error retrieving manifest.' }, { status: 500 });
    }
}
