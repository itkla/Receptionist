import { withAuth } from "next-auth/middleware";

// Using the default export with withAuth integrates
// NextAuth session checking into the middleware flow.
export default withAuth(
  // `withAuth` redirects to the sign-in page if the user is not authenticated.
  {
    callbacks: {
      // Optional: Add custom authorization logic here if needed beyond just being logged in.
      // authorized: ({ token }) => token?.role === "admin",
    },
    pages: {
        // Match the sign-in page defined in authOptions
        signIn: '/auth/signin',
        // error: '/auth/error', // Optional error page
    }
  }
);

// Matcher specifies which routes the middleware (and thus authentication)
// should apply to. Excludes API routes meant for other purposes and auth routes.
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/public (use this for public API routes)
     * - api/auth (NextAuth routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - auth/signin (the sign-in page itself)
     * - uploads (allow access to uploaded files in public dir)
     */
    '/((?!api/public|api/auth|_next/static|_next/image|favicon.ico|auth/signin|uploads).)*',
    // Add specific routes if the above regex is too broad or complex
    // '/', // Protect the root dashboard
    // '/admin/:path*', // Protect all routes under /admin
  ],
}; 