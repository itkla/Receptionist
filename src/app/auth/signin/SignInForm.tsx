'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation'; // Use navigation for App Router
import Link from 'next/link'; // Import Link
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner"; // Using sonner for notifications
import { Toaster as SonnerToaster } from "sonner";
import { Logo } from "@/components/layout/logos"; // Import Logo

// No server-side imports or logic here anymore

export default function SignInForm() { // Renamed component
  const router = useRouter();
  const searchParams = useSearchParams();
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
        // ... error handling ...
        setError('Invalid email or password. Please try again.'); 
        toast.error("Login Failed", { description: 'Invalid email or password.' });
        setIsLoading(false);
      } else if (result?.ok) {
        // ... success handling ...
        toast.success("Login Successful!");
        // Get callbackUrl from searchParams
        const callbackUrl = searchParams.get('callbackUrl');
        // Use replace with the callbackUrl or fallback to '/'
        router.replace(callbackUrl || '/'); 
      } else {
         // ... unexpected result ...
         setError('An unexpected error occurred during sign-in.');
         toast.error("Login Failed", { description: 'An unexpected error occurred.' });
         setIsLoading(false);
      }
    } catch (err) {
       // ... exception handling ...
      setError('An error occurred. Please try again later.');
      toast.error("Login Failed", { description: 'An error occurred.' });
      setIsLoading(false);
    }
  };

  // Return only the JSX for the form and its wrapper
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <SonnerToaster richColors />
        <div className="mb-8">
            <Logo />
        </div>
        <Card className="w-full max-w-sm border-none shadow-none drop-shadow-xl">
            <CardHeader>
                <CardTitle className="text-2xl font-bold text-center">Sign In</CardTitle>
                <CardDescription className="text-center">Enter your credentials to access the dashboard.</CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
                <CardContent className="space-y-4">
                    {/* Email Input */}
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input 
                            id="email"
                            type="email"
                            placeholder="user@example.com"
                            required 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={isLoading}
                        />
                    </div>
                    {/* Password Input */}
                    <div className="space-y-2">
                        {/* Container for label and link */}
                        <div className="flex justify-between items-center">
                            <Label htmlFor="password">Password</Label>
                            <Link href="/auth/request-password-reset" className="text-sm font-medium text-muted-foreground underline-offset-4 hover:underline hover:text-primary">
                                Forgot Password?
                            </Link>
                        </div>
                        <Input 
                            id="password"
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={isLoading}
                        />
                    </div>
                    {/* Error Message Display */}
                    {error && (
                        <p className="text-sm text-destructive pt-1">{error}</p>
                    )}
                </CardContent>
                <CardFooter className="pt-4">
                    {/* Submit Button */}
                    <Button type="submit" className="w-full cursor-pointer" disabled={isLoading}>
                        {isLoading ? 'Signing In...' : 'Sign In'}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    </main>
  );
} 