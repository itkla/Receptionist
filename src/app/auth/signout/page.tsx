'use client';

import { useState, useEffect } from 'react';
import { getCsrfToken, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/layout/logos";
import { IconLoader2, IconArrowLeft, IconLogout2, IconLogout } from '@tabler/icons-react';

export default function SignOutPage() {
  const [csrfToken, setCsrfToken] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Fetch the CSRF token when the component mounts
    const fetchToken = async () => {
      try {
        const token = await getCsrfToken();
        setCsrfToken(token);
      } catch (error) {
        console.error("Error fetching CSRF token:", error);
        // Handle error - maybe show a message to the user
      }
    };
    fetchToken();
  }, []);

  // Option 1: Handle sign out via form submission (standard NextAuth)
  const handleSignOutSubmit = () => {
    setIsLoading(true);
    // The form will handle the actual submission
  };

  const handleCancelClick = () => {
    router.back();
  };

  // Option 2: Handle sign out programmatically (alternative)
  // const handleSignOutClick = async () => {
  //   setIsLoading(true);
  //   await signOut({ redirect: true, callbackUrl: '/' }); // Redirect to home after sign out
  // };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="mb-8">
        <Logo />
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Sign Out</CardTitle>
          <CardDescription className="text-center">Are you sure you want to sign out?</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Container for buttons - Changed to horizontal layout */}
          <div className="flex items-center space-x-2">
            {/* Cancel Button (Icon) */}
             <Button 
              type="button" 
              variant="outline" 
              size="icon" // Make it icon-sized
              onClick={handleCancelClick} 
              disabled={isLoading}
              aria-label="Go back" // Add aria-label for accessibility
            >
              <IconArrowLeft className="h-4 w-4" /> 
            </Button>
            {/* Standard form POST to NextAuth signout endpoint */}
            <form method="post" action="/api/auth/signout" onSubmit={handleSignOutSubmit} className="flex-grow"> {/* Form takes remaining space */}
              <input type="hidden" name="csrfToken" value={csrfToken || ''} />
              <Button 
                type="submit" 
                className="w-full" // Button fills the form width
                disabled={!csrfToken || isLoading} 
                variant="destructive"
              >
                {isLoading ? <IconLoader2 className="animate-spin mr-2 h-4 w-4"/> : null} {/* Added icon size */}
                {isLoading ? 'Signing Out...' :  <IconLogout className="h-4 w-4" />}
              </Button>
            </form>
          </div>
          {/* Alternative: Programmatic sign out button */} 
          {/* <Button 
            onClick={handleSignOutClick} 
            className="w-full mt-2" 
            disabled={isLoading}
            variant="destructive"
          >
             {isLoading ? <IconLoader2 className="animate-spin mr-2"/> : null}
             {isLoading ? 'Signing Out...' : 'Sign Out'}
          </Button> */}
        </CardContent>
      </Card>
    </main>
  );
} 