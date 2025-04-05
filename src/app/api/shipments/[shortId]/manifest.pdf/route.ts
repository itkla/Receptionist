import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import fs from 'fs/promises';
import path from 'path';

export async function GET(
  request: Request,
  { params }: { params: { id: string } } // Shipment ID from route
) {
  try {
    const shipmentId = params.id;

    if (!shipmentId) {
      return NextResponse.json({ error: 'Shipment ID is required' }, { status: 400 });
    }

    // 1. Verify the shipment exists (optional but good practice)
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      select: { manifestUrl: true }, // Only need the URL
    });

    if (!shipment) {
      return NextResponse.json({ error: 'Shipment not found' }, { status: 404 });
    }

    if (!shipment.manifestUrl) {
        return NextResponse.json({ error: 'Manifest URL not found for this shipment. PDF might not have been generated.' }, { status: 404 });
    }

    // 2. Construct the file path
    // Assumes manifestUrl is stored as `/uploads/manifests/manifest-XYZ.pdf`
    const relativePath = shipment.manifestUrl;
    const filePath = path.join(process.cwd(), 'public', relativePath);

    // 3. Read the file
    try {
        const fileBuffer = await fs.readFile(filePath);

        // 4. Return the file as response
        return new NextResponse(fileBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="manifest-${shipmentId}.pdf"`, // Suggest filename, display inline
            },
        });
    } catch (fileError: any) {
        if (fileError.code === 'ENOENT') {
            console.error(`Manifest file not found at path: ${filePath}`);
            return NextResponse.json({ error: 'Manifest file not found on server.' }, { status: 404 });
        } else {
            console.error(`Error reading manifest file: ${filePath}`, fileError);
            throw fileError; // Re-throw other errors
        }
    }

  } catch (error) {
    console.error("Error serving manifest PDF:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 