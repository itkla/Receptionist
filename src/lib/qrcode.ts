import QRCode from 'qrcode';

/**
 * Generates a QR code as a Base64 encoded data URL.
 * @param text The text or URL to encode in the QR code.
 * @returns A promise that resolves with the data URL string.
 */
export async function generateQrCodeDataUrl(text: string): Promise<string> {
    try {
        const dataUrl = await QRCode.toDataURL(text, {
            errorCorrectionLevel: 'H', // High error correction
            type: 'image/png',
            margin: 1, // Minimal margin
            // width: 200 // Optional: specify width
        });
        return dataUrl;
    } catch (err) {
        console.error('Error generating QR code:', err);
        throw new Error('Failed to generate QR code');
    }
} 