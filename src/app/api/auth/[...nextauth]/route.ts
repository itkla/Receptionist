import NextAuth, { AuthOptions, DefaultSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

// Initialize Prisma Client
const prisma = new PrismaClient();

export const authOptions: AuthOptions = {
  providers: [
    // Removed KeycloakProvider as it's not configured
    // KeycloakProvider({
    //   clientId: process.env.KEYCLOAK_CLIENT_ID as string,
    //   clientSecret: process.env.KEYCLOAK_CLIENT_SECRET as string,
    //   issuer: process.env.KEYCLOAK_ISSUER as string,
    // }),

    CredentialsProvider({
      // The name to display on the sign in form (e.g. "Sign in with...")
      name: "Credentials",
      // `credentials` is used to generate a form on the sign-in page.
      // You can specify which fields should be submitted.
      credentials: {
        email: { label: "Email", type: "email", placeholder: "user@example.com" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          console.error('Missing email or password in credentials');
          return null; // Indicate failure due to missing credentials
        }

        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
          });

          if (!user) {
            console.log(`No user found for email: ${credentials.email}`);
            return null; // User not found
          }

          // Validate password
          const isValidPassword = await bcrypt.compare(credentials.password, user.password);

          if (!isValidPassword) {
            console.log(`Invalid password attempt for email: ${credentials.email}`);
            return null; // Passwords don't match
          }

          console.log(`Successful login for email: ${credentials.email}`);
          // Return user object (without the password) if everything is okay
          // Important: Ensure you don't return the hashed password to the client
          return {
             id: user.id,
             email: user.email,
             name: user.name,
             // Add any other user properties needed in the session/token
           };

        } catch (error) {
          console.error('Error during authorization:', error);
          return null; // Return null on any unexpected error
        }
      }
    })
  ],
  secret: process.env.NEXTAUTH_SECRET,

  // Use JWT strategy for sessions
  session: {
    strategy: "jwt",
  },

  // Optional: Add callbacks for customizing JWT and session
  callbacks: {
    async jwt({ token, user }) {
      // Persist user id and email to the token after signin
      if (user) {
        token.id = user.id;
        token.email = user.email; // Ensure email is in the token
        token.name = user.name; // Ensure name is in the token
      }
      return token;
    },
    async session({ session, token }) {
      // Send properties to the client, like id, name, and email
      if (token && session.user) {
          session.user.id = token.id as string; // Add id to session
          session.user.email = token.email as string; // Ensure email is in session user
          session.user.name = token.name as string; // Ensure name is in session user
      }
      return session;
    }
  },

  // Define the sign-in page URL
  pages: {
    signIn: '/auth/signin', // You'll need to create this page
    // signOut: '/auth/signout',
    // error: '/auth/error', // Optional error page
    // verifyRequest: '/auth/verify-request', // Optional page for email verification
    // newUser: '/auth/new-user' // Optional page for new users
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

// Extend the Session and User types for NextAuth to include the 'id'
// This is important for type safety when accessing session.user.id
declare module "next-auth" {
  interface Session {
    user?: {
      id?: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    id?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
  }
} 