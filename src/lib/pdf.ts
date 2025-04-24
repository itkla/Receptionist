import { PDFDocument, StandardFonts, rgb, degrees, PageSizes } from 'pdf-lib';
import { Shipment, Device, Location, Prisma } from '@prisma/client';
import QRCode from 'qrcode';

type ShipmentWithDevices = Shipment & {
    devices: Device[];
    location: Location;
    trackingId?: string | null;
    recipientEmail?: string | null;
    trackingInfo?: Prisma.JsonValue | null;
};

/**
 * Generates a Shipment Manifest PDF including a QR code linking to the receive URL.
 * @param shipment The shipment data including devices.
 * @param receiveUrl The URL to encode in the QR code (e.g., http://localhost:3000/receive/[shipmentId])
 * @returns A promise that resolves with the PDF bytes (Uint8Array).
 */
export async function generateManifestPdf(shipment: ShipmentWithDevices, receiveUrl: string): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.create();
    const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    let page = pdfDoc.addPage(PageSizes.Letter); // Use let instead of const
    const { width, height } = page.getSize();
    const fontSize = 10;
    const titleFontSize = 16;
    const margin = 50;
    let y = height - margin;

    // --- Generate QR Code ---
    let qrImageBytes: Uint8Array | null = null;
    try {
        const qrCodeDataUrl = await QRCode.toDataURL(receiveUrl, {
            errorCorrectionLevel: 'H',
            type: 'image/png',
            margin: 1,
            width: 100
        });
        // Correctly get the base64 part
        const base64Data = qrCodeDataUrl.split(',')[1];
        if (!base64Data) throw new Error("Invalid QR code data URL format");
        qrImageBytes = Buffer.from(base64Data, 'base64');
    } catch (err) {
        console.error('Failed to generate QR code for PDF:', err);
    }
    // --- End QR Code Generation ---

    // --- Embed QR Code ---
    let qrImageHeight = 0;
    if (qrImageBytes) {
        try {
            const qrImage = await pdfDoc.embedPng(qrImageBytes);
            qrImageHeight = qrImage.height;
            page.drawImage(qrImage, {
                x: width - margin - qrImage.width,
                y: height - margin - qrImage.height,
                width: qrImage.width,
                height: qrImage.height,
            });
        } catch (embedError) {
            console.error("Failed to embed QR code image:", embedError);
        }
    }
    // --- End Embed QR Code ---

    // --- PDF Content ---
    // Title
    page.drawText('Shipment Manifest', {
        x: margin,
        y: y,
        size: titleFontSize,
        font: timesRomanFont,
        color: rgb(0, 0, 0),
    });
    y -= titleFontSize * 1.5;

    // Subtitle / ID
    page.drawText(`Shipment ID: ${shipment.id}`, { x: margin, y: y, size: fontSize, font: timesRomanFont });
    y -= fontSize * 1.5;
    page.drawText(`Created: ${new Date(shipment.createdAt).toLocaleString()}`, { x: margin, y: y, size: fontSize, font: timesRomanFont });
    y -= fontSize * 1.5;

    // Draw a line
    y -= 5;
    page.drawLine({ start: { x: margin, y: y }, end: { x: width - margin, y: y }, thickness: 0.5, color: rgb(0.5, 0.5, 0.5) });
    y -= fontSize * 1.5;

    // Shipment Details Table
    const detailStartX = margin;
    const valueStartX = margin + 100;
    const drawDetail = (label: string, value: string | null | undefined) => {
        if (y < margin) { page = pdfDoc.addPage(PageSizes.Letter); y = height - margin; } // Correctly add new page
        page.drawText(`${label}:`, { x: detailStartX, y: y, size: fontSize, font: timesRomanFont, color: rgb(0.3, 0.3, 0.3) });
        page.drawText(value || 'N/A', { x: valueStartX, y: y, size: fontSize, font: timesRomanFont });
        y -= fontSize * 1.5;
    };

    drawDetail('Sender Name', shipment.senderName);
    drawDetail('Sender Email', shipment.senderEmail);
    drawDetail('Destination', shipment.location?.name);
    drawDetail('Status', shipment.status);
    // Use the updated type alias which includes trackingId
    if (shipment.trackingId) drawDetail('Tracking ID', shipment.trackingId);

    y -= fontSize;

    // Devices Header
    if (y < margin + fontSize) { page = pdfDoc.addPage(PageSizes.Letter); y = height - margin; }
    page.drawText('Device Manifest:', {
        x: margin,
        y: y,
        size: fontSize * 1.2,
        font: timesRomanFont,
        color: rgb(0, 0, 0),
    });
    y -= fontSize * 1.8;

    // Device List Table Header
    const headerY = y;
    const serialX = margin + 10;
    const assetTagX = serialX + 150;
    const modelX = assetTagX + 100;
    page.drawText('Serial Number', { x: serialX, y: headerY, size: fontSize, font: timesRomanFont, color: rgb(0.3, 0.3, 0.3) });
    page.drawText('Asset Tag', { x: assetTagX, y: headerY, size: fontSize, font: timesRomanFont, color: rgb(0.3, 0.3, 0.3) });
    page.drawText('Model', { x: modelX, y: headerY, size: fontSize, font: timesRomanFont, color: rgb(0.3, 0.3, 0.3) });
    y -= 5;
    page.drawLine({ start: { x: margin, y: y }, end: { x: width - margin, y: y }, thickness: 0.5, color: rgb(0.5, 0.5, 0.5) });
    y -= fontSize * 1.5;

    // Device List Items
    shipment.devices.forEach((device) => { // device type now correctly includes assetTag
        if (y < margin) {
            page = pdfDoc.addPage(PageSizes.Letter);
            y = height - margin;
        }
        page.drawText(device.serialNumber, { x: serialX, y: y, size: fontSize, font: timesRomanFont });
        if (device.assetTag) page.drawText(device.assetTag, { x: assetTagX, y: y, size: fontSize, font: timesRomanFont });
        if (device.model) page.drawText(device.model, { x: modelX, y: y, size: fontSize, font: timesRomanFont });
        y -= fontSize * 1.5;
    });

    // Add Footer
    const pages = pdfDoc.getPages();
    pages.forEach((currentPage, index) => { // Use different var name
        currentPage.drawText(`Page ${index + 1} of ${pages.length}`, {
            x: width / 2 - 30,
            y: margin / 2,
            size: fontSize * 0.8,
            font: timesRomanFont,
            color: rgb(0.5, 0.5, 0.5)
        });
    });
    // --- End PDF Content ---

    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
} 