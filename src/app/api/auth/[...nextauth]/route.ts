import NextAuth from "next-auth";
// Remove PrismaClient and bcrypt imports as they are in lib/auth.ts now
// Remove AuthOptions import

// Import authOptions from the new location
import { authOptions } from "@/lib/auth";

// Remove the authOptions definition from here
/*
export const authOptions: AuthOptions = {
  // ... entire definition was here ...
};
*/

const handler = NextAuth(authOptions); // Use the imported authOptions

export { handler as GET, handler as POST };

// Remove the type declarations from here as they are in lib/auth.ts
/*
declare module "next-auth" {
  // ... type declarations were here ...
}

declare module "next-auth/jwt" {
  // ... type declarations were here ...
}
*/ 