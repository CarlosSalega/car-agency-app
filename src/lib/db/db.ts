import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@generated/prisma/client";

/**
 * Prisma 7 no lee la URL del datasource desde el schema. La conexión llega
 * por un driver adapter, y el schema ya no declara `url`.
 *
 * El schema sigue siendo la fuente de verdad para el CLI, que la lee desde
 * `prisma.config.ts`.
 */
function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. The Prisma 7 client requires it to build the pg driver adapter.",
    );
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
