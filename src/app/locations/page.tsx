'use client';

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar";
import {
  IconArrowLeft,
  IconPackage,
  IconSettings,
  IconLocation,
  IconLoader2,
  IconAlertCircle,
  IconChevronRight,
  // Add other necessary icons
} from "@tabler/icons-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { ModeToggle } from "@/components/theme-toggle";
import { Logo, LogoIcon } from "@/components/layout/logos";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Toaster as SonnerToaster } from "sonner";
import { Table, TableBody, TableCaption, TableHead, TableHeader, TableRow, TableCell } from "@/components/ui/table";
import { format } from "date-fns";

// --- Interfaces ---
interface DestinationListItem {
  id: string;
  shortId: string;
  name: string;
  _count?: { shipments: number };
  shipments?: { createdAt: string }[];
}
// ------------------

export default function DestinationsListPage() {
  const [open, setOpen] = useState(false);
  const [destinations, setDestinations] = useState<DestinationListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sidebar links
  const links = [
    { label: "Shipments", href: "/", icon: <IconPackage className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" /> },
    { label: "Destinations", href: "/locations", icon: <IconLocation className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" /> }, // Current page
    { label: "Settings", href: "/settings", icon: <IconSettings className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" /> },
    { label: "Logout", href: "/api/auth/signout", icon: <IconArrowLeft className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" /> },
  ];

  // Fetch destinations
  useEffect(() => {
    const fetchDestinations = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/admin/locations');
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Failed to fetch destinations (HTTP ${response.status})`);
        }
        const data = await response.json(); // Get raw data
        console.log("Raw data received from /api/admin/locations:", data); // <-- Log raw data
        // Ensure data is an array before setting state
        if (Array.isArray(data)) {
             setDestinations(data as DestinationListItem[]);
        } else {
            console.error("API did not return an array:", data);
            setDestinations([]); // Set empty array if data is not array
            throw new Error("Invalid data format received from API.");
        }
       
      } catch (err: any) {
        console.error("Error fetching destinations:", err);
        setError(err.message || "An unexpected error occurred while fetching destinations.");
        toast.error("Error Fetching Destinations", { description: err.message });
      } finally {
        setIsLoading(false);
      } 
    };
    fetchDestinations();
  }, []);

  const DestinationsContent = () => (
    <div className="flex flex-col flex-grow space-y-6 p-4 md:p-8 pt-6 overflow-hidden">
      <SonnerToaster richColors position="top-right"/>
      <div className="flex items-center justify-between space-y-2 flex-shrink-0">
        <h2 className="text-2xl font-semibold">Manage Destinations</h2>
      </div>

      <Card className="border-none shadow-none flex flex-col flex-grow overflow-hidden drop-shadow-xl">
        <CardHeader className="flex-shrink-0">
          <CardTitle>Destinations</CardTitle>
          <CardDescription>
            A list of configured shipment destinations.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 flex-grow overflow-y-auto">
          <Table>
            <TableCaption>Configured destinations.</TableCaption>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="w-[100px]">ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Shipments</TableHead>
                <TableHead>Latest Shipment</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow> <TableCell colSpan={5} className="h-24 text-center"> <IconLoader2 className="animate-spin inline-block mr-2" /> Loading... </TableCell> </TableRow>
              ) : error ? (
                <TableRow> <TableCell colSpan={5} className="h-24 text-center text-destructive"> Error: {error} </TableCell> </TableRow>
              ) : destinations.length === 0 ? (
                <TableRow> <TableCell colSpan={5} className="h-24 text-center">No destinations found.</TableCell> </TableRow>
              ) : (
                destinations.map((dest) => {
                  // Get the latest shipment date safely
                  const latestShipmentDate = dest.shipments && dest.shipments.length > 0 ? dest.shipments[0].createdAt : null;
                  return (
                    <TableRow key={dest.id}>
                      <TableCell className="font-mono text-xs">{dest.shortId || dest.id.substring(0, 8)}</TableCell>
                      <TableCell className="font-medium">{dest.name}</TableCell>
                      <TableCell>{dest._count?.shipments ?? 0}</TableCell>
                      <TableCell>
                        {latestShipmentDate ? (
                          format(new Date(latestShipmentDate), 'Pp')
                        ) : (
                          <span className="italic text-muted-foreground/70">N/A</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/locations/${dest.id}`}>View</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className={cn("flex h-screen w-full flex-1 flex-col md:flex-row overflow-hidden border border-neutral-200 bg-gray-100 dark:border-neutral-700 dark:bg-neutral-800")}>
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
      <div className="flex flex-1 flex-col overflow-hidden">
        <DestinationsContent />
      </div>
    </div>
  );
} 