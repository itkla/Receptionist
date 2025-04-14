'use client';

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { IconLoader2 } from '@tabler/icons-react';
import { toast } from "sonner";
import { UserData } from '@/app/users/page'; // Import the UserData interface

// Extend UserData locally if needed for fields not fetched by default
interface EditableUserData extends UserData {
    notificationsEnabled?: boolean; // Add optional field
}

interface EditUserDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    user: EditableUserData; // Use extended type
    onUserUpdated?: () => void;
}

export const EditUserDialog: React.FC<EditUserDialogProps> = ({
    open,
    onOpenChange,
    user,
    onUserUpdated
}) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState(''); // State for password
    const [notificationsEnabled, setNotificationsEnabled] = useState(true); // State for notifications
    const [isLoading, setIsLoading] = useState(false);
    const [internalUser, setInternalUser] = useState<EditableUserData | null>(null);

    // Fetch full user details when dialog opens, including preferences
    useEffect(() => {
        if (open && user?.id) {
            const fetchUserDetails = async () => {
                setIsLoading(true); // Show loading state while fetching
                try {
                    const response = await fetch(`/api/admin/users/${user.id}`);
                    if (!response.ok) {
                        throw new Error('Failed to fetch user details');
                    }
                    const data: EditableUserData = await response.json();
                    setInternalUser(data);
                    setName(data.name || '');
                    setEmail(data.email || '');
                    // Set default to true if undefined/null from DB
                    setNotificationsEnabled(data.notificationsEnabled ?? true);
                    setPassword(''); // Always clear password field on open
                } catch (err: any) {
                    toast.error("Failed to load user data", { description: err.message });
                    onOpenChange(false); // Close dialog on fetch error
                } finally {
                    setIsLoading(false);
                }
            };
            fetchUserDetails();
        } else {
             // Clear state if dialog closes or user is invalid
            setInternalUser(null);
            setName('');
            setEmail('');
            setPassword('');
            setNotificationsEnabled(true);
        }
    }, [user?.id, open, onOpenChange]); // Depend on userId and open state

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!internalUser) return; // Should not happen if open

        setIsLoading(true);
        const toastId = `update-user-${internalUser.id}`;
        toast.loading("Updating user...", { id: toastId });

        try {
            const payload: { name: string; email: string; notificationsEnabled: boolean; password?: string } = {
                name: name.trim(),
                email: email.trim(),
                notificationsEnabled: notificationsEnabled,
            };

            // Only include password in payload if it's not empty
            const trimmedPassword = password.trim();
            if (trimmedPassword) {
                // Basic validation (consider adding more complexity checks)
                if (trimmedPassword.length < 8) {
                     toast.error("Password Too Short", { description: "Password must be at least 8 characters long.", id: toastId });
                     setIsLoading(false);
                     return;
                }
                payload.password = trimmedPassword;
            }

            const response = await fetch(`/api/admin/users/${internalUser.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || `Failed to update user (HTTP ${response.status})`);
            }

            toast.success("User updated successfully!", { id: toastId });
            if (onUserUpdated) {
                onUserUpdated();
            }
        } catch (err: any) {
            console.error("Error updating user:", err);
            toast.error("Update Failed", { description: err.message, id: toastId });
        } finally {
            setIsLoading(false);
        }
    };

    // Handle Checkbox state change
    const handleCheckedChange = (checked: boolean | string) => {
        // Checkbox component returns boolean or string "indeterminate"
        setNotificationsEnabled(Boolean(checked));
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Edit User</DialogTitle>
                        <DialogDescription>
                            Update user details. Click save when finished.
                        </DialogDescription>
                    </DialogHeader>

                    {isLoading && !internalUser ? (
                        <div className="flex justify-center items-center py-10">
                            <IconLoader2 className="animate-spin h-8 w-8" />
                        </div>
                    ) : (
                         <div className="grid gap-4 py-4">
                            {/* Name Input */}
                            <div className="space-y-1">
                                <Label htmlFor="edit-name">Name</Label>
                                <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} disabled={isLoading} required />
                            </div>
                             {/* Email Input */}
                            <div className="space-y-1">
                                <Label htmlFor="edit-email">Email</Label>
                                <Input id="edit-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isLoading} required />
                            </div>
                            {/* Password Input */}
                            <div className="space-y-1">
                                <Label htmlFor="edit-password">Password</Label>
                                <Input id="edit-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Leave blank to keep unchanged" disabled={isLoading} />
                            </div>
                             {/* Notification Preferences Checkbox */}
                             <div className="space-y-2 pt-2">
                                <Label>Preferences</Label>
                                <div className="flex items-center space-x-2">
                                    <Checkbox 
                                        id="edit-notifications"
                                        checked={notificationsEnabled}
                                        onCheckedChange={handleCheckedChange}
                                        disabled={isLoading} 
                                    />
                                    <Label htmlFor="edit-notifications" className="text-sm font-normal cursor-pointer">
                                        Receive shipment notifications
                                    </Label>
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isLoading || (!internalUser && isLoading)}> { /* Also disable save if initial load ongoing */}
                            {isLoading ? <IconLoader2 className="animate-spin mr-2" /> : null}
                            Save changes
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}; 