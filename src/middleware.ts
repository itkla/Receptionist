import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
// Remove prisma import if no longer needed here
// import { prisma } from '@/lib/prisma';

// Explicitly use the Node.js runtime for this middleware
// export const runtime = 'nodejs';

// --- Configuration ---
const keycloakIssuer = process.env.KEYCLOAK_ISSUER;
const isKeycloakConfigured = !!keycloakIssuer;
const secret = process.env.NEXTAUTH_SECRET; // Secret needed for getToken
const signInPage = '/auth/signin';
const setupPage = '/setup-admin';
const requestPasswordResetPage = '/auth/request-password-reset';

console.log(`[Middleware Init] KEYCLOAK_ISSUER: "${keycloakIssuer}" (Configured: ${isKeycloakConfigured})`);
if (!secret) {
  // This is a critical configuration error. Log it prominently.
  console.error("\n\n*** CRITICAL ERROR: NEXTAUTH_SECRET environment variable is not set. Middleware authentication will fail. ***\n\n");
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  console.log(`[Middleware] Request Path: ${pathname}`);

  // Allow access to public assets and specific routes needed before auth
  // The matcher handles most of this, but explicit checks can prevent loops.
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/auth/') || // NextAuth API routes
    pathname.startsWith('/api/public/') || // Your public API routes
    pathname.startsWith('/uploads/') || // Public uploads
    pathname === '/favicon.ico'
  ) {
    console.log(`[Middleware] Allowing public/internal path: ${pathname}`);
    return NextResponse.next();
  }

  // 1. Allow navigating to the setup page itself
  if (pathname.startsWith(setupPage)) {
    console.log(`[Middleware] Allowing direct access to ${setupPage}`);
    return NextResponse.next();
  }

  // 2. Allow navigating to the sign-in page itself
  // Important to prevent redirect loops if already going there.
  if (pathname.startsWith(signInPage)) {
    console.log(`[Middleware] Allowing direct access to ${signInPage}`);
    return NextResponse.next();
  }

  // 3. Allow navigating to the request password reset page itself
  if (pathname.startsWith(requestPasswordResetPage)) {
    console.log(`[Middleware] Allowing direct access to ${requestPasswordResetPage}`);
    return NextResponse.next();
  }

  // --- REMOVED DATABASE SETUP CHECK FROM HERE --- 
  // The check will now happen on the sign-in page itself.
  // If Keycloak *is* configured, we proceed directly to auth check.
  // If Keycloak is *not* configured, we still proceed to auth check,
  // which will redirect to /auth/signin if needed, where the final DB check occurs.
  console.log(`[Middleware] Passing through path ${pathname} for further checks (setup/auth). Keycloak Configured: ${isKeycloakConfigured}`);

  // 4. Authentication Check (runs for paths not explicitly allowed above)
  if (!secret) {
    // Stop further processing if secret is missing, as getToken will fail.
    console.error("[Middleware Auth] Cannot check token: NEXTAUTH_SECRET is missing.");
    // Return a server error response or redirect to a specific error page.
    return new NextResponse('Internal Server Error: Auth configuration missing', { status: 500 });
  }

  console.log('[Middleware Auth] Checking session token...');
  const token = await getToken({ req, secret });

  if (!token) {
    // No token - User not authenticated. Redirect to sign-in.
    console.log(`[Middleware Auth] No token found. Redirecting to ${signInPage}.`);
    const redirectUrl = new URL(signInPage, req.url);
    // Preserve the original requested URL as a callback query parameter
    redirectUrl.searchParams.set("callbackUrl", req.url);
    return NextResponse.redirect(redirectUrl);
  }

  // 5. User has a valid token (authenticated)
  console.log('[Middleware Auth] Token found. Allowing access.');
  return NextResponse.next(); // Proceed to the requested page
}

// --- Matcher Configuration ---
// This matcher should cover all routes you want protected by authentication
// OR routes that should trigger the initial setup check.
// It explicitly excludes public files, API routes, and the auth routes themselves.
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (NextAuth.js authentication routes)
     * - api/public (Your explicitly public API routes)
     * - api/client (New client API routes using API key auth)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - uploads (public uploads directory)
     * It's important that this matcher DOES NOT exclude '/setup-admin' or '/auth/signin'
     * because the middleware function itself needs to run on those paths
     * to allow access via NextResponse.next().
     */
    '/((?!api/auth|api/public|api/client|_next/static|_next/image|favicon.ico|uploads).*)',
     // Including '/' explicitly if the regex might miss it (sometimes happens)
     '/',
  ],
}; 