"use server";

import bcrypt from 'bcrypt';
import { prisma } from '@/lib/prisma';

const SALT_ROUNDS = 10;

/**
 * Generates a new API key (plain text) and its hash.
 * @param description Optional description for the key.
 * @returns Promise resolving to { apiKey: string, keyHash: string }
 */
export async function generateApiKey(description?: string): Promise<{ apiKey: string; keyHash: string }> {
    // Generate 32 random bytes using the Web Crypto API
    const randomBytesArray = new Uint8Array(32);
    // Use global crypto object available in Node, Edge, and Browsers
    globalThis.crypto.getRandomValues(randomBytesArray);

    // Convert the bytes to a hex string
    const apiKey = Array.from(randomBytesArray).map(b => b.toString(16).padStart(2, '0')).join('');

    const keyHash = await bcrypt.hash(apiKey, SALT_ROUNDS);

    return { apiKey, keyHash };
}

/**
 * Validates a plain text API key against stored hashes.
 * @param plainTextKey The key provided in the request header.
 * @returns Promise resolving to the active ApiKey object if valid, otherwise null.
 */
export async function validateApiKey(plainTextKey: string): Promise<{ id: string; description: string | null } | null> {
    if (!plainTextKey) {
        return null;
    }

    // Fetch all active API key hashes using standard camelCase
    const activeKeys = await prisma.apiKey.findMany({
        where: { isActive: true },
        select: { id: true, keyHash: true, description: true },
    });

    for (const keyRecord of activeKeys) {
        const isValid = await bcrypt.compare(plainTextKey, keyRecord.keyHash);
        if (isValid) {
            // Optional: Update lastUsedAt using standard camelCase
            prisma.apiKey.update({ where: { id: keyRecord.id }, data: { lastUsedAt: new Date() } }).catch(console.error);
            return { id: keyRecord.id, description: keyRecord.description };
        }
    }

    return null; // No valid key found
} 