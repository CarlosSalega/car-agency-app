import type { Prisma } from "@generated/prisma/client";

import { prisma } from "@/lib/db";

import type {
  CategoryAttribute,
  CategoryAttributeCacheStore,
} from "./categories";

/**
 * The production `CategoryAttributeCacheStore`.
 *
 * Kept apart from `categories.ts` so the rules import no database client: a test
 * of the caching decision should not need to stub Prisma, and importing
 * `@/lib/db` builds a `PrismaClient` (and demands `DATABASE_URL`) while it is
 * evaluated.
 *
 * `categoryId` is the marketplace's own id, so an upsert on it is the whole
 * invalidation policy: one row per category, replaced when the TTL expires.
 */
export function createCategoryAttributeCacheStore(): CategoryAttributeCacheStore {
  return {
    async read(categoryId: string) {
      const row = await prisma.categoryAttributeCache.findUnique({
        where: { categoryId },
        select: { attributes: true, fetchedAt: true },
      });

      if (row === null) return null;

      // Handed over unvalidated: the column is `Json`, so `categories.ts` is the
      // one that decides whether the payload is still readable.
      return { attributes: row.attributes, fetchedAt: row.fetchedAt };
    },

    async write({
      categoryId,
      attributes,
      fetchedAt,
    }: {
      readonly categoryId: string;
      readonly attributes: readonly CategoryAttribute[];
      readonly fetchedAt: Date;
    }) {
      // Prisma's JSON input wants mutable arrays; the list itself is already a
      // plain serialisable structure.
      const data = {
        attributes: attributes as unknown as Prisma.InputJsonValue,
        fetchedAt,
      };

      await prisma.categoryAttributeCache.upsert({
        where: { categoryId },
        create: { categoryId, ...data },
        update: data,
      });
    },
  };
}
