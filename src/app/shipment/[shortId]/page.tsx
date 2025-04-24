'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Shipment, Device, Location, ShipmentStatus } from '@prisma/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { IconLoader2, IconArrowLeft, IconEdit, IconDeviceDesktop, IconMapPin, IconUser, IconSignature, IconFileDescription } from '@tabler/icons-react';
import { format } from 'date-fns';
import { getStatusBadgeVariant, cn } from '@/lib/utils';
import { toast } from "sonner";
import { Toaster as SonnerToaster } from "sonner";
import Image from 'next/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type ShipmentDetail = Shipment & {
    devices: Device[];
    location: Location | null;
};

interface ShipmentFormData {
    senderName: string;
    senderEmail: string;
    status: ShipmentStatus;
}

export default function ShipmentDetailPage() {
    const router = useRouter();
    const params = useParams();
    const shortId = params.shortId as string;

    const [shipment, setShipment] = useState<ShipmentDetail | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState<ShipmentFormData>({ senderName: '', senderEmail: '', status: ShipmentStatus.PENDING });
    const [isSignatureDialogOpen, setIsSignatureDialogOpen] = useState(false);

    useEffect(() => {
        if (!shortId) return;

        const fetchShipment = async () => {
            setIsLoading(true);
            setError(null);
            try {
                // Fetch from an API route instead of direct client access
                const response = await fetch(`/api/shipments/${shortId.toUpperCase()}`);
                if (!response.ok) {
                    if (response.status === 404) {
                         setError('Shipment not found.');
                    } else {
                         throw new Error(`Failed to fetch: ${response.statusText}`);
                    }
                    setShipment(null);
                } else {
                    const data = await response.json();
                    setShipment(data);
                    // Initialize form data when shipment is loaded
                    setFormData({
                        senderName: data.senderName || '',
                        senderEmail: data.senderEmail || '',
                        status: data.status || ShipmentStatus.PENDING,
                    });
                }

            } catch (err: any) {
                console.error("Error fetching shipment:", err);
                setError(err.message || 'Failed to load shipment details.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchShipment();
    }, [shortId]);

    // --- Edit Handlers --- 
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleStatusChange = (value: ShipmentStatus) => {
        setFormData(prev => ({ ...prev, status: value }));
    };

    const handleEditToggle = () => {
        if (isEditing) {
            // Reset form data if cancelling edit
            if (shipment) {
                setFormData({
                    senderName: shipment.senderName || '',
                    senderEmail: shipment.senderEmail || '',
                    status: shipment.status || ShipmentStatus.PENDING,
                });
            }
        }
        setIsEditing(!isEditing);
    };

    const handleSave = async () => {
        setIsSaving(true);
        const toastId = `save-shipment-${shortId}`;
        toast.loading("Saving changes...", { id: toastId });

        try {
            const response = await fetch(`/api/shipments/${shortId.toUpperCase()}`, {
                 method: 'PUT',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify(formData)
             });

             const result = await response.json();

             if (!response.ok) {
                 throw new Error(result.error || `Failed to save changes (HTTP ${response.status})`);
             }

             setShipment(result);
             setIsEditing(false);
             toast.success("Shipment updated successfully!", { id: toastId });

        } catch (err: any) {
             console.error("Error saving shipment:", err);
             toast.error("Save Failed", { description: err.message, id: toastId });
        } finally {
             setIsSaving(false);
        }
    };

    if (isLoading) {
        return <div className="flex justify-center items-center h-screen"><IconLoader2 className="animate-spin h-8 w-8" /></div>;
    }

    if (error) {
        return (
            <div className="flex flex-col justify-center items-center h-screen text-destructive">
                <p>{error}</p>
                <Button variant="outline" onClick={() => router.push('/')} className="mt-4">
                    <IconArrowLeft className="mr-2 h-4 w-4"/> Go Back to Dashboard
                </Button>
            </div>
        );
    }

    if (!shipment) {
        return <div className="flex justify-center items-center h-screen text-muted-foreground">Shipment data could not be loaded.</div>;
    }

    return (
        <div className="container mx-auto p-4 md:p-8 max-w-4xl">
            <SonnerToaster richColors position="top-right"/>
            {/* Signature View Dialog */}
            <Dialog open={isSignatureDialogOpen} onOpenChange={setIsSignatureDialogOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Recipient Signature</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                    {shipment?.recipientSignature ? (
                        <Image
                            src={shipment.recipientSignature}
                            alt="Recipient Signature"
                            width={350}
                            height={175}
                            className="mx-auto border rounded bg-white"
                        />
                    ) : (
                        <p className="text-center text-muted-foreground">No signature captured.</p>
                    )}
                    </div>
                </DialogContent>
            </Dialog>

            <Button variant="ghost" onClick={() => router.push('/')} className="mb-4">
                 <IconArrowLeft className="mr-2 h-4 w-4"/> Back to Dashboard
            </Button>

            <Card className="mb-6">
                 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div>
                         <CardTitle className="text-2xl font-bold">Shipment {shipment.shortId}</CardTitle>
                         <CardDescription>Details and associated devices.</CardDescription>
                    </div>
                    <Button variant={isEditing ? "secondary" : "outline"} size="sm" onClick={handleEditToggle} disabled={isSaving}>
                        {isEditing ? (
                            <><IconEdit className="mr-2 h-4 w-4" /> Cancel</>
                        ) : (
                            <><IconEdit className="mr-2 h-4 w-4" /> Edit</>
                        )}
                    </Button>
                 </CardHeader>
                 <CardContent>
                     {isEditing ? (
                         <div className="space-y-4">
                            {/* Editable Fields */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                     <Label htmlFor="senderName">Sender Name</Label>
                                     <Input id="senderName" name="senderName" value={formData.senderName} onChange={handleInputChange} disabled={isSaving}/>
                                </div>
                                <div className="space-y-1">
                                     <Label htmlFor="senderEmail">Sender Email</Label>
                                     <Input id="senderEmail" name="senderEmail" type="email" value={formData.senderEmail} onChange={handleInputChange} disabled={isSaving}/>
                                </div>
                             </div>
                             <div className="space-y-1">
                                 <Label htmlFor="status">Status</Label>
                                 <Select name="status" value={formData.status} onValueChange={handleStatusChange} disabled={isSaving}>
                                     <SelectTrigger id="status">
                                         <SelectValue placeholder="Select status" />
                                     </SelectTrigger>
                                     <SelectContent>
                                         {Object.values(ShipmentStatus).map(status => (
                                             <SelectItem key={status} value={status}>
                                                 {status}
                                             </SelectItem>
                                         ))}
                                     </SelectContent>
                                 </Select>
                             </div>

                            <div className="flex justify-end space-x-2 mt-4">
                                <Button variant="outline" onClick={handleEditToggle} disabled={isSaving}>Cancel</Button>
                                <Button onClick={handleSave} disabled={isSaving}>
                                    {isSaving ? <IconLoader2 className="animate-spin mr-2 h-4 w-4"/> : null}
                                    Save Changes
                                </Button>
                            </div>
                         </div>
                     ) : (
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div><strong className="font-medium">Status:</strong> <Badge variant={getStatusBadgeVariant(shipment.status)}>{shipment.status}</Badge></div>
                            <div><strong className="font-medium">Created:</strong> {format(new Date(shipment.createdAt), 'PPpp')}</div>
                            <div><strong className="font-medium">Sender:</strong> {shipment.senderName} ({shipment.senderEmail})</div>
                            <div className="flex items-center"><IconMapPin className="mr-1 h-4 w-4 text-muted-foreground" /><strong className="font-medium">Location:</strong> {shipment.location?.name ?? 'N/A'}</div>
                            <div className="flex items-center">
                                <IconUser className="mr-1 h-4 w-4 text-muted-foreground" />
                                <strong className="font-medium">Recipient:</strong> 
                                <span className="ml-1">{shipment.recipientName ?? <span className="italic text-muted-foreground/50">N/A</span>}</span>
                                {shipment.recipientSignature && (
                                    <Button variant="ghost" size="icon" className="ml-1 h-6 w-6" onClick={() => setIsSignatureDialogOpen(true)} title="View Signature">
                                        <IconSignature className="h-4 w-4 text-muted-foreground" />
                                    </Button>
                                )}
                            </div>
                            <div><strong className="font-medium">Received:</strong> {shipment.receivedAt ? format(new Date(shipment.receivedAt), 'PPpp') : <span className="italic text-muted-foreground/50">N/A</span>}</div>
                            {shipment.manifestUrl && (
                                <div className="flex items-center">
                                    <IconFileDescription className="mr-1 h-4 w-4 text-muted-foreground" />
                                    <strong className="font-medium">Manifest:</strong> 
                                    <a href={shipment.manifestUrl} target="_blank" rel="noopener noreferrer" className="ml-1 text-blue-600 hover:underline">View PDF</a>
                                </div>
                             )}
                            {shipment.trackingId && <div><strong className="font-medium">Tracking ID:</strong> {shipment.trackingId}</div>}
                         </div>
                     )}
                 </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><IconDeviceDesktop className="mr-2 h-5 w-5"/> Devices ({shipment.devices.length})</CardTitle>
                    <CardDescription>List of devices included in this shipment.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Serial Number</TableHead>
                                <TableHead>Asset Tag</TableHead>
                                <TableHead>Model</TableHead>
                                <TableHead>Checked In</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {shipment.devices.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                        No devices associated with this shipment.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                shipment.devices.map((device) => (
                                    <TableRow key={device.id}>
                                        <TableCell className="font-mono text-xs">{device.serialNumber}</TableCell>
                                        <TableCell>{device.assetTag ?? <span className="italic text-muted-foreground/50">N/A</span>}</TableCell>
                                        <TableCell>{device.model ?? <span className="italic text-muted-foreground/50">N/A</span>}</TableCell>
                                        <TableCell>
                                            {device.isCheckedIn ?
                                                (device.checkedInAt ? `Yes (${format(new Date(device.checkedInAt), 'Pp')})` : 'Yes') :
                                                'No'}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* TODO: Add sections for Signature display, Audit Log, Actions (e.g., Re-send notification, Cancel shipment) */}

        </div>
    );
}
