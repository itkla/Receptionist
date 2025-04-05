import { PrismaClient, Prisma } from '@prisma/client';

declare global {
  // allow global `var` declarations
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const prisma =
  global.prisma ||
  new PrismaClient({
    log: ['query'], // Log queries in development
  });

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

export { prisma, Prisma }; 