import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { ApiKey } from '@prisma/client';
import { NextResponse } from 'next/server';

// Custom Error class for clearer error handling
export class ApiAuthError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.name = 'ApiAuthError';
        this.status = status;
    }
}

/**
 * Authenticates a request based on the 'x-receptionist-api' header.
 * Hashes the provided key and compares it against stored hashes.
 * 
 * @param request - The incoming NextRequest object.
 * @returns A Promise resolving to the authenticated ApiKey object (including description).
 * @throws {ApiAuthError} If authentication fails (missing header, invalid key, inactive key, db error).
 */
export async function authenticateClientApiKey(request: Request): Promise<ApiKey> {
    const apiKeyHeader = request.headers.get('x-receptionist-api');

    if (!apiKeyHeader) {
        console.warn("API Key authentication failed: Missing 'x-receptionist-api' header.");
        throw new ApiAuthError("Missing 'x-receptionist-api' header.", 401);
    }

    // Hash the *entire* key provided by the client, including any prefix
    const providedKey = apiKeyHeader; 

    try {
        const activeApiKeys = await prisma.apiKey.findMany({
            where: { isActive: true }
            // Selects all fields by default, including description and keyHash
        });

        if (activeApiKeys.length === 0) {
            console.warn("API Key authentication failed: No active API keys configured in the database.");
            throw new ApiAuthError("Invalid API Key.", 401); // Keep error generic for security
        }

        // Compare the provided key against each stored hash
        for (const keyRecord of activeApiKeys) {
            const match = await bcrypt.compare(providedKey, keyRecord.keyHash);
            if (match) {
                console.log(`API Key authentication successful for key ID: ${keyRecord.id}`);
                // Optionally update lastUsedAt (async, don't block return)
                prisma.apiKey.update({ 
                    where: { id: keyRecord.id }, 
                    data: { lastUsedAt: new Date() } 
                }).catch(err => console.error(`Failed to update lastUsedAt for key ${keyRecord.id}:`, err));
                
                return keyRecord; // Return the full ApiKey object
            }
        }

        // If no match was found after checking all active keys
        console.warn("API Key authentication failed: Provided key does not match any active keys.");
        throw new ApiAuthError("Invalid API Key.", 401); // Keep error generic

    } catch (error) {
        console.error("Error during API key lookup/comparison:", error);
        throw new ApiAuthError("API authentication failed due to server error.", 500); // Internal server error
    }
} 