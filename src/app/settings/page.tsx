'use client';

import React, { useState, useEffect } from "react";
import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar";
import {
  IconArrowLeft,
  IconPackage,
  IconSettings,
  IconKey,
  IconLoader2,
  IconPlus,
  IconTrash,
  IconCopy,
  IconAlertCircle,
  IconLocation,
  IconUser
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
import { Switch } from "@/components/ui/switch"; // Import Switch if adding toggles

// --- Interfaces ---
interface ApiKey {
  id: string;
  description: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  isActive: boolean;
}
// ------------------

// Main Settings Page Component
export default function SettingsPage() {
  const [open, setOpen] = useState(false);

  // Sidebar links (adjust active state based on route later if needed)
  const links = [
    { label: "Shipments", href: "/", icon: <IconPackage className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" /> },
    { label: "Destinations", href: "/locations", icon: <IconLocation className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" /> },
    { label: "Settings", href: "/settings", icon: <IconSettings className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" /> }, // Current page
    { label: "Users", href: "/users", icon: <IconUser className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" /> },
    { label: "Logout", href: "/api/auth/signout", icon: <IconArrowLeft className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" /> },
  ];

  // Main Content Area for Settings
  const SettingsContent = () => {
    // State for API Keys section
    const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
    const [isLoadingKeys, setIsLoadingKeys] = useState(true);
    const [errorKeys, setErrorKeys] = useState<string | null>(null);
    const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
    const [newApiKey, setNewApiKey] = useState<string | null>(null); // To display the generated key temporarily
    const [newKeyDescription, setNewKeyDescription] = useState("");
    const [isGenerating, setIsGenerating] = useState(false); // Loading state for generation
    const [isRevokeAlertOpen, setIsRevokeAlertOpen] = useState(false);
    const [keyToRevoke, setKeyToRevoke] = useState<ApiKey | null>(null);
    const [isRevoking, setIsRevoking] = useState(false); // Loading state for revoking

    // --- State for Email Settings --- 
    const [adminNotifyEmails, setAdminNotifyEmails] = useState(""); 
    const [initialAdminNotifyEmails, setInitialAdminNotifyEmails] = useState(""); // Track initial state
    const [isLoadingEmailSettings, setIsLoadingEmailSettings] = useState(true); // Loading state
    const [isSavingEmailSettings, setIsSavingEmailSettings] = useState(false); 
    
    // --- Fetch Email Settings --- 
    const fetchEmailSettings = async () => {
        setIsLoadingEmailSettings(true);
        try {
            // GET endpoint needed to fetch current settings
            const response = await fetch('/api/admin/settings/email'); // Assumes a GET handler exists
            if (!response.ok) {
                if (response.status === 404) { // Handle case where setting doesn't exist yet
                   console.log("Admin email setting not found, using default empty.");
                   setAdminNotifyEmails("");
                   setInitialAdminNotifyEmails("");
                } else {
                    throw new Error(`Failed to fetch email settings (HTTP ${response.status})`);
                }
            } else {
                const data = await response.json();
                setAdminNotifyEmails(data.value || "");
                setInitialAdminNotifyEmails(data.value || "");
            }
        } catch (err: any) {
            console.error("Error fetching email settings:", err);
            toast.error("Failed to load email settings", { description: err.message });
            // Keep current value or reset?
        } finally {
            setIsLoadingEmailSettings(false);
        }
    };

    // Fetch settings on component mount
    useEffect(() => {
        fetchEmailSettings();
    }, []);
    // ---------------------------

    // --- Save Email Settings --- 
    const handleSaveEmailSettings = async () => {
        setIsSavingEmailSettings(true);
        toast.info("Saving email settings...");
        try {
            const response = await fetch('/api/admin/settings/email', { 
                method: 'PUT', 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ adminNotifyEmails: adminNotifyEmails.trim() }) // Send trimmed value
            });
            const result = await response.json();
            if (!response.ok) { throw new Error(result.error || "Failed to save settings."); }
            
            toast.success("Email settings saved!");
            setInitialAdminNotifyEmails(adminNotifyEmails.trim()); // Update initial state on success
        } catch (err: any) {
            toast.error("Save Failed", { description: err.message });
        } finally {
            setIsSavingEmailSettings(false);
        }
    };
    // ------------------------------ 
    
    // Determine if changes have been made
    const hasEmailChanges = adminNotifyEmails !== initialAdminNotifyEmails;

    // Fetch API Keys
    const fetchApiKeys = async () => {
        setIsLoadingKeys(true);
        setErrorKeys(null);
        try {
            // TODO: Ensure this request is authenticated (e.g., via session cookie)
            const response = await fetch('/api/admin/apikeys'); // Assumed endpoint
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Failed to fetch API keys (HTTP ${response.status})`);
            }
            const data: ApiKey[] = await response.json();
            setApiKeys(data);
        } catch (err: any) {
            console.error("Error fetching API keys:", err);
            setErrorKeys(err.message || "An unexpected error occurred.");
            toast.error("Error Fetching Keys", { description: err.message });
        } finally {
            setIsLoadingKeys(false);
        }
    };

    // Fetch keys on component mount
    useEffect(() => {
        fetchApiKeys();
    }, []);

    // Placeholder for Generate Key Logic
    const handleGenerateKey = async () => {
        if (!newKeyDescription.trim()) {
            toast.error("Description is required.");
            return;
        }
        setIsGenerating(true);
        setNewApiKey(null); // Clear previous key
        try {
            // TODO: Ensure authenticated request
            const response = await fetch('/api/admin/apikeys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ description: newKeyDescription }),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || "Failed to generate key.");
            }
            // IMPORTANT: Backend MUST return the full key *only* on creation
            setNewApiKey(data.apiKey); // Assume backend returns { apiKey: "full_key_string", ...otherData }
            toast.success("API Key Generated Successfully!");
            setNewKeyDescription(""); // Clear description input
            // Don't close dialog immediately, show the key first
            fetchApiKeys(); // Refresh the list in the background
        } catch (err: any) {
            console.error("Error generating key:", err);
            toast.error("Key Generation Failed", { description: err.message });
        } finally {
            setIsGenerating(false);
        }
    };

    // Placeholder for Revoke Key Logic
    const handleRevokeKey = async () => {
        if (!keyToRevoke) return;
        setIsRevoking(true);
        try {
             // TODO: Ensure authenticated request
            const response = await fetch(`/api/admin/apikeys/${keyToRevoke.id}`, {
                method: 'DELETE',
            });
            if (!response.ok) {
                 const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || "Failed to revoke key.");
            }
            toast.success(`API Key revoked successfully.`);
            setKeyToRevoke(null);
            setIsRevokeAlertOpen(false);
            fetchApiKeys(); // Refresh list
        } catch (err: any) {
             console.error("Error revoking key:", err);
             toast.error("Key Revocation Failed", { description: err.message });
        } finally {
            setIsRevoking(false);
        }
    };

     // Function to copy key to clipboard
     const copyToClipboard = (key: string | null) => {
        if (!key) return;
        navigator.clipboard.writeText(key)
            .then(() => toast.success("API Key copied to clipboard!"))
            .catch(err => toast.error("Failed to copy key."));
    };

    return (
      <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 overflow-y-auto">
        <SonnerToaster richColors position="top-right"/>
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-2xl font-semibold">Settings</h2>
        </div>

        {/* Section 1: Application Configuration (Read-Only) */}
        <Card className="border-none shadow-none flex-grow flex flex-col overflow-hidden drop-shadow-xl">
          <CardHeader>
            <CardTitle>Application Configuration</CardTitle>
            <CardDescription>
              Core application settings managed via server environment variables.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             {/* Display non-sensitive variables */}
             <div className="flex justify-between items-center border-b pb-2">
                <span className="text-sm text-muted-foreground">Public App URL</span>
                 {/* Use process.env for client components (requires NEXT_PUBLIC_ prefix) */}
                <span className="text-sm font-mono">{process.env.NEXT_PUBLIC_APP_URL || <span className="text-destructive-foreground/50 italic">Not Set</span>}</span>
             </div>
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-sm text-muted-foreground">NextAuth URL</span>
                {/* NEXTAUTH_URL is server-side only, cannot access directly here */}
                {/* We could potentially expose it via a dedicated API route if needed, */}
                {/* but generally it's less critical to display in the UI. */}
                <span className="text-sm font-mono italic text-muted-foreground/50">Server-side variable</span>
             </div>
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-sm text-muted-foreground">Database Connection</span>
                <span className="text-sm font-mono italic text-muted-foreground/50">Managed via DATABASE_URL env var</span>
             </div>
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-sm text-muted-foreground">Resend API Key</span>
                <span className="text-sm font-mono italic text-muted-foreground/50">Managed via RESEND_API_KEY env var</span>
             </div>
             {/* Add others like Jamf URL if desired */}
             {/* <div className="flex justify-between items-center border-b pb-2">
                <span className="text-sm text-muted-foreground">Jamf URL</span>
                <span className="text-sm font-mono italic text-muted-foreground/50">Managed via JAMF_URL env var</span>
             </div> */}

             {/* Reinforce security message */}
             <p className="text-sm text-muted-foreground pt-4">
               Database connection strings, secret keys (NextAuth, Resend), and passwords (Jamf) are sensitive and managed securely
               via server-side environment variables. They are not accessible or editable through this interface.
             </p>
              <p className="text-sm text-muted-foreground">
               Server timezone is determined by the deployment environment.
             </p>
          </CardContent>
        </Card>

        <Separator />

        {/* Section 2: API Key Management */}
        <Card className="border-none shadow-none flex-grow flex flex-col overflow-hidden drop-shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between">
             <div>
                <CardTitle>API Key Management</CardTitle>
                <CardDescription>
                  Generate and manage API keys for external services like Concierge.
                </CardDescription>
             </div>
             {/* --- Generate Key Dialog Trigger --- */}
             <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
                <DialogTrigger asChild>
                    <Button onClick={() => { setNewApiKey(null); setNewKeyDescription(""); }}> {/* Reset state on open */}
                        <IconPlus className="mr-2 h-4 w-4" /> Generate New Key
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                    <DialogTitle>Generate New API Key</DialogTitle>
                     {!newApiKey ? (
                        <DialogDescription>
                           Provide a description for this key to help identify it later.
                        </DialogDescription>
                     ) : (
                         <DialogDescription>
                            API Key generated successfully. Copy it now, you won't see it again!
                        </DialogDescription>
                     )}
                    </DialogHeader>
                    {newApiKey ? (
                        <div className="mt-4 space-y-2">
                            <Label>Generated API Key</Label>
                            <div className="flex items-center space-x-2">
                                <Input value={newApiKey} readOnly className="font-mono"/>
                                <Button variant="outline" size="icon" onClick={() => copyToClipboard(newApiKey)}>
                                    <IconCopy className="h-4 w-4"/>
                                </Button>
                            </div>
                            <p className="text-sm text-muted-foreground">Store this key securely.</p>
                        </div>
                    ) : (
                        <div className="grid gap-4 py-4">
                            <div className="grid items-center gap-4">
                                <Label htmlFor="key-description">Description</Label>
                                <Input
                                    id="key-description"
                                    value={newKeyDescription}
                                    onChange={(e) => setNewKeyDescription(e.target.value)}
                                    placeholder="e.g., Concierge Prod Key"
                                    disabled={isGenerating}
                                />
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        {!newApiKey && (
                             <Button onClick={handleGenerateKey} disabled={isGenerating || !newKeyDescription.trim()}>
                                {isGenerating ? <><IconLoader2 className="mr-2 h-4 w-4 animate-spin"/> Generating...</> : "Generate Key"}
                            </Button>
                        )}
                         <Button variant="outline" onClick={() => setIsGenerateDialogOpen(false)}>{newApiKey ? "Close" : "Cancel"}</Button>
                    </DialogFooter>
                </DialogContent>
             </Dialog>
             {/* ------------------------------------ */}
          </CardHeader>
          <CardContent>
             {/* --- API Key Table --- */}
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Last Used</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoadingKeys ? (
                        <TableRow><TableCell colSpan={5} className="h-24 text-center"><IconLoader2 className="animate-spin inline-block mr-2" /> Loading Keys...</TableCell></TableRow>
                    ) : errorKeys ? (
                         <TableRow><TableCell colSpan={5} className="h-24 text-center text-destructive">Error: {errorKeys}</TableCell></TableRow>
                    ) : apiKeys.length === 0 ? (
                         <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No API keys found.</TableCell></TableRow>
                     ) : (
                        apiKeys.map((key) => (
                            <TableRow key={key.id}>
                                <TableCell className="font-medium">{key.description || <span className="text-muted-foreground italic">No description</span>}</TableCell>
                                <TableCell title={new Date(key.createdAt).toLocaleString()}>{formatDistanceToNow(new Date(key.createdAt), { addSuffix: true })}</TableCell>
                                <TableCell title={key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : 'Never'}>
                                    {key.lastUsedAt ? formatDistanceToNow(new Date(key.lastUsedAt), { addSuffix: true }) : 'Never'}
                                </TableCell>
                                <TableCell><Badge variant={key.isActive ? 'default' : 'secondary'}>{key.isActive ? 'Active' : 'Revoked'}</Badge></TableCell>
                                <TableCell className="text-right">
                                    {key.isActive && (
                                        <AlertDialog open={isRevokeAlertOpen && keyToRevoke?.id === key.id} onOpenChange={(open) => {if(!open) setKeyToRevoke(null); setIsRevokeAlertOpen(open);}}>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setKeyToRevoke(key)}>
                                                    <IconTrash className="h-4 w-4" />
                                                    <span className="sr-only">Revoke Key</span>
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This action cannot be undone. Revoking this API key will immediately prevent any service using it from authenticating.
                                                        <br/> Key Description: <span className="font-medium">{keyToRevoke?.description || 'N/A'}</span>
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel disabled={isRevoking}>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={handleRevokeKey} disabled={isRevoking} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                                        {isRevoking ? <><IconLoader2 className="mr-2 h-4 w-4 animate-spin"/> Revoking...</> : 'Revoke Key'}
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))
                     )}
                 </TableBody>
             </Table>
             {/* --------------------- */}
          </CardContent>
        </Card>

        <Separator />

        {/* Section 3: Database Settings */}
        <Card className="border-none shadow-none flex-grow flex flex-col overflow-hidden drop-shadow-xl">
          <CardHeader>
            <CardTitle>Database Configuration</CardTitle>
            <CardDescription>
                Information about the connected database (read-only).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
                <span className="text-sm text-muted-foreground">Database Provider</span>
                {/* Determined from schema.prisma, not dynamically read */}
                <span className="text-sm font-medium">PostgreSQL</span>
            </div>
            <div className="flex justify-between items-center border-b pb-2">
                <span className="text-sm text-muted-foreground">Connection URL</span>
                <span className="text-sm font-mono italic text-muted-foreground/50">Managed via DATABASE_URL env var</span>
            </div>
          </CardContent>
        </Card>

        <Separator /> { /* Separator after Database */ }

        {/* Section 4: Timezone Settings */}
        <Card className="border-none shadow-none flex-grow flex flex-col overflow-hidden drop-shadow-xl">
          <CardHeader>
            <CardTitle>Timezone Configuration</CardTitle>
            <CardDescription>
                Timezone settings affecting date/time display.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="flex justify-between items-center border-b pb-2">
                <span className="text-sm text-muted-foreground">Detected Browser Timezone</span>
                <span className="text-sm font-medium">
                    {Intl.DateTimeFormat().resolvedOptions().timeZone}
                </span>
             </div>
             <div className="flex justify-between items-center border-b pb-2">
                <span className="text-sm text-muted-foreground">Server Timezone</span>
                <span className="text-sm font-mono italic text-muted-foreground/50">Determined by deployment environment</span>
             </div>
              <p className="text-xs text-muted-foreground pt-2">
                Note: Dates and times displayed throughout the application are typically formatted based on your browser's local timezone setting.
             </p>
          </CardContent>
        </Card>

        {/* New Card for Email Settings */}
        <Card className="border-none shadow-none flex-grow flex flex-col overflow-hidden drop-shadow-xl">
           <CardHeader>
               <CardTitle>Email Notifications</CardTitle>
               <CardDescription>
                   Configure email addresses and events for shipment notifications.
               </CardDescription>
           </CardHeader>
           <CardContent className="space-y-4">
                {isLoadingEmailSettings ? (
                     <div className="flex items-center justify-center py-4"><IconLoader2 className="animate-spin mr-2 h-4 w-4"/> Loading settings...</div> 
                 ) : (
                    <div className="space-y-1">
                        <Label htmlFor="admin-emails">Admin Notification Emails</Label>
                        <Input 
                            id="admin-emails" 
                            placeholder="admin@example.com, support@example.com"
                            value={adminNotifyEmails} 
                            onChange={(e) => setAdminNotifyEmails(e.target.value)}
                            disabled={isSavingEmailSettings} 
                        />
                        <p className="text-xs text-muted-foreground">
                            Comma-separated list of emails to notify for major shipment events.
                        </p>
                    </div>
                )}
              {/* ... Optional Toggles ... */}
             <div className="flex justify-end pt-4">
                 <Button 
                     onClick={handleSaveEmailSettings} 
                     // Enable button only if not loading/saving and there are changes
                     disabled={isLoadingEmailSettings || isSavingEmailSettings || !hasEmailChanges} 
                 >
                     {isSavingEmailSettings ? <><IconLoader2 className="mr-2 h-4 w-4 animate-spin"/> Saving...</> : "Save Changes"}
                </Button>
            </div>
           </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className={cn("flex h-screen w-full flex-1 flex-col overflow-hidden border border-neutral-200 bg-gray-100 md:flex-row dark:border-neutral-700 dark:bg-neutral-800")}>
      <Sidebar open={open} setOpen={setOpen}>
        <SidebarBody className="justify-between gap-10">
          <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto">
             {/* Use imported components */}
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
      <SettingsContent />
    </div>
  );
} 