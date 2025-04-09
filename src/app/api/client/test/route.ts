import { NextResponse } from 'next/server';
import { authenticateClientApiKey, ApiAuthError } from '@/lib/apiAuth';

/**
 * GET /api/client/shipments/test
 * 
 * Simple endpoint to test API key authentication.
 * Requires a valid 'x-receptionist-api' header.
 * 
 * @returns 200 OK with success message if authentication is successful.
 * @returns 401 Unauthorized or 500 Internal Server Error if authentication fails.
 */
export async function GET(request: Request) {
    try {
        // Authenticate the request using the helper
        const apiKey = await authenticateClientApiKey(request);

        // If authentication succeeds, return a success response
        return NextResponse.json(
            {
                message: 'API Key is valid and authenticated successfully.',
                keyDescription: apiKey.description // Optionally include key description
            },
            { status: 200 }
        );

    } catch (error) {
        // Handle specific authentication errors from the helper
        if (error instanceof ApiAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }

        // Handle unexpected errors
        console.error("Unexpected error during API key test:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
} 