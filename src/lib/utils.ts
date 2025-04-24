import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { ShipmentStatus } from "@prisma/client";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function getStatusBadgeVariant(status: ShipmentStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
    switch (status) {
        case ShipmentStatus.PENDING:
            return 'outline';
        case ShipmentStatus.IN_TRANSIT:
            return 'secondary';
        case ShipmentStatus.DELIVERED:
            return 'secondary';
        case ShipmentStatus.RECEIVING:
            return 'default';
        case ShipmentStatus.RECEIVED:
            return 'default';
        case ShipmentStatus.COMPLETED:
            return 'default';
        case ShipmentStatus.CANCELLED:
            return 'destructive';
        default:
            return 'outline';
    }
}

/**
 * Generates a random string of specified length using uppercase letters.
 * @param length The desired length of the ID (default: 6).
 * @returns A random uppercase string.
 */
export function generateShortId(length = 6): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}