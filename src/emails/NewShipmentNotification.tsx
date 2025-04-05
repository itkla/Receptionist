import React from 'react';
import { Shipment, Device, Location } from '@prisma/client';
import {
    Body,
    Button,
    Container,
    Head,
    Heading,
    Hr,
    Html,
    Img,
    Link,
    Preview,
    Section,
    Text,
    Column,
    Row,
} from '@react-email/components';
import { format } from 'date-fns';

interface NewShipmentNotificationProps {
    shipment: Shipment & { devices: Pick<Device, 'serialNumber' | 'model'>[], location: Location | null };
    adminBaseUrl: string; // e.g., http://localhost:3000
}

const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : ''; // Or use your adminBaseUrl

export const NewShipmentNotification: React.FC<NewShipmentNotificationProps> = ({ 
    shipment, 
    adminBaseUrl 
}) => {
    const previewText = `New Shipment Created: ${shipment.shortId}`;
    // Optional: Generate a direct link to the shipment detail view if available
    // const shipmentUrl = `${adminBaseUrl}/shipment/${shipment.shortId}`; 

    return (
        <Html>
            <Head />
            <Preview>{previewText}</Preview>
            <Body style={main}>
                <Container style={container}>
                    {/* Optional: Add Logo */}
                    {/* <Img src={`${baseUrl}/static/logo.png`} width="40" height="33" alt="Logo" /> */}
                    <Heading style={heading}>New Shipment Created: {shipment.shortId}</Heading>
                    <Text style={paragraph}>A new shipment manifest has been generated.</Text>
                    
                    <Section style={detailsSection}>
                        <Row style={detailRow}>
                            <Column style={detailLabel}>Shipment ID:</Column>
                            <Column style={detailValue}>{shipment.shortId}</Column>
                        </Row>
                        <Row style={detailRow}>
                            <Column style={detailLabel}>Created At:</Column>
                            <Column style={detailValue}>{format(new Date(shipment.createdAt), 'PPpp')}</Column>
                        </Row>
                        <Row style={detailRow}>
                            <Column style={detailLabel}>Sender:</Column>
                            <Column style={detailValue}>{shipment.senderName} ({shipment.senderEmail})</Column>
                        </Row>
                        <Row style={detailRow}>
                            <Column style={detailLabel}>Destination:</Column>
                            <Column style={detailValue}>{shipment.location?.name ?? 'N/A'}</Column>
                        </Row>
                         {shipment.trackingNumber && (
                            <Row style={detailRow}>
                                <Column style={detailLabel}>Tracking #:</Column>
                                <Column style={detailValue}>{shipment.trackingNumber}</Column>
                            </Row>
                        )}
                         <Row style={detailRow}>
                            <Column style={detailLabel}>Device Count:</Column>
                            <Column style={detailValue}>{shipment.devices.length}</Column>
                        </Row>
                    </Section>

                    {/* Optional: Link to view shipment */}
                    {/* 
                    <Section style={{ textAlign: 'center', marginTop: '26px', marginBottom: '26px' }}>
                        <Button pX={20} pY={12} style={button} href={shipmentUrl}>
                            View Shipment Details
                        </Button>
                    </Section>
                    */}

                    <Hr style={hr} />
                    <Text style={footer}>This is an automated notification from Receptionist.</Text>
                </Container>
            </Body>
        </Html>
    );
};

export default NewShipmentNotification;

// --- Styles --- (Inspired by Vercel emails)
const main = {
    backgroundColor: '#ffffff',
    fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
};

const container = {
    margin: '0 auto',
    padding: '20px 0 48px',
    width: '580px',
};

const heading = {
    fontSize: '28px',
    fontWeight: 'bold',
    marginTop: '48px',
    marginBottom: '20px',
    color: '#111827', // Tailwind gray-900
};

const paragraph = {
    fontSize: '16px',
    lineHeight: '24px',
    color: '#374151', // Tailwind gray-700
    marginBottom: '24px',
};

const detailsSection = {
    border: '1px solid #e5e7eb', // Tailwind gray-200
    borderRadius: '5px',
    padding: '20px',
    marginBottom: '24px',
    backgroundColor: '#f9fafb', // Tailwind gray-50
};

const detailRow = {
    marginBottom: '10px',
};

const detailLabel = {
    fontSize: '14px',
    color: '#6b7280', // Tailwind gray-500
    width: '120px',
    paddingRight: '10px',
    fontWeight: '500',
};

const detailValue = {
    fontSize: '14px',
    color: '#1f2937', // Tailwind gray-800
};

const hr = {
    borderColor: '#e5e7eb', // Tailwind gray-200
    margin: '20px 0',
};

const footer = {
    color: '#9ca3af', // Tailwind gray-400
    fontSize: '12px',
    lineHeight: '24px',
};

const button = {
    backgroundColor: '#000000', // Black background
    borderRadius: '5px',
    color: '#ffffff', // White text
    fontSize: '12px',
    fontWeight: '500',
    lineHeight: '50px',
    textDecoration: 'none',
    textAlign: 'center' as const,
}; 