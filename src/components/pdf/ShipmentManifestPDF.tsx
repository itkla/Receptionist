import React from 'react';
import { Page, Text, View, Document, StyleSheet, Font, Image } from '@react-pdf/renderer';
import { Shipment, Device, Location, ShipmentStatus } from '@prisma/client';
import { format } from 'date-fns'; // Or your preferred date formatting library

// --- Types --- 
// Define a base type that matches the structure expected by the component
// including potential nulls based on usage patterns
interface PdfShipmentData {
    id: string;
    shortId: string;
    status: ShipmentStatus; // Use enum for status
    createdAt: Date | string; // Allow string or Date
    updatedAt: Date | string;
    senderName: string;
    senderEmail: string;
    locationId: string | null; // Allow null
    location: Location | null;
    recipientName?: string | null;
    recipientEmail?: string | null;
    recipientSignature?: string | null;
    receivedAt?: Date | string | null; // Allow string or Date
    devices: Device[];
    trackingNumber?: string | null;
    trackingId?: string | null;
    trackingInfo?: any | null;
}

// Remove the intersection type (&) to avoid conflicts with potentially stricter Prisma types
type ShipmentManifestData = PdfShipmentData;

interface ShipmentManifestPDFProps {
    shipment: ShipmentManifestData;
    qrDataUrl: string | null; // Expect the generated Data URL or null
}

// --- Styling --- 
// Register fonts if needed (example)
// Font.register({
//   family: 'Inter', 
//   fonts: [
//     { src: '/path/to/Inter-Regular.ttf' }, // Provide paths to font files
//     { src: '/path/to/Inter-Bold.ttf', fontWeight: 'bold' },
//   ]
// });

const styles = StyleSheet.create({
    page: {
        flexDirection: 'column',
        backgroundColor: '#FFFFFF',
        padding: 40, // Increased padding for more whitespace
        // fontFamily: 'Inter', // Apply registered font
        fontSize: 9, // Slightly smaller base font size
        color: '#222',
    },
    header: {
        fontSize: 20, // Larger header
        fontWeight: 'bold',
        marginBottom: 25,
        textAlign: 'left', // Left align header
        color: '#000',
    },
    twoColumnLayout: {
        flexDirection: 'row',
        marginBottom: 20,
        gap: 20, // Add gap between columns
    },
    leftColumn: {
        width: '60%', // Adjust width as needed
        flexDirection: 'column',
    },
    rightColumn: {
        width: '40%', // Adjust width as needed
        flexDirection: 'column',
        alignItems: 'center', // Center QR code horizontally
        justifyContent: 'flex-start', // Align QR code to top
        paddingTop: 10, // Add some padding above QR code
    },
    qrCodeContainer: {
         // Add border or background if desired
         // borderWidth: 1,
         // borderColor: '#eee',
         // padding: 10,
    },
    section: {
        marginBottom: 20, // Increased space between sections
    },
    sectionTitle: {
        fontSize: 12, // Slightly smaller section title
        fontWeight: 'bold',
        marginBottom: 10, // More space after title
        // Removed borderBottomWidth
        paddingBottom: 0, 
        color: '#444',
        textAlign: 'left', // Ensure left alignment
    },
    detailRow: {
        flexDirection: 'row',
        marginBottom: 5, // Increased spacing
    },
    detailLabel: {
        fontWeight: 'bold',
        width: 85, // Slightly adjusted width
    },
    detailValue: {
        flexGrow: 1,
        flexShrink: 1, // Allow text to wrap
    },
    table: {
        width: 'auto',
        // Removed table border
        marginTop: 5,
    },
    tableRow: {
        flexDirection: 'row',
        // Removed table row border
        alignItems: 'center',
        minHeight: 20,
        paddingVertical: 4, // Add vertical padding for row spacing
        // Add alternating background for readability if desired
        // backgroundColor: index % 2 === 0 ? '#f9f9f9' : '#ffffff',
    },
    tableColHeader: {
        backgroundColor: 'transparent', // Removed header background
        padding: 4, // Adjust padding
        fontWeight: 'bold',
        textAlign: 'left', // Left align headers
        // Removed borders
    },
    tableCol: {
        padding: 4, // Adjust padding
        // Removed borders
    },
    colSerial: { width: '35%' },
    colAsset: { width: '25%' },
    colModel: { width: '25%' },
    colCheckedIn: { width: '15%', textAlign: 'left' }, // Left align check-in time
});

// --- PDF Document Component --- 
export const ShipmentManifestPDF: React.FC<ShipmentManifestPDFProps> = ({ shipment, qrDataUrl }) => {
    const qrSize = 128;

    // Helper function to safely format dates
    const formatDate = (date: Date | string | null | undefined): string => {
        if (!date) return 'N/A';
        try {
            return format(new Date(date), 'PPp'); // Use consistent format
        } catch (e) {
            console.error("Error formatting date:", date, e);
            return 'Invalid Date';
        }
    };

    const formatShortDate = (date: Date | string | null | undefined): string => {
        if (!date) return '-';
        try {
            return format(new Date(date), 'Pp'); // Use shorter format
        } catch (e) {
            console.error("Error formatting short date:", date, e);
            return 'Invalid';
        }
    };

    return (
        <Document title={`Shipment Manifest - ${shipment.shortId}`}>
            <Page size="A4" style={styles.page}>
                {/* Header Section */}
                {/* Wrap Image and Text in a View with row direction */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 25 /* Adjust spacing as needed */ }}>
                    <Image src='/receptionist_logo.png' style={{ width: 25, height: 25, marginRight: 8 /* Space between image and text */ }} /> 
                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#000' }}>Receptionist</Text>
                </View>
                
                {/* Original Header Text - You might want to remove or adjust this if the logo serves as the header */}
                <Text style={styles.header}>Shipment Manifest</Text> 

                {/* Two Column Layout */}
                <View style={styles.twoColumnLayout}>
                    {/* Left Column: Shipment Details */}
                    <View style={styles.leftColumn}>
                        {/* <Text style={styles.sectionTitle}>Shipment Details</Text> */}
                        <View style={styles.detailRow}><Text style={styles.detailLabel}>Shipment ID:</Text><Text style={styles.detailValue}>{shipment.shortId}</Text></View>
                        <View style={styles.detailRow}><Text style={styles.detailLabel}>Status:</Text><Text style={styles.detailValue}>{shipment.status}</Text></View>
                        <View style={styles.detailRow}><Text style={styles.detailLabel}>Created:</Text><Text style={styles.detailValue}>{formatDate(shipment.createdAt)}</Text></View>
                        <View style={styles.detailRow}><Text style={styles.detailLabel}>Sender:</Text><Text style={styles.detailValue}>{shipment.senderName} ({shipment.senderEmail})</Text></View>
                        <View style={styles.detailRow}><Text style={styles.detailLabel}>Location:</Text><Text style={styles.detailValue}>{shipment.location?.name ?? 'N/A'}</Text></View>
                        {shipment.trackingNumber && (<View style={styles.detailRow}><Text style={styles.detailLabel}>Tracking #:</Text><Text style={styles.detailValue}>{shipment.trackingNumber}</Text></View>)}
                        {shipment.receivedAt && (<View style={styles.detailRow}><Text style={styles.detailLabel}>Received At:</Text><Text style={styles.detailValue}>{formatDate(shipment.receivedAt)}</Text></View>)}
                        {shipment.recipientName && (<View style={styles.detailRow}><Text style={styles.detailLabel}>Received By:</Text><Text style={styles.detailValue}>{shipment.recipientName}</Text></View>)}
                        {shipment.recipientSignature && (<View style={styles.detailRow}><Text style={styles.detailLabel}>Signature:</Text><Image src={shipment.recipientSignature} style={{ height: 50 }}></Image></View>)}
                    </View>
                    {/* Right Column: QR Code */}
                    <View style={styles.rightColumn}>
                         <View style={styles.qrCodeContainer}>
                             {qrDataUrl ? (
                                <Image src={qrDataUrl} style={{ width: qrSize, height: qrSize }} />
                             ) : (
                                 <Text style={{ color: 'grey', fontSize: 8 }}>QR not available</Text>
                             )}
                         </View>
                         <Text style={[styles.sectionTitle, { marginBottom: 10 }]}>Scan to Receive</Text>
                    </View>
                </View>
                {/* Devices Section (Full Width Below Columns) */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Devices ({shipment.devices.length})</Text>
                    <View style={styles.table}>
                        {/* Table Header */}
                        <View style={styles.tableRow}>
                            <Text style={[styles.tableColHeader, styles.colSerial]}>Serial Number</Text>
                            <Text style={[styles.tableColHeader, styles.colAsset]}>Asset Tag</Text>
                            <Text style={[styles.tableColHeader, styles.colModel]}>Model</Text>
                            <Text style={[styles.tableColHeader, styles.colCheckedIn]}>Checked-In Time</Text>
                        </View>
                        {/* Table Body */}
                        {shipment.devices.map((device, index) => (
                            <View key={device.id} style={[styles.tableRow, { backgroundColor: index % 2 === 0 ? '#FAFAFA' : '#FFFFFF' }]}>
                                <Text style={[styles.tableCol, styles.colSerial]}>{device.serialNumber}</Text>
                                <Text style={[styles.tableCol, styles.colAsset]}>{device.assetTag || '-'}</Text>
                                <Text style={[styles.tableCol, styles.colModel]}>{device.model || '-'}</Text>
                                <Text style={[styles.tableCol, styles.colCheckedIn]}>
                                    {formatShortDate(device.checkedInAt)}
                                </Text>
                            </View>
                        ))}
                         {shipment.devices.length === 0 && (
                            <View style={styles.tableRow}>
                                <Text style={[styles.tableCol, { width: '100%', textAlign: 'center', paddingVertical: 10 }]}>No devices listed for this shipment.</Text>
                            </View>
                         )}
                    </View>
                </View>
            </Page>
        </Document>
    );
}; 