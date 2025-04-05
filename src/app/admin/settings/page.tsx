'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import { Copy, KeyRound, Trash2, Ban } from 'lucide-react';

interface ApiKeyRecord {
  id: string;
  description: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  isActive: boolean;
}

// Type for the response when creating a key (includes the plain text key)
interface NewApiKeyResponse extends ApiKeyRecord {
    apiKey: string;
}

export default function AdminSettingsPage() {
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newKeyDescription, setNewKeyDescription] = useState('');
  const [generatedKeyInfo, setGeneratedKeyInfo] = useState<NewApiKeyResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const fetchApiKeys = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/apikeys');
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch API keys');
      }
      setApiKeys(data);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchApiKeys();
  }, []);

  const handleGenerateKey = async () => {
    if (!newKeyDescription.trim()) {
        toast({ variant: "destructive", title: "Input Error", description: "Please provide a description for the API key." });
        return;
    }
    setIsGenerating(true);
    setGeneratedKeyInfo(null); // Clear previous generated key info
    try {
      const response = await fetch('/api/admin/apikeys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: newKeyDescription }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate API key');
      }
      setGeneratedKeyInfo(data); // Store generated key info (incl. plain text key)
      setNewKeyDescription(''); // Clear input field
      fetchApiKeys(); // Refresh the list
      // Keep the dialog open to show the generated key
    } catch (error: any) {
       toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
        setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text).then(() => {
          toast({ title: "Copied!", description: "API Key copied to clipboard." });
      }, (err) => {
          toast({ variant: "destructive", title: "Copy Failed", description: "Could not copy key." });
          console.error('Could not copy text: ', err);
      });
  };

  const handleDeleteKey = async (keyId: string) => {
    try {
      const response = await fetch(`/api/admin/apikeys/${keyId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete API key');
      }
      toast({ title: "Success", description: "API Key deleted successfully." });
      fetchApiKeys(); // Refresh the list
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error Deleting Key", description: error.message });
    }
  };

  const handleToggleActive = async (keyId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/admin/apikeys/${keyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update key status');
      }
      toast({ title: "Success", description: `API Key ${data.isActive ? 'activated' : 'deactivated'}.` });
      fetchApiKeys(); // Refresh the list
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error Updating Status", description: error.message });
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-6">Admin Settings - API Keys</h1>

      {/* Generate New Key Section */}
      <Dialog onOpenChange={(open) => !open && setGeneratedKeyInfo(null)}> {/* Reset generated key info when dialog closes */}
        <DialogTrigger asChild>
          <Button className="mb-6">
            <KeyRound className="mr-2 h-4 w-4" /> Generate New API Key
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Generate New API Key</DialogTitle>
            <DialogDescription>
              Create a new API key for external services like Concierge.
              The key will only be shown once, immediately after generation.
            </DialogDescription>
          </DialogHeader>
          {!generatedKeyInfo ? (
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="key-description" className="text-right">
                    Description
                </Label>
                <Input
                    id="key-description"
                    value={newKeyDescription}
                    onChange={(e) => setNewKeyDescription(e.target.value)}
                    className="col-span-3"
                    placeholder="e.g., Concierge Service"
                />
                </div>
            </div>
          ) : (
            <div className="py-4 space-y-4">
                <p className="text-sm text-muted-foreground">New key generated for: <strong>{generatedKeyInfo.description}</strong></p>
                <p className="text-sm font-semibold">Make sure to copy your new API key now. You won't be able to see it again!</p>
                 <div className="flex items-center space-x-2 p-3 bg-muted rounded-md font-mono text-sm break-all">
                    <span className="flex-1">{generatedKeyInfo.apiKey}</span>
                    <Button variant="ghost" size="icon" onClick={() => copyToClipboard(generatedKeyInfo.apiKey)}>
                        <Copy className="h-4 w-4" />
                    </Button>
                </div>
            </div>
          )}
          <DialogFooter>
            {!generatedKeyInfo ? (
                <Button type="button" onClick={handleGenerateKey} disabled={isGenerating || !newKeyDescription.trim()}>
                {isGenerating ? 'Generating...' : 'Generate Key'}
                </Button>
            ) : (
                 <DialogClose asChild>
                    <Button type="button">Close</Button>
                 </DialogClose>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Existing Keys Table */}
      <h2 className="text-2xl font-semibold mb-4 border-t pt-6">Existing API Keys</h2>
      {isLoading ? (
        <p>Loading keys...</p>
      ) : (
        <Table>
          <TableCaption>List of configured API keys.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead>Last Used</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {apiKeys.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={5} className="text-center">No API keys found.</TableCell>
                </TableRow>
            ) : (
                apiKeys.map((key) => (
                <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.description || '-'}</TableCell>
                    <TableCell>{new Date(key.createdAt).toLocaleString()}</TableCell>
                    <TableCell>{key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : 'Never'}</TableCell>
                    <TableCell>
                        <Switch
                            checked={key.isActive}
                            onCheckedChange={() => handleToggleActive(key.id, key.isActive)}
                            aria-label="Toggle key active status"
                        />
                    </TableCell>
                    <TableCell className="text-right">
                         <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-red-600 hover:text-red-800">
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete the API key
                                    associated with "{key.description || key.id}".
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteKey(key.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                    Delete Key
                                </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </TableCell>
                </TableRow>
                ))
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
} 