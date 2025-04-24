import React from 'react';
import { Shipment, Device, Location } from '@prisma/client';
import {
    Body,
    Container,
    Head,
    Heading,
    Hr,
    Html,
    Preview,
    Section,
    Text,
    Column,
    Row,
} from '@react-email/components';
import { format } from 'date-fns';

// Define needed types, including recipient info
type ReceivedShipmentData = Pick<Shipment, 'shortId' | 'senderName' | 'senderEmail' | 'receivedAt' | 'recipientName'> & {
    devices: Pick<Device, 'serialNumber' | 'model' | 'assetTag' | 'isCheckedIn'>[]; // Include isCheckedIn
    location: Pick<Location, 'name'> | null;
};

interface ShipmentReceivedNotificationProps {
    shipment: ReceivedShipmentData;
}

export const ShipmentReceivedNotification: React.FC<ShipmentReceivedNotificationProps> = ({ shipment }) => {
    const previewText = `Shipment Received: ${shipment.shortId}`;
    const receivedDevices = shipment.devices.filter(d => d.isCheckedIn);
    const missingDevices = shipment.devices.filter(d => !d.isCheckedIn);

    return (
        <Html>
            <Head />
            <Preview>{previewText}</Preview>
            <Body style={main}>
                <Container style={container}>
                    <Heading style={heading}>Shipment Received: {shipment.shortId}</Heading>
                    <Text style={paragraph}>
                        Shipment {shipment.shortId} from {shipment.senderName} to {shipment.location?.name ?? 'N/A'} 
                        was marked as received by <span style={{fontWeight: 'bold'}}>{shipment.recipientName}</span> 
                        on {shipment.receivedAt ? format(new Date(shipment.receivedAt), 'PPpp') : 'N/A'}.
                    </Text>
                    
                    {receivedDevices.length > 0 && (
                        <Section style={section}>
                            <Heading style={subHeading}>Received Devices ({receivedDevices.length})</Heading>
                            {receivedDevices.map(device => (
                                <Text key={device.serialNumber} style={listItem}>
                                    - {device.serialNumber} ({device.model || 'N/A'}, Asset: {device.assetTag || 'N/A'})
                                </Text>
                            ))}
                        </Section>
                    )}

                    {missingDevices.length > 0 && (
                         <Section style={sectionMissing}>
                            <Heading style={subHeadingMissing}>Missing/Unreceived Devices ({missingDevices.length})</Heading>
                            {missingDevices.map(device => (
                                <Text key={device.serialNumber} style={listItem}>
                                     - {device.serialNumber} ({device.model || 'N/A'}, Asset: {device.assetTag || 'N/A'})
                                </Text>
                            ))}
                        </Section>
                    )}
                     {missingDevices.length === 0 && receivedDevices.length > 0 && (
                         <Text style={paragraph}>All manifested devices were received.</Text>
                     )}

                    <Hr style={hr} />
                    <Text style={footer}>This is an automated notification from Receptionist.</Text>
                </Container>
            </Body>
        </Html>
    );
};

export default ShipmentReceivedNotification;

// --- Styles --- (Reuse styles from NewShipmentNotification, add specifics)
const main = { /* ... */ };
const container = { /* ... */ };
const heading = { /* ... */ };
const paragraph = { /* ... */ };
const hr = { /* ... */ };
const footer = { /* ... */ };
// Add or adjust styles
const subHeading = {
    fontSize: '18px',
    fontWeight: 'bold',
    marginBottom: '15px',
    color: '#1f2937', // Tailwind gray-800
};
const subHeadingMissing = {
    ...subHeading,
    color: '#DC2626', // Red-600 for missing section title
};
const section = {
    marginBottom: '24px',
};
const sectionMissing = {
    ...section,
    border: '1px solid #FCA5A5', // Red-300 border
    borderRadius: '5px',
    padding: '15px',
    backgroundColor: '#FEF2F2', // Red-50 background
};
const listItem = {
    fontSize: '14px',
    lineHeight: '20px',
    color: '#374151',
    marginBottom: '5px',
};