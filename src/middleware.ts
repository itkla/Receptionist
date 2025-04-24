import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

const keycloakIssuer = process.env.KEYCLOAK_ISSUER;
const isKeycloakConfigured = !!keycloakIssuer;
const secret = process.env.NEXTAUTH_SECRET;
const signInPage = '/auth/signin';
const setupPage = '/setup-admin';
const requestPasswordResetPage = '/auth/request-password-reset';

// console.log(`[Middleware Init] KEYCLOAK_ISSUER: "${keycloakIssuer}" (Configured: ${isKeycloakConfigured})`);
if (!secret) {
    // This is a critical configuration error. Log it prominently.
    console.error("\n\n*** CRITICAL ERROR: NEXTAUTH_SECRET environment variable is not set. Middleware authentication will fail. ***\n\n");
}

export async function middleware(req: NextRequest) {
    const pathname = req.nextUrl.pathname;
    // console.log(`[Middleware] Request Path: ${pathname}`);
    if (
        pathname.startsWith('/_next/') ||
        pathname.startsWith('/api/auth/') ||
        pathname.startsWith('/api/public/') ||
        pathname.startsWith('/uploads/') ||
        pathname === '/favicon.ico'
    ) {
        // console.log(`[Middleware] Allowing public/internal path: ${pathname}`);
        return NextResponse.next();
    }
    if (pathname.startsWith(setupPage)) {
        // console.log(`[Middleware] Allowing direct access to ${setupPage}`);
        return NextResponse.next();
    }
    if (pathname.startsWith(signInPage)) {
        // console.log(`[Middleware] Allowing direct access to ${signInPage}`);
        return NextResponse.next();
    }
    if (pathname.startsWith(requestPasswordResetPage)) {
        // console.log(`[Middleware] Allowing direct access to ${requestPasswordResetPage}`);
        return NextResponse.next();
    }
    if (!secret) {
        console.error("[Middleware Auth] Cannot check token: NEXTAUTH_SECRET is missing.");
        return new NextResponse('Internal Server Error: Auth configuration missing', { status: 500 });
    }

    // console.log('[Middleware Auth] Checking session token...');
    const token = await getToken({ req, secret });

    if (!token) {
        // console.log(`[Middleware Auth] No token found. Redirecting to ${signInPage}.`);
        const redirectUrl = new URL(signInPage, req.url);
        redirectUrl.searchParams.set("callbackUrl", req.url);
        return NextResponse.redirect(redirectUrl);
    }

    // console.log('[Middleware Auth] Token found. Allowing access.');
    return NextResponse.next(); // Proceed to the requested page
}

export const config = {
    matcher: [
        // Updated regex to exclude paths with a dot (.)
        '/((?!api/|_next/static|_next/image|favicon.ico|uploads|.*\.).*)',
        // Including '/' explicitly if the regex might miss it
        '/',
    ],
}; 