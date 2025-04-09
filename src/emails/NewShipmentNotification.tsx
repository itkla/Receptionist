import React from 'react';
import { Shipment, Location, ShipmentStatus } from '@prisma/client'; // Import necessary Prisma types
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

// Define simplified props for the email - NO device details
interface NewShipmentNotificationProps {
    shipment: {
        id: string;
        shortId: string;
        createdAt: Date | string;
        senderName: string;
        // senderEmail is NOT displayed
        location: { name: string } | null; // Only need location name
        devices: unknown[]; // Only need the length, so type can be simplified
        trackingNumber?: string | null;
    };
    adminBaseUrl: string;
}

// Base URL for potential images if hosted
const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';

export const NewShipmentNotification: React.FC<NewShipmentNotificationProps> = ({ 
    shipment, 
    adminBaseUrl 
}) => {
    const previewText = `New Shipment Created: ${shipment.shortId}`;
    // Link to view shipment details in the admin dashboard
    const shipmentUrl = `${adminBaseUrl}/?search=${shipment.shortId}`; // Link to dashboard filtered by ID

    // Helper to format dates safely
    const formatDate = (date: Date | string | null | undefined): string => {
        if (!date) return 'N/A';
        try {
            return format(new Date(date), 'PPp');
        } catch (e) {
            return 'Invalid Date';
        }
    };

    return (
        <Html>
            <Head />
            <Preview>{previewText}</Preview>
            <Body style={main}>
                <Container style={container}>
                    {/* Logo and Title */}
                    <Row style={{ marginBottom: '20px'}}>
                        <Column style={{ width: '40px' }}>
                           {/* You might need to host the logo publicly or embed as base64 for email */}
                           {/* <Img src={`${baseUrl}/images/receptionist_logo.png`} width="32" height="32" alt="Logo" /> */}
                        </Column>
                        <Column>
                            <Heading style={heading}>New Shipment Created</Heading>
                        </Column>
                    </Row>
                    
                    {/* Main Content Section */}
                    <Section style={contentSection}>
                        <Text style={paragraph}>You have a new shipment inbound.</Text>
                        
                        {/* Details Table */}
                        <Section style={detailsTable}>
                            <Row style={detailRow}>
                                <Column style={detailLabel}>Shipment ID:</Column>
                                <Column style={detailValue}>{shipment.shortId}</Column>
                            </Row>
                            <Row style={detailRow}>
                                <Column style={detailLabel}>Created:</Column>
                                <Column style={detailValue}>{formatDate(shipment.createdAt)}</Column>
                            </Row>
                            <Row style={detailRow}>
                                <Column style={detailLabel}>Sender:</Column>
                                <Column style={detailValue}>{shipment.senderName}</Column> {/* Sender email removed */}
                            </Row>
                            <Row style={detailRow}>
                                <Column style={detailLabel}>Destination:</Column>
                                <Column style={detailValue}>{shipment.location?.name ?? 'N/A'}</Column>
                            </Row>
                            <Row style={detailRow}>
                                <Column style={detailLabel}>Tracking Number:</Column>
                                <Column style={detailValue}>{shipment.trackingNumber}</Column>
                            </Row>
                            <Row style={detailRow}>
                                <Column style={detailLabel}>Device Quantity:</Column>
                                <Column style={detailValue}>{shipment.devices.length}</Column> {/* Only show count */}
                            </Row>
                        </Section>

                        {/* Link to view shipment */}
                        {/* <Section style={{ textAlign: 'center', marginTop: '32px', marginBottom: '32px' }}>
                            <Button style={button} href={shipmentUrl}>
                                View Shipment in Dashboard
                            </Button>
                        </Section> */}
                    </Section>

                    <Hr style={hr} />
                    <Text style={footer}>Receptionist Automated Notification</Text>
                </Container>
            </Body>
        </Html>
    );
};

export default NewShipmentNotification;

// --- Styles (Adapted from PDF styles and common email patterns) ---
const main = {
    backgroundColor: '#ffffff',
    fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji"',
};

const container = {
    margin: '0 auto',
    padding: '20px 0 48px',
    width: '580px',
    maxWidth: '100%',
};

const heading = {
    fontSize: '24px',
    fontWeight: 'bold',
    margin: '0 0 20px 0',
    color: '#111827', 
};

const contentSection = {
    padding: '24px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    backgroundColor: '#ffffff',
};

const paragraph = {
    fontSize: '16px',
    lineHeight: '26px',
    color: '#374151',
    marginBottom: '24px',
};

const detailsTable = {
    margin: '0 0 24px 0',
};

const detailRow = {
    paddingBottom: '8px',
};

const detailLabel = {
    fontSize: '14px',
    color: '#6b7280', 
    width: '120px',
    paddingRight: '10px',
    fontWeight: '500',
    verticalAlign: 'top',
};

const detailValue = {
    fontSize: '14px',
    color: '#1f2937',
    verticalAlign: 'top',
};

const hr = {
    borderColor: '#e5e7eb', 
    margin: '26px 0',
};

const footer = {
    color: '#9ca3af', 
    fontSize: '12px',
    textAlign: 'center' as const,
    lineHeight: '24px',
};

const button = {
    backgroundColor: '#000000',
    borderRadius: '5px',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: '500',
    textDecoration: 'none',
    textAlign: 'center' as const,
    display: 'inline-block',
    padding: '12px 24px',
    border: '1px solid #000',
}; 