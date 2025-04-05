'use client';

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from 'next/navigation'; // Hook to get route params
import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar";
import {
  IconArrowLeft,
  IconPackage,
  IconSettings,
  IconLocation,
  IconMail,
  IconUserPlus, // For adding recipients
  IconTrash,    // For removing recipients
  IconLoader2,
  IconAlertCircle,
  IconFileDescription,
  IconSignature, // For signature status
} from "@tabler/icons-react";
import Link from "next/link";
import { motion } from "motion/react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { ModeToggle } from "@/components/theme-toggle";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Badge } from "@/components/ui/badge";
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from "sonner";
import { Toaster as SonnerToaster } from "sonner";
import { Logo, LogoIcon } from "@/components/layout/logos"; // Import shared logos
import { PDFDownloadLink } from '@react-pdf/renderer';
import { ShipmentManifestPDF } from '@/components/pdf/ShipmentManifestPDF';
import { toDataURL as qrToDataURL } from 'qrcode';
import { ShipmentStatus, Location as PrismaLocation, Device as PrismaDevice } from "@prisma/client";

// --- Interfaces ---
// Define interfaces based on expected data structure, using Prisma types
interface Shipment {
  id: string;
  shortId: string;
  senderName: string;
  senderEmail: string;
  destination: string; // This field seems redundant if `location` object is present
  status: ShipmentStatus; // Use imported enum
  manifestUrl?: string | null;
  createdAt: string; // Consider Date if needed elsewhere
  updatedAt: string; // Consider Date
  devices: PrismaDevice[]; // Use imported type
  recipientName: string | null;
  recipientEmail: string | null;
  recipientSignature: string | null;
  receivedAt: string | null; // Consider Date
  locationId: string | null;
  location: PrismaLocation | null; // Use imported type, non-optional but nullable
  trackingNumber?: string | null;
  trackingId?: string | null;
  trackingInfo?: any | null;
}

interface DestinationDetail {
  id: string;
  name: string;
  recipientEmails: string[];
  shipments?: Shipment[]; // Reference the corrected Shipment interface
}

// Data structure expected from the /api/admin/locations/[locationId] endpoint
// Not strictly needed for component state if handled correctly in fetchData
// interface LocationPageData {
//   location: DestinationDetail;
//   shipments: Shipment[];
// }
// ----------------------------------------------------

// --- Add Recipient Dialog Component ---
interface AddRecipientDialogProps {
  locationId: string;
  onSuccess: () => void; // Callback after successful addition
}

function AddRecipientDialog({ locationId, onSuccess }: AddRecipientDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newRecipientEmail, setNewRecipientEmail] = useState("");
  const [isAddingRecipient, setIsAddingRecipient] = useState(false);

  const handleAddRecipient = async () => {
    if (!newRecipientEmail.includes('@')) { // Basic validation
      toast.error("Invalid Email", { description: "Please enter a valid email address."});
      return;
    }
    setIsAddingRecipient(true);
    try {
      const response = await fetch(`/api/admin/locations/${locationId}/recipients`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addEmail: newRecipientEmail }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to add recipient email.");
      }
      toast.success(`Email "${newRecipientEmail}" added successfully.`);
      setNewRecipientEmail(""); // Clear input
      setIsOpen(false); // Close dialog
      console.log("AddRecipientDialog: Calling onSuccess (fetchData)"); // Log before calling
      onSuccess(); // Trigger data refresh in parent
      console.log("AddRecipientDialog: onSuccess (fetchData) called"); // Log after calling
    } catch (err: any) {
      console.error("Error adding recipient:", err);
      toast.error("Failed to Add Email", { description: err.message });
    } finally {
      setIsAddingRecipient(false);
    }
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const email = e.target.value;
    console.log("AddRecipientDialog: Email changing to:", email);
    setNewRecipientEmail(email);
  }

  // Reset email input when dialog opens
  const handleOpenChange = (open: boolean) => {
    if (open) {
      setNewRecipientEmail("");
    }
    setIsOpen(open);
  };

  // Log state right before rendering the footer
  // console.log("AddRecipientDialog: Rendering footer - isAdding:", isAddingRecipient, "includes @:", newRecipientEmail.includes('@'));

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <IconUserPlus className="mr-2 h-4 w-4"/> Add Email
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Recipient Email</DialogTitle>
          <DialogDescription>Enter the email address to add to this destination.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid items-center gap-1.5">
            <Label htmlFor="recipient-email-dialog">Email Address</Label>
            <Input
              id="recipient-email-dialog"
              type="email"
              value={newRecipientEmail}
              onChange={handleEmailChange}
              placeholder="recipient@example.com"
              disabled={isAddingRecipient}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button onClick={handleAddRecipient} disabled={isAddingRecipient || !newRecipientEmail.includes('@')}>
            {isAddingRecipient ? <IconLoader2 className="mr-2 h-4 w-4 animate-spin"/> : null} Add Email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
// -------------------------------------

// --- Main Page Component ---
export default function DestinationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const locationId = params.locationId as string; // Get ID from route

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [destination, setDestination] = useState<DestinationDetail | null>(null);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrCodeUrls, setQrCodeUrls] = useState<Record<string, string>>({});

  // State for managing recipients
  const [isRemoveRecipientOpen, setIsRemoveRecipientOpen] = useState(false);
  const [recipientToRemove, setRecipientToRemove] = useState<string | null>(null);
  const [isRemovingRecipient, setIsRemovingRecipient] = useState(false);

  // Modify state to hold signature details object
  const [signatureToView, setSignatureToView] = useState<{ 
    dataUrl: string; 
    shortId: string; 
    recipientName: string | null; 
  } | null>(null);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);

  // Sidebar links (adjust active state later)
  const links = [
    { label: "Shipments", href: "/", icon: <IconPackage className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" /> },
    { label: "Destinations", href: "/locations", icon: <IconLocation className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" /> },
    { label: "Settings", href: "/settings", icon: <IconSettings className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" /> },
    { label: "Logout", href: "/api/auth/signout", icon: <IconArrowLeft className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" /> },
  ];

  // Fetch data function
  const fetchData = async () => {
    if (!locationId) return;
    console.log("fetchData: Starting fetch for location:", locationId);
    setIsLoading(true);
    setError(null);
    setQrCodeUrls({});
    try {
      const response = await fetch(`/api/admin/locations/${locationId}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch destination details (HTTP ${response.status})`);
      }
      const responseData = await response.json();
      console.log("fetchData: Received raw response data:", responseData);

      if (!responseData || !responseData.location) {
          throw new Error("Invalid data structure received from API.");
      }

      setDestination(responseData.location);
      const fetchedShipments = responseData.shipments || [];
      setShipments(fetchedShipments);
      console.log("fetchData: Set destination state:", responseData.location);
      console.log("fetchData: Set shipments state:", fetchedShipments);

      if (fetchedShipments.length > 0 && typeof window !== 'undefined') {
         console.log("fetchData: Starting QR code generation...");
         const generatedUrls: Record<string, string> = {};
         const baseUrl = window.location.origin;
         await Promise.all(fetchedShipments.map(async (ship: Shipment) => {
            if (ship.shortId) {
                 const receiveUrl = `${baseUrl}/receive/${ship.shortId}`;
                 try {
                    const url = await qrToDataURL(receiveUrl, { errorCorrectionLevel: 'L', margin: 1, width: 100 }); 
                    generatedUrls[ship.shortId] = url;
                 } catch (qrErr) {
                    console.error(`Failed to generate QR code for ${ship.shortId} on locations page:`, qrErr);
                 }
            }
         }));
         setQrCodeUrls(generatedUrls);
         console.log("fetchData: Finished QR Code generation. URLs set:", Object.keys(generatedUrls).length);
      }

    } catch (err: any) {
      console.error("Error fetching destination details:", err);
      setError(err.message || "An unexpected error occurred.");
      toast.error("Error Loading Destination", { description: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch data on mount
  useEffect(() => {
    fetchData();
  }, [locationId]);

  // --- Handlers for Recipient Management ---
  const handleRemoveRecipient = async () => {
    if (!recipientToRemove) return;
    setIsRemovingRecipient(true);
    try {
         const response = await fetch(`/api/admin/locations/${locationId}/recipients`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ removeEmail: recipientToRemove }),
        });
         if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || "Failed to remove recipient email.");
        }
        toast.success(`Email "${recipientToRemove}" removed successfully.`);
        setRecipientToRemove(null);
        setIsRemoveRecipientOpen(false); // Close alert dialog
        fetchData(); // Refresh location data
    } catch (err: any) {
        console.error("Error removing recipient:", err);
        toast.error("Failed to Remove Email", { description: err.message });
    } finally {
        setIsRemovingRecipient(false);
    }
  };

  // --- Handler to open signature modal ---
  // Update handler to accept and store the details object
  const handleViewSignature = (signatureDetails: { 
    dataUrl: string; 
    shortId: string; 
    recipientName: string | null; 
  }) => {
    setSignatureToView(signatureDetails);
    setIsSignatureModalOpen(true);
  };
  // ---------------------------------------------------

  // --- Main Content Rendering Logic ---
  const DestinationContent = () => {
    // Get router instance
    const router = useRouter(); 

    if (isLoading) {
      return <div className="flex-1 flex items-center justify-center"><IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
    }
    if (error) {
      return <div className="flex-1 flex items-center justify-center text-destructive px-4"><IconAlertCircle className="mr-2"/> Error loading destination details: {error}</div>;
    }
    if (!destination) {
       return <div className="flex-1 flex items-center justify-center text-muted-foreground">Location not found.</div>;
    }

    const currentRecipientEmails = destination.recipientEmails || [];
    const currentShipments = shipments;

    return (
      <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 overflow-y-auto">
        <SonnerToaster richColors position="top-right"/>
        <div className="flex items-center justify-between space-y-2 mb-6">
          {/* Group Title and Back Button */}
          <div className="flex items-center gap-4">
            {/* Back Button */}
             <Button variant="outline" size="icon" onClick={() => router.push('/locations')} title="Back to Locations List">
                 <IconArrowLeft className="h-4 w-4" />
             </Button>
             {/* Title Area */}
            <div>
              <h2 className="text-3xl font-bold tracking-tight">Location: {destination.name}</h2>
               <p className="text-sm text-muted-foreground">Manage recipient emails and view associated shipments.</p>
            </div>
           </div>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle>Recipient Emails</CardTitle>
                <CardDescription>Emails notified when a shipment arrives at this destination.</CardDescription>
            </div>
            <AddRecipientDialog locationId={locationId} onSuccess={fetchData} />
          </CardHeader>
          <CardContent>
            {currentRecipientEmails.length > 0 ? (
                <ul className="space-y-2">
                    {currentRecipientEmails.map((email: string) => (
                        <li key={email} className="flex items-center justify-between text-sm border-b pb-2 last:border-b-0">
                            <span>{email}</span>
                             <AlertDialog open={isRemoveRecipientOpen && recipientToRemove === email} onOpenChange={(open) => {if(!open) setRecipientToRemove(null); setIsRemoveRecipientOpen(open);}}>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setRecipientToRemove(email)}>
                                        <IconTrash className="h-4 w-4" />
                                        <span className="sr-only">Remove {email}</span>
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Remove Recipient?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Are you sure you want to remove <span className="font-medium">{recipientToRemove}</span> from this destination's recipients?
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel disabled={isRemovingRecipient}>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleRemoveRecipient} disabled={isRemovingRecipient} className="bg-destructive text-background hover:bg-destructive/90">
                                             {isRemovingRecipient ? <IconLoader2 className="mr-2 h-4 w-4 animate-spin"/> : null} Remove
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-sm text-muted-foreground italic">No recipient emails configured for this destination.</p>
            )}
          </CardContent>
        </Card>

        <Separator />

        <Card>
            <CardHeader>
                <CardTitle>Associated Shipments</CardTitle>
                <CardDescription>Shipments sent to this destination.</CardDescription>
            </CardHeader>
            <CardContent>
                 <Table>
                    <TableCaption>Shipments associated with this destination.</TableCaption>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[100px]">ID</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead>Devices (Serials)</TableHead>
                            <TableHead>Received By</TableHead>
                            <TableHead className="text-center">Signature</TableHead>
                            <TableHead className="text-center">Manifest</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {currentShipments.length === 0 ? (
                             <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No shipments found for this destination.</TableCell></TableRow>
                        ) : (
                            currentShipments.map((shipment) => (
                                <TableRow key={shipment.shortId} className="hover:bg-muted/50">
                                    <TableCell className="font-mono text-xs font-medium">{shipment.shortId}</TableCell>
                                    <TableCell>
                                         <Badge variant={shipment.status === 'RECEIVED' || shipment.status === 'COMPLETED' ? 'default' : 'secondary'} className="capitalize">
                                            {shipment.status?.toLowerCase() ?? 'Unknown'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell title={new Date(shipment.createdAt).toLocaleString()}>{formatDistanceToNow(new Date(shipment.createdAt), { addSuffix: true })}</TableCell>
                                     <TableCell className="text-xs max-w-[200px] truncate" title={shipment.devices.map(d => d.serialNumber).join(', ')}>
                                        {shipment.devices.map(d => d.serialNumber).join(', ')}
                                     </TableCell>
                                    <TableCell>{shipment.recipientName || <span className="italic text-muted-foreground/70">N/A</span>}</TableCell>
                                    <TableCell className="text-center">
                                        {shipment.recipientSignature && shipment.shortId ? (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-green-600 hover:text-green-700 mx-auto"
                                                // Pass the details object onClick
                                                onClick={() => handleViewSignature({
                                                    dataUrl: shipment.recipientSignature!,
                                                    shortId: shipment.shortId!,
                                                    recipientName: shipment.recipientName
                                                })}
                                                title={`View Signature from ${shipment.recipientName || 'recipient'}`}
                                            >
                                                <IconSignature className="h-5 w-5" />
                                            </Button>
                                        ) : (
                                             <span className="italic text-muted-foreground/70">N/A</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {shipment.shortId ? (
                                            <PDFDownloadLink
                                                document={<ShipmentManifestPDF shipment={shipment} qrDataUrl={qrCodeUrls[shipment.shortId] || null} />}
                                                fileName={`Manifest-${shipment.shortId}.pdf`}
                                            >
                                                {({ loading, error: pdfError }) => {
                                                    const isQrReady = !!qrCodeUrls[shipment.shortId];
                                                    const isButtonLoading = loading || !isQrReady;
                                                    const buttonTitle = pdfError ? "Error generating PDF" : loading ? "Generating PDF..." : !isQrReady ? "Generating QR..." : "Download Manifest PDF";
                                                    return (
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            title={buttonTitle}
                                                            disabled={isButtonLoading || !!pdfError}
                                                        >
                                                            {isButtonLoading ? (
                                                                <IconLoader2 className="h-4 w-4 animate-spin" />
                                                             ) : pdfError ? (
                                                                <IconAlertCircle className="h-4 w-4 text-destructive" />
                                                             ) : (
                                                                <IconFileDescription className="h-4 w-4"/>
                                                             )}
                                                        </Button>
                                                    );
                                                }}
                                            </PDFDownloadLink>
                                        ) : <span className="italic text-muted-foreground/70">N/A</span>}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                 </Table>
            </CardContent>
        </Card>
      </div>
    );
  };

  // --- Render Page Layout ---
  return (
    <div className={cn("flex h-screen w-full flex-1 flex-col overflow-hidden border border-neutral-200 bg-gray-100 md:flex-row dark:border-neutral-700 dark:bg-neutral-800")}>
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen}>
        <SidebarBody className="justify-between gap-10">
          <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto">
             {/* Use imported components */}
            {sidebarOpen ? <Logo /> : <LogoIcon />}
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
      <DestinationContent />

      {/* --- Signature Modal --- */} 
      <Dialog open={isSignatureModalOpen} onOpenChange={setIsSignatureModalOpen}>
          <DialogContent className="max-w-md">
              <DialogHeader>
                  <DialogTitle>Recipient Signature</DialogTitle>
                  {/* Use details directly from state object */} 
                  {signatureToView && (
                      <DialogDescription>
                          Signature provided for shipment {signatureToView.shortId || 'N/A'} received by {signatureToView.recipientName || 'recipient'}.
                      </DialogDescription>
                  )}
              </DialogHeader>
              <div className="py-4">
                  {/* Use dataUrl from state object */} 
                  {signatureToView?.dataUrl ? (
                      <img
                          src={signatureToView.dataUrl}
                          alt="Recipient Signature"
                          className="mx-auto border border-muted bg-white"
                          style={{ maxWidth: '100%', height: 'auto' }}
                      />
                  ) : (
                      <p className="text-center text-muted-foreground">Signature not available.</p>
                  )}
              </div>
              <DialogFooter>
                  <Button variant="outline" onClick={() => setIsSignatureModalOpen(false)}>Close</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  );
  // -------------------------
} 