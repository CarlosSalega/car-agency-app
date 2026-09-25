import { unstable_cache } from "next/cache";

import { prisma } from "@/lib/db";
import { CACHE_REVALIDATE, CACHE_TAGS } from "@/lib/cache";
import { prismaSafe } from "@/lib/prisma-safe";

export async function getBrandsWithModels() {
  return unstable_cache(
    async () =>
      prismaSafe(() =>
        prisma.brand.findMany({
          orderBy: { name: "asc" },
          include: {
            models: {
              orderBy: { name: "asc" },
            },
          },
        }),
      ),
    [CACHE_TAGS.BRANDS, "brands-with-models"],
    { tags: [CACHE_TAGS.BRANDS], revalidate: CACHE_REVALIDATE.STATIC_DATA },
  )();
}
