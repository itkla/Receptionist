import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ShipmentManifestPDF } from '@/components/pdf/ShipmentManifestPDF'; // Adjust path if needed
import { renderToStream } from '@react-pdf/renderer';
import qrcode from 'qrcode'; // Core qrcode library

interface RouteParams {
    params: {
        shortId: string;
    }
}

// GET /manifest/[shortId]
export async function GET(request: Request, { params }: RouteParams) {
    const { shortId } = params;

    if (!shortId) {
        return new NextResponse('Missing Shipment Short ID', { status: 400 });
    }

    try {
        // 1. Fetch shipment data including related models
        const shipment = await prisma.shipment.findUnique({
            where: { shortId: shortId },
            include: {
                devices: true, // Include devices
                location: true, // Include location details
            },
        });

        if (!shipment) {
            return new NextResponse('Shipment not found', { status: 404 });
        }

        // 2. Generate QR Code Data URL
        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'; // Get base URL safely
        const qrTargetUrl = `${baseUrl}/receive/${shipment.shortId}`;
        let qrDataUrl: string | null = null;
        try {
            qrDataUrl = await qrcode.toDataURL(qrTargetUrl);
        } catch (qrError) {
            console.error(`Error generating QR code for ${shortId}:`, qrError);
            // Proceed without QR code if generation fails
        }

        // 3. Render PDF to stream
        const pdfStream = await renderToStream(
            <ShipmentManifestPDF shipment={shipment} qrDataUrl={qrDataUrl} />
        );

        // Ensure pdfStream is a ReadableStream
        if (!(pdfStream instanceof ReadableStream)) {
             throw new Error('Failed to generate PDF stream.');
        }

        // 4. Return the stream as a PDF response
        return new NextResponse(pdfStream, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="manifest-${shortId}.pdf"`, // Suggest filename
            },
        });

    } catch (error) {
        console.error(`Error generating manifest PDF for ${shortId}:`, error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
} 