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
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { ModeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/layout/logos";
import { Toaster as SonnerToaster } from "sonner";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddUserDialog } from '@/components/dialogs/AddUserDialog';
import { format } from 'date-fns';

// Keep UserData type definition
export interface UserData {
    id: string;
    name: string | null;
    email: string | null;
    createdAt: Date;
    // Add other relevant user fields if necessary
}

export default function UserManagementPage() {
    // Client-side state
    const [users, setUsers] = useState<UserData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
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
        } finally {
            setIsLoading(false);
        }
    }, []); // Empty dependency array for useCallback as it doesn't depend on props/state

    // Call fetchUsers on mount
    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]); // Add fetchUsers as a dependency

    // Handler for when a user is added via the dialog
    const handleUserAdded = useCallback(() => {
        setIsAddDialogOpen(false); // Close the dialog
        fetchUsers(); // Directly call the memoized fetch function
    }, [fetchUsers]); // Depend on fetchUsers

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
            href: "/api/auth/signout",
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
                    <CardContent className="flex-grow overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Created At</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {isLoading ? (
                            <TableRow>
                              <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                                Loading users...
                              </TableCell>
                            </TableRow>
                          ) : users.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                                No users found.
                              </TableCell>
                            </TableRow>
                          ) : (
                            users.map((user) => (
                              <TableRow key={user.id}>
                                <TableCell className="font-medium flex items-center">
                                   <IconUserCircle className="mr-2 h-5 w-5 text-muted-foreground" /> 
                                   {user.name || <span className="italic text-muted-foreground">N/A</span>}
                                </TableCell>
                                <TableCell>{user.email}</TableCell>
                                <TableCell>{format(new Date(user.createdAt), 'PPpp')}</TableCell>
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
                    onUserAdded={handleUserAdded}
                 />
            </main>
        </div>
    );
}

// Note: Removed server-side data fetching (getUsers).
// Added client-side state and useEffect for fetching users.
// Requires an API endpoint like '/api/admin/users' to exist.
// Integrated Button, Card, Table, and Dialog logic directly.
// UserManagementClient and AddUserButton components are no longer needed.

