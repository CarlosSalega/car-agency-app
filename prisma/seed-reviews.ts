import "dotenv/config";

import { prisma } from "@/lib/db";

import { seedReviews } from "./seed/reviews";

/**
 * Inserts the real testimonials into an existing database, without touching
 * anything else.
 *
 * `pnpm db:seed` is the bootstrap: it empties thirteen tables and needs
 * Cloudinary. This one exists because there is a legitimate middle case — a
 * development database that already holds real inventory and real inquiries, and
 * only needs the reviews that the landing now reads from Postgres.
 *
 * It is **idempotent by author**: a review whose author is already a row is
 * skipped, so running it twice does not duplicate the section, and a reviewer's
 * later edits are not overwritten by the seed's text.
 */
async function main(): Promise<void> {
  let inserted = 0;
  let skipped = 0;

  for (const review of seedReviews) {
    const existing = await prisma.review.findFirst({
      where: { authorName: review.authorName },
      select: { id: true },
    });

    if (existing) {
      skipped += 1;
      continue;
    }

    await prisma.review.create({ data: review });
    inserted += 1;
  }

  console.log(
    `Reseñas: ${inserted} insertadas, ${skipped} ya existían (${seedReviews.length} en el seed).`,
  );
}

main()
  .catch((error) => {
    console.error("Error al sembrar las reseñas:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
