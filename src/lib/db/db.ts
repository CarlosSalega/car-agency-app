import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@generated/prisma/client";

import { findInsecureSslMode } from "@/lib/db/assert-secure-ssl";

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

  /**
   * The check is production-only on purpose: a local Postgres without TLS is a
   * legitimate dev setup, and a guard that blocks it teaches people to turn the
   * guard off. In production there is no such excuse — `pg` v9 would silently
   * downgrade `require` to "encrypt without verifying the certificate".
   */
  const insecureSslMode = findInsecureSslMode(connectionString);
  if (insecureSslMode && process.env.NODE_ENV === "production") {
    throw new Error(
      `Insecure DATABASE_URL: sslmode is "${insecureSslMode}". Set it to "verify-full" so the connection is encrypted AND the server certificate is verified.`,
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
