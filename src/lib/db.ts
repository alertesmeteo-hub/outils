import { PrismaClient } from '@prisma/client';

const g = globalThis as unknown as { prisma?: PrismaClient };

/** Renvoie null si DATABASE_URL n'est pas définie : le site reste pleinement fonctionnel sans base. */
export function getDb(): PrismaClient | null {
  if (!process.env.DATABASE_URL) return null;
  g.prisma ??= new PrismaClient();
  return g.prisma;
}
