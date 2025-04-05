'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation'; // Use navigation for App Router
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner"; // Using sonner for notifications
import { Toaster as SonnerToaster } from "sonner";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null); // State for error message

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await signIn('credentials', {
        redirect: false, // Handle redirect manually
        email: email,
        password: password,
      });

      if (result?.error) {
        // Handle specific errors or show a generic message
        console.error("Sign-in error:", result.error);
        setError('Invalid email or password. Please try again.'); // Set error state
        toast.error("Login Failed", { description: 'Invalid email or password.' });
        setIsLoading(false);
      } else if (result?.ok) {
        // Sign-in successful
        toast.success("Login Successful!");
        router.push('/'); // Redirect to dashboard
        // No need to set isLoading false here as we are navigating away
      } else {
         // Handle unexpected result status
         setError('An unexpected error occurred during sign-in.');
         toast.error("Login Failed", { description: 'An unexpected error occurred.' });
         setIsLoading(false);
      }
    } catch (err) {
      console.error("Sign-in exception:", err);
      setError('An error occurred. Please try again later.');
      toast.error("Login Failed", { description: 'An error occurred.' });
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
        <SonnerToaster richColors />
        <Card className="w-full max-w-sm">
            <CardHeader>
            <CardTitle className="text-2xl">Admin Login</CardTitle>
            <CardDescription>Enter your email and password to access the admin dashboard.</CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                        id="email"
                        type="email"
                        placeholder="admin@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
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
                        />
                    </div>
                    {error && (
                        <p className="text-sm text-red-600 dark:text-red-500">{error}</p>
                    )}
                </CardContent>
                <CardFooter>
                    <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading ? 'Signing In...' : 'Sign In'}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    </main>
  );
} 