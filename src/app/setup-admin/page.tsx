'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { IconLoader2 } from '@tabler/icons-react';
import { createAdminUser } from './actions';
import { Toaster as SonnerToaster } from 'sonner';

export default function SetupAdminPage() {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            toast.error('Passwords do not match.');
            return;
        }

        if (!name || !email || !password) {
            setError('All fields are required.');
            toast.error('All fields are required.');
            return;
        }

        startTransition(async () => {
            try {
                const result = await createAdminUser({ name, email, password });

                if (result.success) {
                    toast.success('Administrator account created successfully!');
                    router.push('/auth/signin');
                } else {
                    setError(result.error || 'An unknown error occurred.');
                    toast.error('Setup Failed', { description: result.error || 'Could not create admin user.' });
                }
            } catch (err) {
                console.error("Admin setup failed:", err);
                const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred during setup.';
                setError(errorMessage);
                toast.error('Setup Failed', { description: errorMessage });
            }
        });
    };

    return (
        <>
            <SonnerToaster richColors position="top-right" />
            <div className="flex min-h-screen items-center justify-center bg-background p-4">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle className="text-2xl font-bold">Setup Administrator Account</CardTitle>
                        <CardDescription>
                            Create the first administrator account to manage the application.
                        </CardDescription>
                    </CardHeader>
                    <form onSubmit={handleSubmit}>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Full Name</Label>
                                <Input
                                    id="name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Admin User"
                                    required
                                    disabled={isPending}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="admin@example.com"
                                    required
                                    disabled={isPending}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    minLength={8}
                                    disabled={isPending}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirm-password">Confirm Password</Label>
                                <Input
                                    id="confirm-password"
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    disabled={isPending}
                                />
                            </div>
                            {error && <p className="text-sm text-destructive">{error}</p>}
                        </CardContent>
                        <CardFooter>
                            <Button type="submit" className="w-full" disabled={isPending}>
                                {isPending ? <IconLoader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                {isPending ? 'Creating Account...' : 'Create Admin Account'}
                            </Button>
                        </CardFooter>
                    </form>
                </Card>
            </div>
        </>
    );
} 