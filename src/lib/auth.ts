import { AuthOptions, DefaultSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

// Initialize Prisma Client
const prisma = new PrismaClient();

// Define and export authOptions here
export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "user@example.com" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          console.error('Missing email or password in credentials');
          return null;
        }
        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
          });
          if (!user) {
            console.log(`No user found for email: ${credentials.email}`);
            return null;
          }
          const isValidPassword = await bcrypt.compare(credentials.password, user.password);
          if (!isValidPassword) {
            console.log(`Invalid password attempt for email: ${credentials.email}`);
            return null;
          }
          console.log(`Successful login for email: ${credentials.email}`);
          return {
             id: user.id,
             email: user.email,
             name: user.name,
           };
        } catch (error) {
          console.error('Error during authorization:', error);
          return null;
        }
      }
    })
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
          session.user.id = token.id as string;
          session.user.email = token.email as string;
          session.user.name = token.name as string;
      }
      return session;
    }
  },
  pages: {
    signIn: '/auth/signin',
    signOut: '/auth/signout',
  },
};

// Type declarations can also stay here or move to a dedicated types file
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