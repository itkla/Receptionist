'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Toaster as SonnerToaster } from "sonner";
import { Logo } from "@/components/layout/logos";
import { IconLoader2 } from '@tabler/icons-react';

export default function ResetPasswordPage() {
    const router = useRouter();
    const params = useParams();
    const token = params.token as string;

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [isSuccess, setIsSuccess] = useState(false);
    const [isValidToken, setIsValidToken] = useState<boolean | null>(null);

    useEffect(() => {
        if (!token || typeof token !== 'string' || token.length !== 64) {
            setMessage("Invalid or missing password reset token.");
            setIsValidToken(false);
        } else {
            setIsValidToken(true);
        }
    }, [token]);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!isValidToken) return;

        if (password !== confirmPassword) {
            setMessage("Passwords do not match.");
            return;
        }
        if (password.length < 8) {
            setMessage("Password must be at least 8 characters long.");
            return;
        }

        setIsLoading(true);
        setMessage(null);
        setIsSuccess(false);

        try {
            const response = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'An unexpected error occurred.');
            }

            setMessage(result.message || "Your password has been successfully reset.");
            setIsSuccess(true);
            toast.success("Password Reset Successful!", { description: "You can now sign in with your new password." });
            // setTimeout(() => router.push('/auth/signin'), 3000);

        } catch (err: any) {
            console.error("Password reset failed:", err);
            setMessage(err.message || 'Failed to reset password. The link may be invalid or expired.');
            setIsSuccess(false);
            toast.error("Password Reset Failed", { description: err.message });
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
                    <CardTitle className="text-2xl font-bold text-center">Set New Password</CardTitle>
                </CardHeader>
                {isValidToken === false ? (
                    <CardContent>
                        <p className="text-center text-destructive">{message || "This password reset link is invalid or expired."}</p>
                        <Link href="/auth/request-password-reset" className="block text-center mt-4 text-sm font-medium text-primary underline-offset-4 hover:underline">
                            Request a new link
                        </Link>
                    </CardContent>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <CardContent className="space-y-4">
                            <CardDescription className="text-center pb-2">Enter your new password below.</CardDescription>
                            {/* New Password Input */}
                            <div className="space-y-2">
                                <Label htmlFor="password">New Password</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={isLoading || isSuccess}
                                />
                            </div>
                            {/* Confirm Password Input */}
                            <div className="space-y-2">
                                <Label htmlFor="confirm-password">Confirm New Password</Label>
                                <Input
                                    id="confirm-password"
                                    type="password"
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    disabled={isLoading || isSuccess}
                                />
                            </div>
                            {/* Message Display */}
                            {message && (
                                <p className={`text-sm pt-1 ${isSuccess ? 'text-green-600 dark:text-green-500' : 'text-destructive'}`}>
                                    {message}
                                </p>
                            )}
                        </CardContent>
                        <CardFooter className="flex flex-col space-y-2">
                            <Button type="submit" className="w-full" disabled={isLoading || isSuccess}>
                                {isLoading ? <IconLoader2 className="animate-spin mr-2 h-4 w-4" /> : null}
                                {isLoading ? 'Resetting...' : 'Set New Password'}
                            </Button>
                            {isSuccess && (
                                <Link href="/auth/signin" className="text-sm pt-2 font-medium text-primary underline-offset-4 hover:underline">
                                    Proceed to Sign In
                                </Link>
                            )}
                        </CardFooter>
                    </form>
                )}
            </Card>
        </main>
    );
} 