import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateClientApiKey, ApiAuthError } from '@/lib/apiAuth'; // Reuse authentication

export async function GET(
    request: Request,
    { params }: { params: { shortId: string } }
) {
    const shortId = params.shortId?.toUpperCase(); // Normalize shortId

    if (!shortId) {
        return NextResponse.json({ error: 'Missing shipment shortId' }, { status: 400 });
    }

    console.log(`Client shipment query: Request for shortId: ${shortId}`);

    try {
        // 1. Authenticate API Key
        // Ensure the client provides a valid API key to access shipment details
        const apiKeyData = await authenticateClientApiKey(request);
        console.log(`Client shipment query: Authenticated API key: ${apiKeyData.description ?? apiKeyData.id}`);

        // 2. Fetch Shipment Data
        const shipment = await prisma.shipment.findUnique({
            where: { shortId: shortId },
            include: {
                location: true, // Include location details
                devices: true,  // Include associated devices
                // You can include other relations if needed by the client
            },
        });

        // 3. Handle Not Found
        if (!shipment) {
            console.warn(`Client shipment query: Shipment not found for shortId: ${shortId}`);
            return NextResponse.json({ error: 'Shipment not found' }, { status: 404 });
        }

        console.log(`Client shipment query: Found shipment ${shipment.shortId}`);

        // 4. Return Shipment Data
        // Consider what specific fields the client needs.
        // Returning the full Prisma object might expose too much.
        // For now, returning the fetched object. Refine as needed.
        return NextResponse.json(shipment, { status: 200 });

    } catch (error: any) {
        // Handle authentication errors first
        if (error instanceof ApiAuthError) {
            console.error(`Client shipment query: Authentication error for ${shortId}:`, error.message);
            return NextResponse.json({ error: error.message }, { status: error.status });
        }

        // Handle other unexpected errors
        console.error(`Client shipment query: Unexpected error for shortId ${shortId}:`, error);
        return NextResponse.json({ error: 'Internal Server Error retrieving shipment.' }, { status: 500 });
    }
}