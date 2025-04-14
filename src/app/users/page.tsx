'use client'; // Make this a client component

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from 'next/navigation';
import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar";
import {
    IconArrowLeft,
    IconSettings,
    IconPackage,
    IconLocation,
    IconUser,
    IconPlus,
    IconUserCircle,
    IconEdit,
    IconTrash,
    IconDotsVertical,
    IconLoader2
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { ModeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/layout/logos";
import { Toaster as SonnerToaster } from "sonner";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AddUserDialog } from '@/components/dialogs/AddUserDialog';
import { EditUserDialog } from '@/components/dialogs/EditUserDialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { format } from 'date-fns';
import { toast } from "sonner";

// Keep UserData type definition
export interface UserData {
    id: string;
    name: string | null;
    email: string | null;
    createdAt: Date;
    notificationsEnabled?: boolean; // Keep optional field if used in EditDialog fetch
}

export default function UserManagementPage() {
    // Client-side state
    const [users, setUsers] = useState<UserData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false); // State for delete dialog
    const [userToDelete, setUserToDelete] = useState<UserData | null>(null); // State for user to delete
    const [isDeleting, setIsDeleting] = useState(false); // State for delete operation
    const router = useRouter();

    // Define fetchUsers outside useEffect, wrapped in useCallback
    const fetchUsers = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/admin/users');
            if (!response.ok) {
                throw new Error('Failed to fetch users');
            }
            const data: UserData[] = await response.json();
            setUsers(data);
        } catch (error) {
            console.error("Failed to fetch users:", error);
            toast.error("Failed to load users", { description: (error as Error).message });
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Call fetchUsers on mount
    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    // Handler for when a user is added or updated
    const handleUserChange = useCallback(() => {
        setIsAddDialogOpen(false);
        setIsEditDialogOpen(false);
        setSelectedUser(null);
        fetchUsers();
    }, [fetchUsers]);

    // Handler for opening edit dialog
    const handleEditClick = (user: UserData) => {
        setSelectedUser(user);
        setIsEditDialogOpen(true);
    };

    // Handler for opening delete confirmation
    const handleDeleteClick = (user: UserData) => {
        setUserToDelete(user);
        setIsDeleteDialogOpen(true);
    };

    // Handler for confirming deletion
    const handleDeleteConfirm = async () => {
        if (!userToDelete) return;

        setIsDeleting(true);
        const toastId = `delete-user-${userToDelete.id}`;
        toast.loading("Deleting user...", { id: toastId });

        try {
            const response = await fetch(`/api/admin/users/${userToDelete.id}`, {
                method: 'DELETE',
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || `Failed to delete user (HTTP ${response.status})`);
            }

            toast.success("User deleted successfully!", { id: toastId });
            setIsDeleteDialogOpen(false); // Close confirmation dialog
            setUserToDelete(null); // Clear user to delete
            fetchUsers(); // Refresh list

        } catch (err: any) {
            console.error("Error deleting user:", err);
            toast.error("Delete Failed", { description: err.message, id: toastId });
        } finally {
            setIsDeleting(false);
        }
    };

    const links = [
        {
            label: "Shipments",
            href: "/",
            icon: <IconPackage className="h-5 w-5 shrink-0" />,
        },
        {
            label: "Destinations",
            href: "/locations",
            icon: <IconLocation className="h-5 w-5 shrink-0" />,
        },
        {
          label: "Settings",
          href: "/settings",
          icon: <IconSettings className="h-5 w-5 shrink-0" />,
        },
        {
            label: "Users",
            href: "/users",
            icon: <IconUser className="h-5 w-5 shrink-0" />,
        },
        {
            label: "Logout",
            href: "/auth/signout",
            icon: <IconArrowLeft className="h-5 w-5 shrink-0" />,
        },
    ];

    return (
        <div
            className={cn(
                "flex h-screen w-full flex-1 flex-col overflow-hidden border border-neutral-200 bg-gray-100 md:flex-row dark:border-neutral-700 dark:bg-neutral-800",
            )}
        >
            <Sidebar>
                <SidebarBody className="justify-between gap-10">
                    <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto">
                        <Logo />
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

            {/* Main Content Area */}
            <main className="flex flex-1 flex-col p-4 md:p-8 overflow-auto">
                 <SonnerToaster richColors position="top-right" />
                 {/* Header */}
                 <div className="flex items-center justify-between mb-4 flex-shrink-0">
                     <h1 className="text-2xl font-semibold">Users</h1>
                     <Button onClick={() => setIsAddDialogOpen(true)} size="sm">
                       <IconPlus className="mr-2 h-4 w-4" /> Add User
                     </Button>
                 </div>

                 <Card className="border-none shadow-none flex-grow flex flex-col overflow-hidden drop-shadow-xl">
                    <CardContent className="flex-grow overflow-auto p-0">
                      <Table>
                        <TableHeader className="sticky top-0 bg-background z-10">
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Created At</TableHead>
                            <TableHead className="text-right w-[80px]">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {isLoading ? (
                            <TableRow>
                              <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                Loading users...
                              </TableCell>
                            </TableRow>
                          ) : users.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                No users found.
                              </TableCell>
                            </TableRow>
                          ) : (
                            users.map((user) => (
                              <TableRow key={user.id} >
                                <TableCell className="font-medium flex items-center">
                                   <IconUserCircle className="mr-2 h-5 w-5 text-muted-foreground" />
                                   {user.name || <span className="italic text-muted-foreground">N/A</span>}
                                </TableCell>
                                <TableCell>{user.email}</TableCell>
                                <TableCell>{format(new Date(user.createdAt), 'PPpp')}</TableCell>
                                <TableCell className="text-right">
                                     {/* Actions Dropdown */}
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                <IconDotsVertical className="h-4 w-4" />
                                                <span className="sr-only">Open actions</span>
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => handleEditClick(user)}>
                                                <IconEdit className="mr-2 h-4 w-4" /> Edit
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem 
                                                onClick={() => handleDeleteClick(user)} 
                                                className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                                disabled={isDeleting} // Optionally disable while deleting
                                            >
                                                <IconTrash className="mr-2 h-4 w-4" /> Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                 </Card>

                 <AddUserDialog
                    open={isAddDialogOpen}
                    onOpenChange={setIsAddDialogOpen}
                    onUserAdded={handleUserChange}
                 />
                 {selectedUser && (
                     <EditUserDialog
                         open={isEditDialogOpen}
                         onOpenChange={setIsEditDialogOpen}
                         user={selectedUser}
                         onUserUpdated={handleUserChange}
                     />
                 )}
                 {/* Delete Confirmation Dialog */}
                 <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the user 
                            <span className="font-semibold"> {userToDelete?.name || userToDelete?.email}</span>.
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={handleDeleteConfirm} 
                            disabled={isDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isDeleting ? <IconLoader2 className="animate-spin mr-2 h-4 w-4" /> : null}
                            Yes, delete user
                        </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </main>
        </div>
    );
}

// Notes:
// - Added delete confirmation dialog and state.
// - Replaced direct edit button with a Dropdown Menu for actions.
// - Added handleDeleteConfirm function to call the DELETE API.

