'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSession, signIn } from "next-auth/react"; // Import auth hooks
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Need Select for status filter
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog"; // Added Dialog components
import { toast } from "sonner";
import { ShipmentStatus } from '@prisma/client'; // Use for status filter options
import Link from 'next/link'; // To link to shipment detail page
import { Label } from "@/components/ui/label";
import { Edit } from 'lucide-react'; // Added Edit icon

// Define the shape of the data received from the API
interface ShipmentSummary {
  id: string;
  createdAt: string; // Dates will be strings from JSON
  updatedAt: string;
  senderName: string;
  senderEmail: string;
  destination: string;
  status: ShipmentStatus;
  recipientName: string | null;
  receivedAt: string | null;
  deviceCount: number;
  manifestUrl: string | null;
  recipientEmail: string | null;
  trackingId: string | null;
  // Add other fields if needed from the API response
}

// Interface for the data being edited in the dialog
interface EditShipmentData {
    destination: string;
    recipientEmail: string;
    trackingId: string;
    status: ShipmentStatus;
}

export default function AdminDashboardPage() {
  const { data: session, status } = useSession(); // Get session status
  const [shipments, setShipments] = useState<ShipmentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true); // Initial loading includes auth check
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [emailFilter, setEmailFilter] = useState<string>('');

  // State for Edit Dialog
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingShipment, setEditingShipment] = useState<ShipmentSummary | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<EditShipmentData>>({}); // Use Partial for flexibility
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchShipments = useCallback(async () => { // Make it useCallback
    // Only fetch if authenticated
    if (status !== 'authenticated') {
        setIsLoading(false); // Stop loading if not authenticated
        return;
    }
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      if (emailFilter.trim()) {
        params.append('email', emailFilter.trim());
      }

      // TODO: Ensure the API route /api/admin/shipments is also protected
      const response = await fetch(`/api/admin/shipments?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        // Handle 401/403 from API if protection is added there
        if (response.status === 401 || response.status === 403) {
            throw new Error('Unauthorized to fetch shipments.');
        } else {
            throw new Error(data.error || 'Failed to fetch shipments');
        }
      }
      setShipments(data);
    } catch (error: any) {
      console.error("Fetch shipments error:", error);
      toast.error("Error Fetching Shipments", {
        description: error.message || "Could not load shipment data.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [status, statusFilter, emailFilter, toast]); // Add dependencies

  // Fetch shipments when authenticated and filters change
  useEffect(() => {
    if (status === 'authenticated') {
      fetchShipments();
    }
    // If loading status is done and user is unauthenticated, prompt login
    if (status === 'unauthenticated') {
        setIsLoading(false);
        // Optionally redirect or show message
    }
  }, [status, fetchShipments]);

  // Prepare data and open edit dialog
  const handleEditClick = (shipment: ShipmentSummary) => {
      setEditingShipment(shipment);
      setEditFormData({
          destination: shipment.destination || '',
          recipientEmail: shipment.recipientEmail || '', // Use field from updated schema
          trackingId: shipment.trackingId || '', // Use field from updated schema
          status: shipment.status,
      });
      setIsEditDialogOpen(true);
  };

  // Handle changes in the edit form
  const handleEditFormChange = (field: keyof EditShipmentData, value: string | ShipmentStatus) => {
      setEditFormData(prev => ({ ...prev, [field]: value }));
  };

  // Handle submission of the edit form
  const handleUpdateShipment = async () => {
    if (!editingShipment) return;
    setIsUpdating(true);
    try {
        const payload: Partial<EditShipmentData> = {};
        // Only include fields that have actually changed from the original
        if (editFormData.destination !== editingShipment.destination) payload.destination = editFormData.destination;
        if (editFormData.recipientEmail !== (editingShipment.recipientEmail || '')) payload.recipientEmail = editFormData.recipientEmail;
        if (editFormData.trackingId !== (editingShipment.trackingId || '')) payload.trackingId = editFormData.trackingId;
        if (editFormData.status !== editingShipment.status) payload.status = editFormData.status;

        if (Object.keys(payload).length === 0) {
             toast.info("No Changes", { description: "No fields were modified." });
             setIsEditDialogOpen(false);
             return;
        }

        const response = await fetch(`/api/shipments/${editingShipment.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const updatedData = await response.json();
        if (!response.ok) {
            throw new Error(updatedData.error || 'Failed to update shipment');
        }
        toast.success("Success", { description: "Shipment updated successfully." });
        setIsEditDialogOpen(false);
        fetchShipments(); // Refresh the data
    } catch (error: any) {
        toast.error("Update Failed", { description: error.message });
    } finally {
        setIsUpdating(false);
    }
  };

  // Memoize the status options to avoid recreating the array on every render
  const statusOptions = useMemo(() => [
      { value: 'all', label: 'All Statuses' },
      ...Object.values(ShipmentStatus).map(status => ({ value: status, label: status }))
  ], []);

  // Options specifically for the edit dialog status dropdown
  const editStatusOptions = useMemo(() =>
     Object.values(ShipmentStatus)
         // Filter out statuses that shouldn't be set manually via edit
         .filter(s => s !== ShipmentStatus.COMPLETED) // Add RECEIVING back if PATCH allows it
         .map(status => ({ value: status, label: status })), 
  []);

  // Handle Authentication States
  if (status === "loading") {
    return <div className="container mx-auto p-8 text-center">Loading session...</div>;
  }

  if (status === "unauthenticated") {
    return (
        <div className="container mx-auto p-8 text-center">
            <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
            <p className="mb-6">You must be signed in to view the admin dashboard.</p>
            <Button onClick={() => signIn('keycloak')}>Sign in with Keycloak</Button>
        </div>
    );
  }

  // Render dashboard content when authenticated
  return (
    <div className="container mx-auto p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard - Shipments</h1>

      {/* Filtering Controls */}
      <div className="flex flex-col md:flex-row gap-4 mb-6 p-4 border rounded-lg bg-card text-card-foreground">
         <div className="flex-1">
            <Label htmlFor="emailFilter">Filter by Sender Email</Label>
            <Input
                id="emailFilter"
                type="text"
                placeholder="e.g., tech@example.com"
                value={emailFilter}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmailFilter(e.target.value)}
                className="mt-1"
            />
        </div>
        <div className="flex-1">
             <Label htmlFor="statusFilter">Filter by Status</Label>
             <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="statusFilter" className="mt-1">
                    <SelectValue placeholder="Select Status" />
                </SelectTrigger>
                <SelectContent>
                    {statusOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
        {/* Optional: Add a refresh button? */}
         {/* <Button onClick={fetchShipments} disabled={isLoading}>Refresh</Button> */} 
      </div>

      {/* Shipments Table */}
      {isLoading && !isEditDialogOpen ? (
        <p>Loading shipments...</p>
      ) : (
        <Table>
          <TableCaption>A list of recent shipments.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Shipment ID</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Sender</TableHead>
              <TableHead>Destination</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Devices</TableHead>
              <TableHead>Recipient</TableHead>
              <TableHead>Received At</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shipments.length === 0 ? (
                 <TableRow>
                    <TableCell colSpan={9} className="text-center">No shipments found matching the criteria.</TableCell>
                 </TableRow>
            ) : (
                shipments.map((shipment) => (
                <TableRow key={shipment.id}>
                    <TableCell className="font-mono text-xs">{shipment.id.substring(0, 8)}...</TableCell>
                    <TableCell>{new Date(shipment.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>{shipment.senderName} ({shipment.senderEmail})</TableCell>
                    <TableCell>{shipment.destination}</TableCell>
                    <TableCell>
                        {/* TODO: Add status badge component */} (
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${ 
                            shipment.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 
                            shipment.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' : 
                            shipment.status === 'CANCELLED' ? 'bg-red-100 text-red-800' : 
                            'bg-gray-100 text-gray-800' 
                        }`}>
                            {shipment.status}
                        </span>
                    </TableCell>
                    <TableCell className="text-center">{shipment.deviceCount}</TableCell>
                    <TableCell>{shipment.recipientName || '-'}</TableCell>
                    <TableCell>{shipment.receivedAt ? new Date(shipment.receivedAt).toLocaleDateString() : '-'}</TableCell>
                    <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                             <Link href={`/receive/${shipment.id}`} passHref legacyBehavior>
                                <Button variant="outline" size="sm" asChild>
                                    <a>View</a>
                                </Button>
                            </Link>
                            <Button variant="ghost" size="sm" onClick={() => handleEditClick(shipment)} disabled={shipment.status === 'COMPLETED'}>
                                <Edit className="h-4 w-4" />
                            </Button>
                        </div>
                    </TableCell>
                </TableRow>
                ))
            )}
          </TableBody>
        </Table>
      )}
      {/* TODO: Add Pagination controls */} (

      {/* Edit Shipment Dialog */}
      {editingShipment && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Edit Shipment: {editingShipment.id.substring(0, 8)}...</DialogTitle>
              <DialogDescription>
                Update shipment details. Changes cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-destination" className="text-right">Destination</Label>
                <Input
                  id="edit-destination"
                  value={editFormData.destination || ''}
                  onChange={(e) => handleEditFormChange('destination', e.target.value)}
                  className="col-span-3"
                />
              </div>
               <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-recipientEmail" className="text-right">Recipient Email</Label>
                <Input
                  id="edit-recipientEmail"
                  type="email"
                  value={editFormData.recipientEmail || ''}
                  onChange={(e) => handleEditFormChange('recipientEmail', e.target.value)}
                  className="col-span-3"
                   placeholder="(Optional)"
                />
              </div>
               <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-trackingId" className="text-right">Tracking ID</Label>
                <Input
                  id="edit-trackingId"
                  value={editFormData.trackingId || ''}
                  onChange={(e) => handleEditFormChange('trackingId', e.target.value)}
                  className="col-span-3"
                   placeholder="(Optional)"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-status" className="text-right">Status</Label>
                 <Select
                    value={editFormData.status}
                    onValueChange={(value) => handleEditFormChange('status', value as ShipmentStatus)}
                 >
                    <SelectTrigger id="edit-status" className="col-span-3">
                        <SelectValue placeholder="Select Status" />
                    </SelectTrigger>
                    <SelectContent>
                        {editStatusOptions.map(option => (
                            <SelectItem key={option.value} value={option.value} disabled={option.value === editingShipment.status}>
                                {/* Corrected JSX comment syntax */}
                                {/* Prevent selecting the current status? Might be confusing */}
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                 </Select>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                  <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="button" onClick={handleUpdateShipment} disabled={isUpdating}>
                {isUpdating ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
} 