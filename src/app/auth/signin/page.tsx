import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import SignInForm from './SignInForm'; // Import the client component
import React, { Suspense } from 'react'; // Import Suspense

// This is now a Server Component by default
export default async function SignInPage() {
  
  // --- Server-side Setup Check ---
  const keycloakIssuer = process.env.KEYCLOAK_ISSUER;
  const isKeycloakConfigured = !!keycloakIssuer;

  // console.log(`[SignIn Page] Checking setup. Keycloak Configured: ${isKeycloakConfigured}`);

  if (!isKeycloakConfigured) {
    try {
      const userCount = await prisma.user.count();
      // console.log(`[SignIn Page] User count = ${userCount}`);
      if (userCount === 0) {
        // console.log("[SignIn Page] No users found, redirecting to /setup-admin");
        redirect('/setup-admin'); // Use next/navigation redirect
      }
    } catch (error) {
      // console.error("[SignIn Page] Error checking user count:", error);
      // Handle error - maybe show an error message instead of the form,
      // or redirect to setup anyway if DB access fails during setup phase?
      // For now, let it fall through to show the sign-in form, 
      // but log the error prominently.
      console.error("CRITICAL: Database check failed on sign-in page. Setup might be required but couldn't be verified.");
      // Optionally: Render an error component instead of SignInForm
      // return <SomeErrorComponent message="Database connection failed" />;
    }
  }
  // --- End Server-side Setup Check ---

  // If setup is complete or Keycloak is used, render the client component form
  // console.log("[SignIn Page] Setup check passed or Keycloak configured. Rendering sign-in form.");
  return (
      // Wrap the client component that uses useSearchParams in Suspense
      <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading...</div>}> 
        <SignInForm />
      </Suspense>
  );
} 