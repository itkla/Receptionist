import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ShipmentManifestPDF } from '@/components/pdf/ShipmentManifestPDF';
import { renderToStream } from '@react-pdf/renderer';
import qrcode from 'qrcode';

interface RouteParams {
    params: {
        shortId: string;
    }
}

// GET /manifest/[shortId]
export async function GET(
    request: Request, 
    { params }: { params: Promise<{ shortId: string }> }
) {
    const shortId = (await params).shortId;

    if (!shortId) {
        return new NextResponse('Missing Shipment Short ID', { status: 400 });
    }

    try {
        const shipment = await prisma.shipment.findUnique({
            where: { shortId: shortId },
            include: {
                devices: true,
                location: true,
            },
        });

        if (!shipment) {
            return new NextResponse('Shipment not found', { status: 404 });
        }

        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
        const qrTargetUrl = `${baseUrl}/receive/${shipment.shortId}`;
        let qrDataUrl: string | null = null;
        try {
            qrDataUrl = await qrcode.toDataURL(qrTargetUrl);
        } catch (qrError) {
            console.error(`Error generating QR code for ${shortId}:`, qrError);
        }

        const pdfStream = await renderToStream(
            <ShipmentManifestPDF shipment={shipment} qrDataUrl={qrDataUrl} />
        );

        if (!(pdfStream instanceof ReadableStream)) {
             throw new Error('Failed to generate PDF stream.');
        }

        return new NextResponse(pdfStream, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="manifest-${shortId}.pdf"`,
            },
        });

    } catch (error) {
        console.error(`Error generating manifest PDF for ${shortId}:`, error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
} 