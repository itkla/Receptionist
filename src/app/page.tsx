'use client';

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar";
import {
    IconArrowLeft,
    IconSettings,
    IconPackage,
    IconPlus,
    IconFileDescription,
    IconLoader2,
    IconArrowUp,
    IconArrowDown,
    IconArrowsSort,
    IconLocation,
    IconAlertCircle,
    IconDeviceDesktop,
    IconSignature,
    IconEye,
    IconCheckbox,
    IconSearch,
    IconX,
    IconChevronLeft,
    IconChevronRight,
    IconCheck,
    IconSelector,
    IconMapPin,
    IconUser,
    IconDotsVertical,
    IconTrash,
    IconLogout2
} from "@tabler/icons-react";
import Link from "next/link";
import { motion } from "motion/react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, PlusCircle } from 'lucide-react';
import { Toaster as SonnerToaster } from "sonner";
import { toast } from "sonner";
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import { ModeToggle } from "@/components/theme-toggle";
import { Logo, LogoIcon } from "@/components/layout/logos";
import { Checkbox } from "@/components/ui/checkbox";
import { ShipmentStatus, Shipment as PrismaShipment, Device as PrismaDevice, Location as PrismaLocation } from "@prisma/client";
import { useDebounce } from "@/hooks/useDebounce";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getStatusBadgeVariant } from '@/lib/utils';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { ShipmentManifestPDF } from '@/components/pdf/ShipmentManifestPDF';
import { toDataURL as qrToDataURL } from 'qrcode';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSession } from "next-auth/react";

type SortDirection = 'asc' | 'desc';
type SortableShipmentKeys = 'shortId' | 'status' | 'createdAt';

// Special value constant removed, no longer needed for Select
// const ALL_STATUSES_VALUE = "__ALL__";

type ShipmentDetail = PrismaShipment & {
    devices: PrismaDevice[];
    location: PrismaLocation | null;
    trackingNumber: string | null;
    recipientSignature?: string | null;
    receivedAt?: Date | null;
    manifestUrl?: string | null;
    notifyEmails?: string[];
    notes?: string | null;
    clientReferenceId?: string | null;
};

interface ShipmentFormData {
    senderName: string;
    senderEmail: string;
    status: ShipmentStatus;
    trackingNumber: string | null;
    notifyEmails: string;
    notes: string | null;
    clientReferenceId: string | null;
}

interface ShipmentDetailModalProps {
    shortId: string | null;
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    onShipmentUpdate: () => void;
    currentUser?: { name?: string | null; email?: string | null };
}

interface DeviceInput {
    id: string;
    serialNumber: string;
    assetTag: string;
    model: string;
}

const ShipmentDetailModal: React.FC<ShipmentDetailModalProps> = ({ shortId, isOpen, onOpenChange, onShipmentUpdate, currentUser }) => {
    const [shipment, setShipment] = useState<ShipmentDetail | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState<ShipmentFormData>({ senderName: '', senderEmail: '', status: ShipmentStatus.PENDING, trackingNumber: null, notifyEmails: '', notes: null, clientReferenceId: null });
    const [isSignatureDialogOpen, setIsSignatureDialogOpen] = useState(false);
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            const timer = setTimeout(() => {
                setShipment(null);
                setError(null);
                setIsLoading(false);
                setIsEditing(false);
                setIsSaving(false);
                setFormData({ senderName: '', senderEmail: '', status: ShipmentStatus.PENDING, trackingNumber: null, notifyEmails: '', notes: null, clientReferenceId: null });
                setQrCodeDataUrl(null);
                setIsDeleteDialogOpen(false);
                setIsDeleting(false);
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && shortId) {
            const fetchAndPrepareData = async () => {
                setIsLoading(true);
                setError(null);
                setIsEditing(false);
                setQrCodeDataUrl(null);
                try {
                    const response = await fetch(`/api/shipments/${shortId.toUpperCase()}`, { credentials: 'include' });
                    if (!response.ok) {
                        if (response.status === 404) { setError('Shipment not found.'); }
                        else { throw new Error(`Failed to fetch: ${response.statusText}`); }
                        setShipment(null);
                    } else {
                        const data = await response.json();
                        setShipment(data as ShipmentDetail);
                        setFormData({
                            senderName: data.senderName || currentUser?.name || '',
                            senderEmail: data.senderEmail || currentUser?.email || '',
                            status: data.status as ShipmentStatus || ShipmentStatus.PENDING,
                            trackingNumber: data.trackingNumber || null,
                            notifyEmails: (data.notifyEmails || []).join(', '),
                            notes: data.notes || null,
                            clientReferenceId: data.clientReferenceId || null,
                        });

                        if (typeof window !== 'undefined') {
                            const baseUrl = window.location.origin;
                            const receiveUrl = `${baseUrl}/receive/${data.shortId}`;
                            try {
                                const url = await qrToDataURL(receiveUrl, {
                                    errorCorrectionLevel: 'Q', margin: 2, width: 128,
                                    color: { dark: "#000000FF", light: "#FFFFFFFF" }
                                });
                                setQrCodeDataUrl(url);
                                console.log("QR Code URL generated for modal.");
                            } catch (qrErr) {
                                console.error("Failed to generate QR code for modal:", qrErr);
                            }
                        }
                    }
                } catch (err: any) {
                    console.error("Error fetching shipment details:", err);
                    setError(err.message || 'Failed to load shipment details.');
                } finally {
                    setIsLoading(false);
                }
            };
            fetchAndPrepareData();
        }
    }, [shortId, isOpen, currentUser]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        if (name === 'trackingNumber' || name === 'notes' || name === 'clientReferenceId') {
            setFormData(prev => ({ ...prev, [name]: value.trim() === '' ? null : value }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };
    const handleStatusChange = (value: string) => {
        if (Object.values(ShipmentStatus).includes(value as ShipmentStatus)) {
            setFormData(prev => ({ ...prev, status: value as ShipmentStatus }));
        }
    };
    const handleEditToggle = () => {
        if (isEditing && shipment) {
            setFormData({
                senderName: shipment.senderName || '',
                senderEmail: shipment.senderEmail || '',
                status: shipment.status || ShipmentStatus.PENDING,
                trackingNumber: shipment.trackingNumber || null,
                notifyEmails: (shipment.notifyEmails || []).join(', '),
                notes: shipment.notes || null,
                clientReferenceId: shipment.clientReferenceId || null,
            });
        }
        setIsEditing(!isEditing);
    };
    const handleSave = async () => {
        setIsSaving(true);
        const toastId = `save-shipment-${shortId}`;
        toast.loading("Saving changes...", { id: toastId });
        try {
            const emailsToSend = formData.notifyEmails.split(',')
                .map(e => e.trim())
                .filter(e => e !== '');

            const payload = {
                ...formData,
                notifyEmails: emailsToSend
            };

            const response = await fetch(`/api/shipments/${shortId!.toUpperCase()}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (!response.ok) { throw new Error(result.error || `Failed to save changes (HTTP ${response.status})`); }

            setShipment(result as ShipmentDetail);
            setIsEditing(false);
            toast.success("Shipment updated successfully!", { id: toastId });
            onShipmentUpdate();
        } catch (err: any) {
            console.error("Error saving shipment:", err);
            toast.error("Save Failed", { description: err.message, id: toastId });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!shortId) return;
        setIsDeleting(true);
        const toastId = `delete-shipment-${shortId}`;
        toast.loading("Deleting shipment...", { id: toastId });

        try {
            const response = await fetch(`/api/shipments/${shortId.toUpperCase()}`, {
                method: 'DELETE',
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || `Failed to delete shipment (HTTP ${response.status})`);
            }

            toast.success("Shipment deleted successfully!", { id: toastId });
            setIsDeleteDialogOpen(false);
            onOpenChange(false);
            onShipmentUpdate();

        } catch (err: any) {
            console.error("Error deleting shipment:", err);
            toast.error("Delete Failed", { description: err.message, id: toastId });
        } finally {
            setIsDeleting(false);
        }
    };

    const renderContent = () => {
        if (isLoading) {
            return <div className="flex justify-center items-center h-48"><IconLoader2 className="animate-spin h-8 w-8" /></div>;
        }
        if (error) {
            return <div className="flex flex-col justify-center items-center h-48 text-destructive"><p>{error}</p></div>;
        }
        if (!shipment) {
            return <div className="flex justify-center items-center h-48 text-muted-foreground">Shipment data could not be loaded.</div>;
        }

        return (
            <div className="space-y-6">
                <Card className="border-none">
                    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                        <div>
                            <CardTitle className="text-xl font-bold">Shipment {shipment.shortId}</CardTitle>
                            <CardDescription>Details and associated devices.</CardDescription>
                        </div>
                        <div className="flex items-center space-x-1">
                            {isEditing ? (
                                <Button variant="secondary" size="sm" onClick={handleEditToggle} disabled={isSaving}>Cancel</Button>
                            ) : (
                                <Button variant="outline" size="sm" onClick={handleEditToggle} disabled={isSaving}>Edit</Button>
                            )}

                            {!isEditing && (
                                <>
                                    {/* TEMPORARY TEST BUTTON */}
                                    {/* <Button variant="secondary" size="sm" onClick={() => { console.log('TEMP BTN CLICKED'); setIsDeleteDialogOpen(true); }}>Test Delete Dialog</Button> */}

                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isDeleting}>
                                                <IconDotsVertical className="h-4 w-4" />
                                                <span className="sr-only">More actions</span>
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    //  console.log("Delete menu item CLICKED. Setting delete dialog open."); // Log click
                                                    setIsDeleteDialogOpen(true);
                                                }}
                                                className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                                                disabled={isDeleting}
                                            >
                                                {/* Icon temporarily removed for testing */}
                                                {/* <IconTrash className="h-4 w-4 mr-2 text-destructive focus:text-destructive focus:bg-destructive/10" /> */}
                                                <IconTrash className="h-4 w-4 mr-2 text-destructive focus:text-destructive focus:bg-destructive/10" />Delete Shipment
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        {isEditing ? (
                            <div className="space-y-4 py-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1"><Label htmlFor="modal-senderName">Sender Name</Label><Input id="modal-senderName" name="senderName" value={formData.senderName} onChange={handleInputChange} disabled={isSaving} /></div>
                                    <div className="space-y-1"><Label htmlFor="modal-senderEmail">Sender Email</Label><Input id="modal-senderEmail" name="senderEmail" type="email" value={formData.senderEmail} onChange={handleInputChange} disabled={isSaving} /></div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <Label htmlFor="modal-status">Status</Label>
                                        <Select name="status" value={formData.status} onValueChange={handleStatusChange} disabled={isSaving}>
                                            <SelectTrigger id="modal-status"><SelectValue /></SelectTrigger><SelectContent>{Object.values(ShipmentStatus).map(s => (<SelectItem key={s} value={s}>{s}</SelectItem>))}</SelectContent></Select>
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="modal-trackingNumber">Tracking Number</Label>
                                        <Input id="modal-trackingNumber" name="trackingNumber" value={formData.trackingNumber ?? ''} onChange={handleInputChange} placeholder="Optional carrier tracking #" disabled={isSaving} />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="modal-notes">Notes</Label>
                                    <Input id="modal-notes" name="notes" value={formData.notes ?? ''} onChange={handleInputChange} placeholder="Optional notes about the shipment" disabled={isSaving} />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="modal-clientReferenceId">Client Reference ID</Label>
                                    <Input id="modal-clientReferenceId" name="clientReferenceId" value={formData.clientReferenceId ?? ''} onChange={handleInputChange} placeholder="Optional ID from client system" disabled={isSaving} />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="modal-notifyEmails">Notification Emails (Optional)</Label>
                                    <Input
                                        id="modal-notifyEmails"
                                        name="notifyEmails"
                                        value={formData.notifyEmails}
                                        onChange={handleInputChange}
                                        placeholder="Comma-separated emails"
                                        disabled={isSaving}
                                    />
                                </div>
                                <div className="flex justify-end pt-4"><Button onClick={handleSave} disabled={isSaving}>{isSaving ? <IconLoader2 className="animate-spin mr-2 h-4" /> : 'Save Changes'}</Button></div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-sm pt-4">
                                <div><strong className="font-medium">Status:</strong> <Badge variant={getStatusBadgeVariant(shipment.status)}>{shipment.status}</Badge></div>
                                <div><strong className="font-medium">Created:</strong> {format(new Date(shipment.createdAt), 'PPpp')}</div>
                                <div><strong className="font-medium">Sender:</strong> {shipment.senderName} ({shipment.senderEmail})</div>
                                <div className="flex items-center"><IconMapPin className="mr-1.5 h-4 w-4 text-muted-foreground" /><strong className="font-medium">Location:</strong> {shipment.location?.name ?? 'N/A'}</div>
                                <div className="flex items-center"><IconUser className="mr-1.5 h-4 w-4 text-muted-foreground" /><strong className="font-medium">Recipient:</strong> <span className="ml-1">{shipment.recipientName ?? <span className="italic text-muted-foreground/50">N/A</span>}</span>{shipment.recipientSignature && (<Button variant="ghost" size="icon" className="ml-1 h-6 w-6" onClick={() => setIsSignatureDialogOpen(true)} title="View Signature"><IconSignature className="h-4 w-4 text-muted-foreground" /></Button>)}</div>
                                <div><strong className="font-medium">Received:</strong> {shipment.receivedAt ? format(new Date(shipment.receivedAt), 'PPpp') : <span className="italic text-muted-foreground/50">N/A</span>}</div>
                                <div className="flex items-center col-span-1 md:col-span-2">
                                    <IconFileDescription className="mr-1.5 h-4 w-4 text-muted-foreground" />
                                    <strong className="font-medium">Manifest:</strong>
                                    {qrCodeDataUrl ? (
                                        <PDFDownloadLink
                                            document={<ShipmentManifestPDF shipment={shipment} qrDataUrl={qrCodeDataUrl} />}
                                            fileName={`Manifest-${shipment.shortId}.pdf`}
                                            className="ml-1 text-blue-600 hover:underline"
                                        >
                                            {({ loading }) => loading ? 'Generating PDF...' : 'Download PDF'}
                                        </PDFDownloadLink>
                                    ) : (
                                        <span className="ml-1 text-muted-foreground italic">Generating manifest link...</span>
                                    )}
                                </div>
                                {shipment.trackingNumber && <div><strong className="font-medium">Tracking #:</strong> {shipment.trackingNumber}</div>}
                                <div className="md:col-span-2"><strong className="font-medium">Client Ref ID:</strong> {shipment.clientReferenceId ?? <span className="italic text-muted-foreground/50">N/A</span>}</div>
                                <div className="md:col-span-2"><strong className="font-medium">Notes:</strong> {(shipment.notes && shipment.notes.trim() !== '') ? shipment.notes : <span className="italic text-muted-foreground/50">None</span>}</div>
                                <div className="md:col-span-2"><strong className="font-medium">Notify Emails:</strong> {(shipment.notifyEmails && shipment.notifyEmails.length > 0) ? shipment.notifyEmails.join(', ') : <span className="italic text-muted-foreground/50">None</span>}</div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                    {/* <AlertDialogTrigger asChild><button className="hidden">Hidden Trigger</button></AlertDialogTrigger> */}
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the shipment
                                <span className="font-semibold"> {shipment?.shortId}</span> and all associated device records.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive text-background hover:bg-destructive/90">
                                {isDeleting ? <IconLoader2 className="animate-spin mr-2 h-4" /> : null}
                                {isDeleting ? 'Deleting...' : 'Yes, delete shipment'}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {!isEditing && shipment?.trackingNumber && (
                    <Card>
                        <CardHeader><CardTitle>Tracking Info</CardTitle></CardHeader>
                        <CardContent>
                            <div className="h-60 bg-muted rounded flex items-center justify-center text-muted-foreground">
                                <span>Map Placeholder (Requires Integration)</span>
                            </div>
                            <div className="mt-4 text-sm text-muted-foreground">
                                <p>Status: Fetching tracking data requires API integration.</p>
                            </div>
                        </CardContent>
                    </Card>
                )}
                <Card>
                    <CardHeader><CardTitle className="flex items-center"><IconDeviceDesktop className="mr-2 h-5 w-5" /> Devices ({shipment.devices.length})</CardTitle></CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader><TableRow><TableHead>Serial</TableHead><TableHead>Asset</TableHead><TableHead>Model</TableHead><TableHead>Checked In</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {shipment.devices.length === 0 ? (
                                    <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">No devices.</TableCell></TableRow>
                                ) : (
                                    shipment.devices.map((device: PrismaDevice) => (
                                        <TableRow key={device.id}>
                                            <TableCell className="font-mono text-xs">
                                                {device.serialNumber}
                                                {device.isExtraDevice && <Badge variant="outline" className="ml-2 text-xs h-4 px-1 py-0">Extra</Badge>}
                                            </TableCell>
                                            <TableCell>{device.assetTag ?? '-'}</TableCell>
                                            <TableCell>{device.model ?? '-'}</TableCell>
                                            <TableCell>{device.isCheckedIn ? (device.checkedInAt ? `Yes (${format(new Date(device.checkedInAt), 'Pp')})` : 'Yes') : 'No'}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <Dialog open={isSignatureDialogOpen} onOpenChange={setIsSignatureDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Signature</DialogTitle>
                        </DialogHeader>
                        <div className="py-4">
                            {shipment?.recipientSignature ? (<Image src={shipment.recipientSignature} alt="Signature" width={300} height={200} className="mx-auto rounded bg-white" />) : (<p>No signature.</p>)}
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
                <DialogHeader className="flex-shrink-0">
                </DialogHeader>
                <div className="flex-grow overflow-y-auto p-6">
                    {renderContent()}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default function AdminDashboardPage() {
    const [open, setOpen] = useState(false);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedShortId, setSelectedShortId] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const { data: session } = useSession();
    const currentUser = session?.user;

    const links = [
        {
            label: "Shipments",
            href: "/",
            icon: (
                <IconPackage className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />
            ),
        },
        {
            label: "Destinations",
            href: "/locations",
            icon: (
                <IconLocation className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />
            ),
        },
        {
            label: "Settings",
            href: "/settings",
            icon: (
                <IconSettings className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />
            ),
        },
        {
            label: "Users",
            href: "/users",
            icon: (
                <IconUser className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />
            ),
        },
        {
            label: "Logout",
            href: "/auth/signout",
            icon: (
                <IconLogout2 className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />
            ),
        }

    ];

    const MainContent = () => {
        const [shipments, setShipments] = useState<ShipmentDetail[]>([]);
        const [isLoadingTable, setIsLoadingTable] = useState(true);
        const [errorTable, setErrorTable] = useState<string | null>(null);
        const [sortColumn, setSortColumn] = useState<SortableShipmentKeys>('createdAt');
        const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
        const [statusFilter, setStatusFilter] = useState<string>('');
        const [searchTerm, setSearchTerm] = useState<string>('');
        const [parsedStatusFilter, setParsedStatusFilter] = useState<string>('');
        const [plainSearchText, setPlainSearchText] = useState<string>('');
        const debouncedPlainText = useDebounce(plainSearchText, 300);
        const [currentPage, setCurrentPage] = useState(1);
        const [totalCount, setTotalCount] = useState(0);
        const itemsPerPage = 15;
        const [selectedSignature, setSelectedSignature] = useState<string | null>(null);
        const [isSignatureDialogOpen, setIsSignatureDialogOpen] = useState(false);
        const [isVerificationDialogOpen, setIsVerificationDialogOpen] = useState(false);
        const [selectedShipmentForVerification, setSelectedShipmentForVerification] = useState<ShipmentDetail | null>(null);
        const [verifiedDeviceIds, setVerifiedDeviceIds] = useState<Set<string>>(new Set());
        const [isVerifying, setIsVerifying] = useState(false);
        const router = useRouter();

        const totalPages = Math.ceil(totalCount / itemsPerPage);

        useEffect(() => {
            const statusRegex = /@(\w+)\b/;
            const match = searchTerm.match(statusRegex);
            let currentStatusFilter = '';
            let currentPlainText = searchTerm;

            if (match) {
                const directive = match[1].toUpperCase();
                const fullDirectiveMatch = match[0];

                if (directive === 'ALL') {
                    currentStatusFilter = '';

                } else if (Object.values(ShipmentStatus).includes(directive as ShipmentStatus)) {
                    currentStatusFilter = directive;
                    currentPlainText = searchTerm.replace(fullDirectiveMatch, '').trim();
                } else {
                    currentStatusFilter = '';
                    currentPlainText = searchTerm;
                }
            } else {
                currentStatusFilter = '';
                currentPlainText = searchTerm;
            }

            setParsedStatusFilter(currentStatusFilter);
            setPlainSearchText(currentPlainText);

        }, [searchTerm]);

        // Fetch shipments based on parsed filters and debounced text
        useEffect(() => {
            const fetchShipments = async () => {
                setIsLoadingTable(true);
                setErrorTable(null);
                const url = new URL('/api/shipments', window.location.origin);
                url.searchParams.append('sortBy', sortColumn);
                url.searchParams.append('sortOrder', sortDirection);
                url.searchParams.append('page', currentPage.toString());
                url.searchParams.append('limit', itemsPerPage.toString());

                if (parsedStatusFilter) {
                    url.searchParams.append('status', parsedStatusFilter);
                }
                if (debouncedPlainText) {
                    url.searchParams.append('search', debouncedPlainText);
                }

                try {
                    const response = await fetch(url.toString());
                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(errorData.error || `Failed to fetch shipments (HTTP ${response.status})`);
                    }
                    const data = await response.json();
                    // --- LOGGING --- 
                    // console.log("API Response Data:", data); // Log the raw response
                    if (data.shipments && data.shipments.length > 0) {
                        // console.log("First Shipment Object:", data.shipments[0]); // Log the first shipment
                    }
                    // ---------------
                    setShipments(data.shipments || []);
                    setTotalCount(data.totalCount || 0);
                } catch (err: any) {
                    console.error("Error fetching shipments:", err);
                    setErrorTable(err.message || "An unexpected error occurred while fetching shipments.");
                    toast.error("Error Fetching Shipments", { description: err.message });
                    setShipments([]);
                    setTotalCount(0);
                } finally {
                    setIsLoadingTable(false);
                }
            };

            fetchShipments();
        }, [sortColumn, sortDirection, parsedStatusFilter, debouncedPlainText, currentPage, refreshKey]);

        useEffect(() => {
            setCurrentPage(1);
        }, [parsedStatusFilter, debouncedPlainText]);

        const handleNextPage = () => {
            if (currentPage < totalPages) {
                setCurrentPage(prev => prev + 1);
            }
        };

        const handlePrevPage = () => {
            if (currentPage > 1) {
                setCurrentPage(prev => prev - 1);
            }
        };

        const handleSort = (column: SortableShipmentKeys) => {
            if (sortColumn === column) {
                setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
            } else {
                setSortColumn(column);
                setSortDirection('asc');
            }
        };

        const renderSortIcon = (column: SortableShipmentKeys) => {
            if (sortColumn !== column) {
                return <IconArrowsSort className="ml-2 h-4 w-4 opacity-30" />;
            }
            return sortDirection === 'asc' ? <IconArrowUp className="ml-2 h-4 w-4" /> : <IconArrowDown className="ml-2 h-4 w-4" />;
        };

        const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
            switch (status?.toUpperCase()) {
                case 'PENDING': return 'secondary';
                case 'RECEIVED': case 'COMPLETED': return 'default';
                case 'CANCELLED': return 'destructive';
                case 'IN_TRANSIT': case 'DELIVERED': case 'RECEIVING': return 'outline';
                default: return 'secondary';
            }
        };

        const handleViewSignature = (signatureDataUrl: string) => {
            setSelectedSignature(signatureDataUrl);
            setIsSignatureDialogOpen(true);
        };

        const handleOpenVerificationDialog = (shipment: ShipmentDetail) => {
            setSelectedShipmentForVerification(shipment);
            setVerifiedDeviceIds(new Set());
            setIsVerificationDialogOpen(true);
        };

        const handleCheckboxChange = (deviceId: string, checked: boolean | string) => {
            setVerifiedDeviceIds(prev => {
                const newSet = new Set(prev);
                if (checked === true) {
                    newSet.add(deviceId);
                } else {
                    newSet.delete(deviceId);
                }
                return newSet;
            });
        };

        const handleVerificationSubmit = async (verifiedIds: string[]) => {
            if (!selectedShipmentForVerification) return;

            setIsVerifying(true);
            const shipmentId = selectedShipmentForVerification.id;
            const toastId = `verify-${shipmentId}`;
            toast.loading("Verifying shipment...", { id: toastId });

            try {
                const response = await fetch(`/api/admin/shipments/${shipmentId}/verify`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ verifiedDeviceIds: verifiedIds }),
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || `Failed to verify shipment (HTTP ${response.status})`);
                }

                toast.success(result.message || "Shipment verified successfully!", {
                    id: toastId,
                    description: `${result.verifiedDevicesCount} device(s) marked as checked in.`
                });

                setShipments(prev => prev.map(s => s.id === shipmentId ? { ...s, status: 'COMPLETED' } : s));
                setIsVerificationDialogOpen(false);

            } catch (err: any) {
                console.error("Error verifying shipment:", err);
                toast.error("Verification Failed", { description: err.message, id: toastId });
            } finally {
                setIsVerifying(false);
            }
        };

        const triggerRefresh = useCallback(() => {
            setRefreshKey(prev => prev + 1);
        }, []);

        useEffect(() => {
            const fetchShipments = async () => {
                // ... fetch logic ...
            };
            fetchShipments();
        }, [sortColumn, sortDirection, parsedStatusFilter, debouncedPlainText, currentPage, refreshKey]);

        const handleRowClick = (shortId: string | undefined) => {
            if (shortId) {
                setSelectedShortId(shortId);
                setIsDetailModalOpen(true);
            }
        };

        return (
            <div className="flex flex-1 flex-col p-4 md:p-8 overflow-hidden">
                <SonnerToaster richColors position="top-right" />
                <Dialog open={isSignatureDialogOpen} onOpenChange={setIsSignatureDialogOpen}>
                    <DialogContent className="sm:max-w-[400px]">
                        <DialogHeader>
                            <DialogTitle>Recipient Signature</DialogTitle>
                        </DialogHeader>
                        <div className="py-4">
                            {selectedSignature ? (
                                <Image
                                    src={selectedSignature}
                                    alt="Recipient Signature"
                                    width={350}
                                    height={175}
                                    className="mx-auto border rounded"
                                />
                            ) : (
                                <p className="text-center text-muted-foreground">No signature available.</p>
                            )}
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsSignatureDialogOpen(false)}>Close</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog open={isVerificationDialogOpen} onOpenChange={setIsVerificationDialogOpen}>
                    <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                            <DialogTitle>Verify Received Shipment</DialogTitle>
                            <DialogDescription>
                                Confirm the items received for shipment <span className="font-mono">{selectedShipmentForVerification?.shortId}</span> signed by <span className="font-medium">{selectedShipmentForVerification?.recipientName || 'N/A'}</span>.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-4">
                            <p className="text-sm">Check the box for each device verified:</p>
                            <div className="max-h-60 overflow-y-auto space-y-1 border rounded p-3">
                                {selectedShipmentForVerification?.devices.map(device => (
                                    <div key={device.id} className="flex items-center space-x-3 p-2 hover:bg-muted/50 rounded">
                                        <Checkbox
                                            id={`verify-${device.id}`}
                                            checked={verifiedDeviceIds.has(device.id)}
                                            onCheckedChange={(checked) => handleCheckboxChange(device.id, checked)}
                                            aria-labelledby={`label-verify-${device.id}`}
                                        />
                                        <Label
                                            id={`label-verify-${device.id}`}
                                            htmlFor={`verify-${device.id}`}
                                            className="flex-grow text-sm font-normal cursor-pointer"
                                        >
                                            <span className="font-mono block">{device.serialNumber} {device.isExtraDevice && <span className="text-muted-foreground text-xs">(Extra)</span>}</span>
                                            <span className="text-xs text-muted-foreground">
                                                {device.model || 'Unknown Model'} {device.assetTag && `(${device.assetTag})`}
                                            </span>
                                        </Label>
                                    </div>
                                ))}
                                {(!selectedShipmentForVerification?.devices || selectedShipmentForVerification.devices.length === 0) && (
                                    <p className="text-sm text-muted-foreground text-center py-4">No devices listed for this shipment.</p>
                                )}
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsVerificationDialogOpen(false)} disabled={isVerifying}>Cancel</Button>
                            <Button
                                onClick={() => handleVerificationSubmit(Array.from(verifiedDeviceIds))}
                                disabled={verifiedDeviceIds.size === 0 || isVerifying}
                            >
                                {isVerifying ? <IconLoader2 className="animate-spin mr-2 h-4" /> : null}
                                {isVerifying ? 'Submitting...' : `Mark as Completed (${verifiedDeviceIds.size})`}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
                <div className="flex items-center justify-between mb-4 flex-shrink-0 flex-wrap gap-x-4 gap-y-2">
                    <div className="flex-shrink-0">
                        <h1 className="text-2xl font-semibold">Shipments</h1>
                    </div>
                    <div className="relative flex-grow flex justify-center px-4">
                        <div className="relative w-full max-w-xl">
                            <IconSearch className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Search or use @status (e.g., @pending C02X)"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-8 pr-8 h-9 w-full bg-background"
                            />
                            {searchTerm && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full text-muted-foreground hover:text-foreground"
                                    onClick={() => {
                                        setSearchTerm('');
                                    }}
                                    title="Clear search"
                                >
                                    <IconX className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                    <div className="flex-shrink-0">
                        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                            <DialogTrigger asChild>
                                <Button className="shrink-0">
                                    <IconPlus className="mr-2 h-4 w-4" /> Create Shipment
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle>Create New Shipment</DialogTitle>
                                    <DialogDescription>
                                        Enter the details for the new shipment manifest. Serial numbers are required.
                                    </DialogDescription>
                                </DialogHeader>
                                <CreateShipmentForm onSuccess={() => setIsCreateDialogOpen(false)} currentUser={currentUser} />
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>

                <Card className="border-none shadow-none flex-grow flex flex-col overflow-hidden drop-shadow-xl">
                    <CardContent className="p-0 flex-grow overflow-hidden flex flex-col">
                        <div className="overflow-y-auto flex-grow">
                            <Table>
                                <TableCaption>A list of recent shipments.</TableCaption>
                                <TableHeader className="sticky top-0 bg-background z-10">
                                    <TableRow>
                                        <TableHead className="w-[100px]">ID</TableHead>
                                        <TableHead className="w-[180px]">
                                            Location
                                        </TableHead>
                                        <TableHead className="w-[120px] cursor-pointer" onClick={() => handleSort('status')}>
                                            <div className="flex items-center">Status {renderSortIcon('status')}</div>
                                        </TableHead>
                                        <TableHead className="w-[80px] text-center">Devices</TableHead>
                                        <TableHead className="w-[180px]">Recipient</TableHead>
                                        <TableHead className="w-[170px]">Received At</TableHead>
                                        <TableHead className="w-[170px] cursor-pointer" onClick={() => handleSort('createdAt')}>
                                            <div className="flex items-center">Created {renderSortIcon('createdAt')}</div>
                                        </TableHead>
                                        <TableHead className="text-center w-[100px]">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoadingTable ? (
                                        <TableRow>
                                            <TableCell colSpan={8} className="h-24 text-center">
                                                <div className="flex justify-center items-center">
                                                    <IconLoader2 className="mr-2 h-6 w-6 animate-spin" /> Loading shipments...
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : errorTable ? (
                                        <TableRow>
                                            <TableCell colSpan={8} className="h-24 text-center text-destructive">
                                                Error: {errorTable}
                                            </TableCell>
                                        </TableRow>
                                    ) : shipments.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={8} className="h-24 text-center">
                                                No shipments found.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        shipments.map((shipment) => (
                                            <TableRow
                                                key={shipment.id}
                                                className="cursor-pointer hover:bg-muted/50"
                                                onClick={() => handleRowClick(shipment.shortId)}
                                            >
                                                <TableCell className="font-mono text-xs font-semibold">{shipment.shortId ?? 'N/A'}</TableCell>
                                                <TableCell className="font-medium">{shipment.location?.name ?? <span className="italic opacity-50">N/A</span>}</TableCell>
                                                <TableCell>
                                                    <Badge variant={getStatusBadgeVariant(shipment.status)}>
                                                        {shipment.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-center">{shipment.devices?.length ?? 0}</TableCell>
                                                <TableCell>
                                                    {(shipment.status === 'COMPLETED' || shipment.status === 'RECEIVED') && shipment.recipientName ? (
                                                        <div className="flex items-center space-x-2">
                                                            <span>{shipment.recipientName}</span>
                                                            {shipment.recipientSignature && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-6 w-6"
                                                                    onClick={(e) => { e.stopPropagation(); handleViewSignature(shipment.recipientSignature!); }}
                                                                    title="View Signature"
                                                                >
                                                                    <IconSignature className="h-4 w-4 text-muted-foreground" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="italic text-muted-foreground/50">N/A</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {(shipment.status === 'COMPLETED' || shipment.status === 'RECEIVED') && shipment.receivedAt ? (
                                                        format(new Date(shipment.receivedAt), 'PPpp')
                                                    ) : (
                                                        <span className="italic text-muted-foreground/50">N/A</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>{format(new Date(shipment.createdAt), 'PPpp')}</TableCell>
                                                <TableCell className="text-center">
                                                    {shipment.status === 'RECEIVED' && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={(e) => { e.stopPropagation(); handleOpenVerificationDialog(shipment); }}
                                                        >
                                                            <IconCheckbox className="mr-1.5 h-4 w-4" /> Verify
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                    <CardFooter className="flex items-center justify-between pt-4 border-t">
                        <div className="text-xs text-muted-foreground">
                            Page {currentPage} of {totalPages} ({totalCount} total shipment{totalCount !== 1 ? 's' : ''})
                        </div>
                        <div className="flex items-center space-x-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handlePrevPage}
                                disabled={currentPage <= 1 || isLoadingTable}
                            >
                                <IconChevronLeft className="h-4 w-4 mr-1" /> Previous
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleNextPage}
                                disabled={currentPage >= totalPages || isLoadingTable}
                            >
                                Next <IconChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                        </div>
                    </CardFooter>
                </Card>

                <ShipmentDetailModal
                    shortId={selectedShortId}
                    isOpen={isDetailModalOpen}
                    onOpenChange={setIsDetailModalOpen}
                    onShipmentUpdate={triggerRefresh}
                    currentUser={currentUser}
                />
            </div>
        );
    };

    return (
        <div
            className={cn(
                "flex h-screen w-full flex-1 flex-col overflow-hidden border border-neutral-200 bg-gray-100 md:flex-row dark:border-neutral-700 dark:bg-neutral-800",
            )}
        >
            <Sidebar open={open} setOpen={setOpen}>
                <SidebarBody className="justify-between gap-10">
                    <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto">
                        {open ? <Logo /> : <LogoIcon />}
                        <div className="mt-8 flex flex-col gap-2">
                            {links.map((link, idx) => (
                                <SidebarLink key={idx} link={link} />
                            ))}
                        </div>
                    </div>
                    <div>
                        <ModeToggle />
                    </div>
                </SidebarBody>
            </Sidebar>
            <MainContent />
        </div>
    );
}

interface CreateShipmentFormProps {
    onSuccess?: () => void;
    currentUser?: { name?: string | null; email?: string | null };
}

const CreateShipmentForm = ({ onSuccess, currentUser }: CreateShipmentFormProps) => {
    // Initialize state with currentUser data or empty string
    const [senderName, setSenderName] = useState(currentUser?.name ?? '');
    const [senderEmail, setSenderEmail] = useState(currentUser?.email ?? '');
    const [devices, setDevices] = useState<DeviceInput[]>([{ id: crypto.randomUUID(), serialNumber: '', assetTag: '', model: '' }]);
    const [locationInputValue, setLocationInputValue] = useState<string>('');
    const [trackingNumber, setTrackingNumber] = useState('');
    const [notifyEmails, setNotifyEmails] = useState('');
    const [notes, setNotes] = useState('');
    const [clientReferenceId, setClientReferenceId] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [locations, setLocations] = useState<PrismaLocation[]>([]);
    const [isLoadingLocations, setIsLoadingLocations] = useState(false);
    const [isLocationPopoverOpen, setIsLocationPopoverOpen] = useState(false);

    useEffect(() => {
        const fetchLocations = async () => {
            setIsLoadingLocations(true);
            try {
                const response = await fetch('/api/admin/locations');
                if (!response.ok) {
                    throw new Error('Failed to fetch locations');
                }
                const data: PrismaLocation[] = await response.json();
                setLocations(data);
            } catch (error) {
                console.error("Error fetching locations for form:", error);
                toast.error("Could not load locations", { description: "Failed to load locations for selection." });
            } finally {
                setIsLoadingLocations(false);
            }
        };

        fetchLocations();
    }, []);

    // Update handleDeviceChange to use keys of DeviceInput
    const handleDeviceChange = (index: number, field: keyof Omit<DeviceInput, 'id'>, value: string) => {
        const newDevices = [...devices];
        // This assignment is safe now because DeviceInput only has string fields
        newDevices[index][field] = value;
        setDevices(newDevices);
    };

    const addDevice = () => {
        setDevices([...devices, { id: crypto.randomUUID(), serialNumber: '', assetTag: '', model: '' }]);
    };

    const removeDevice = (index: number) => {
        const newDevices = devices.filter((_, i) => i !== index);
        if (newDevices.length === 0) {
            setDevices([{ id: crypto.randomUUID(), serialNumber: '', assetTag: '', model: '' }]);
        } else {
            setDevices(newDevices);
        }
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setIsLoading(true);

        const validDevices = devices.filter(d => d.serialNumber.trim() !== '').map(d => ({
            serialNumber: d.serialNumber.trim(),
            assetTag: d.assetTag.trim() || undefined,
            model: d.model.trim() || undefined,
        }));

        if (validDevices.length === 0) {
            toast.error("No valid devices added.", { description: "At least one device with a serial number is required." });
            setIsLoading(false);
            return;
        }

        if (!locationInputValue.trim()) {
            toast.error("Location is required.", { description: "Please select or enter a location." });
            setIsLoading(false);
            return;
        }

        try {
            const response = await fetch('/api/shipments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    senderName: senderName.trim(),
                    senderEmail: senderEmail.trim(),
                    locationValue: locationInputValue.trim(),
                    trackingNumber: trackingNumber.trim() || null,
                    notifyEmails: notifyEmails.trim() || null,
                    notes: notes.trim() || null,
                    clientReferenceId: clientReferenceId.trim() || null,
                    devices: validDevices,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `Shipment creation failed (HTTP ${response.status})`);
            }

            toast.success("Shipment Created Successfully!", {
                description: `Shipment ID: ${data.id}`,
            });

            setSenderName('');
            setSenderEmail('');
            setDevices([{ id: crypto.randomUUID(), serialNumber: '', assetTag: '', model: '' }]);
            setLocationInputValue('');
            setTrackingNumber('');
            setNotifyEmails('');
            setNotes('');
            setClientReferenceId('');

            if (onSuccess) {
                onSuccess();
            }
        } catch (err: any) {
            console.error("Error creating shipment:", err);
            toast.error("Shipment Creation Failed", { description: err.message });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="modal-sender-name">Sender Name</Label>
                    <Input id="modal-sender-name" value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder="Your Name / Dept" required />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="modal-sender-email">Sender Email</Label>
                    <Input id="modal-sender-email" type="email" value={senderEmail} onChange={(e) => setSenderEmail(e.target.value)} placeholder="your.email@example.com" required />
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="modal-location">Destination</Label>
                <Popover open={isLocationPopoverOpen} onOpenChange={setIsLocationPopoverOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={isLocationPopoverOpen}
                            className="w-full justify-between font-normal"
                            disabled={isLoadingLocations}
                        >
                            {locationInputValue
                                ? locations.find((loc) => loc.id === locationInputValue)?.name || locationInputValue
                                : isLoadingLocations ? "Loading destinations..." : "Select or type destination..."}
                            <IconSelector className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                        <Command shouldFilter={true}>
                            <CommandInput
                                placeholder="Search or type new destination..."
                                value={locations.find(loc => loc.id === locationInputValue)?.name || locationInputValue}
                                onValueChange={(searchValue) => {
                                    setLocationInputValue(searchValue);
                                }}
                            />
                            <CommandList>
                                <CommandEmpty>No destination found. Type to create new.</CommandEmpty>
                                <CommandGroup heading="Existing Destinations">
                                    {locations.map((loc) => (
                                        <CommandItem
                                            key={loc.id}
                                            value={loc.name}
                                            onSelect={(currentValue) => {
                                                const selectedLoc = locations.find(l => l.name.toLowerCase() === currentValue.toLowerCase());
                                                setLocationInputValue(selectedLoc ? selectedLoc.id : currentValue);
                                                setIsLocationPopoverOpen(false);
                                            }}
                                        >
                                            <IconCheck
                                                className={cn(
                                                    "mr-2 h-4 w-4",
                                                    locationInputValue === loc.id ? "opacity-100" : "opacity-0"
                                                )}
                                            />
                                            {loc.name}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
                {isLoadingLocations && <p className="text-xs text-muted-foreground">Fetching destinations...</p>}
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                <h4 className="font-medium text-sm">Devices</h4>
                {devices.map((device, index) => (
                    <div key={device.id} className="flex items-end gap-2">
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div className="space-y-1">
                                <Label htmlFor={`modal-serial-${index}`} className="text-xs">Serial*</Label>
                                <Input id={`modal-serial-${index}`} value={device.serialNumber} onChange={(e) => handleDeviceChange(index, 'serialNumber', e.target.value)} placeholder="C02X..." required />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor={`modal-asset-${index}`} className="text-xs">Asset Tag</Label>
                                <Input id={`modal-asset-${index}`} value={device.assetTag} onChange={(e) => handleDeviceChange(index, 'assetTag', e.target.value)} placeholder="ASSET-123" />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor={`modal-model-${index}`} className="text-xs">Model</Label>
                                <Input id={`modal-model-${index}`} value={device.model} onChange={(e) => handleDeviceChange(index, 'model', e.target.value)} placeholder="iPad 9th Gen" />
                            </div>
                        </div>
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeDevice(index)} disabled={devices.length <= 1} className="text-red-500 hover:text-red-700 disabled:opacity-50 shrink-0" aria-label="Remove device">
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addDevice} className="mt-2 w-full">
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Another Device
                </Button>
            </div>

            <div className="space-y-2">
                <Label htmlFor="modal-tracking-number">Tracking Number (Optional)</Label>
                <Input
                    id="modal-tracking-number"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="e.g., 1Z999AA10123456784"
                    disabled={isLoading}
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="modal-notify-emails">Notify Emails (Optional)</Label>
                <Input
                    id="modal-notify-emails"
                    value={notifyEmails}
                    onChange={(e) => setNotifyEmails(e.target.value)}
                    placeholder="Comma-separated emails, e.g., user@example.com, team@example.com"
                    disabled={isLoading}
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="modal-create-notes">Notes (Optional)</Label>
                <Input
                    id="modal-create-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Special instructions or details"
                    disabled={isLoading}
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="modal-create-clientReferenceId">Client Reference ID (Optional)</Label>
                <Input
                    id="modal-create-clientReferenceId"
                    value={clientReferenceId}
                    onChange={(e) => setClientReferenceId(e.target.value)}
                    placeholder="e.g., PO-12345 or Ticket-ABC"
                    disabled={isLoading}
                />
            </div>

            <DialogFooter>
                <Button type="submit" disabled={isLoading}>
                    {isLoading ? <><IconLoader2 className="animate-spin mr-2" /> Creating...</> : 'Create Shipment'}
                </Button>
            </DialogFooter>
        </form>
    );
};

