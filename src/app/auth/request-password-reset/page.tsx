'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Toaster as SonnerToaster } from "sonner";
import { Logo } from "@/components/layout/logos";
import { IconLoader2 } from '@tabler/icons-react';

export default function RequestPasswordResetPage() {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [isSuccess, setIsSuccess] = useState(false);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setIsLoading(true);
        setMessage(null);
        setIsSuccess(false);

        if (!/^[^\\s@]+@[^\\s@]+\.[^\\s@]+$/.test(email)) {
            setMessage("Please enter a valid email address.");
            setIsLoading(false);
            return;
        }

        try {
            const response = await fetch('/api/auth/request-password-reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'An unexpected error occurred.');
            }

            const successMsg = "If an account with that email exists, a password reset link has been sent.";
            setMessage(successMsg);
            setIsSuccess(true);
            toast.success("Request Sent", { description: successMsg });

        } catch (err: any) {
            console.error("Password reset request failed:", err);
            setMessage(err.message || 'Failed to send password reset email. Please try again later.');
            setIsSuccess(false);
            toast.error("Request Failed", { description: err.message });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
            <SonnerToaster richColors />
            <div className="mb-8">
                <Logo />
            </div>
            <Card className="w-full max-w-sm">
                <CardHeader>
                    <CardTitle className="text-2xl font-bold text-center">Reset Password</CardTitle>
                    <CardDescription className="text-center">Enter your email address to receive a password reset link.</CardDescription>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="user@example.com"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={isLoading || isSuccess}
                            />
                        </div>
                        {message && (
                            <p className={`text-sm pt-1 ${isSuccess ? 'text-green-600 dark:text-green-500' : 'text-destructive'}`}>
                                {message}
                            </p>
                        )}
                    </CardContent>
                    <CardFooter className="flex flex-col space-y-2 pt-4">
                        <Button type="submit" className="w-full" disabled={isLoading || isSuccess}>
                            {isLoading ? <IconLoader2 className="animate-spin mr-2 h-4 w-4" /> : null}
                            {isLoading ? 'Sending...' : 'Send Reset Link'}
                        </Button>
                        <Link href="/auth/signin" className="text-sm pt-2 font-medium text-primary underline-offset-4 hover:underline">
                            Back to Sign In
                        </Link>
                    </CardFooter>
                </form>
            </Card>
        </main>
    );
}