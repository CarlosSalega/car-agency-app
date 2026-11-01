import { type NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { revalidateReviews } from "@/lib/cache";
import { prisma } from "@/lib/db";
import { reviewCreateSchema } from "@/lib/validations/review";

/**
 * Staff-side creation of a testimonial.
 *
 * ADMIN-only, like the lead panel: a review is a public claim about the business
 * signed with a customer's name, which is not something a collaborator publishes
 * on their own.
 *
 * The audit row is written inside the same transaction as the review. A published
 * testimonial that appears with no trace of who published it is exactly the kind
 * of thing nobody can reconstruct later.
 */

const CREATED_REVIEW_FIELDS = {
  id: true,
  authorName: true,
  rating: true,
  text: true,
  reviewedAt: true,
  photoPath: true,
  sortOrder: true,
  isPublished: true,
} as const;

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Acceso denegado. Se requiere rol de administrador" },
        { status: 403 },
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "No pudimos leer la reseña" },
        { status: 400 },
      );
    }

    const parsed = reviewCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const review = await prisma.$transaction(async (tx) => {
      const created = await tx.review.create({
        data: {
          authorName: parsed.data.authorName,
          rating: parsed.data.rating,
          text: parsed.data.text,
          reviewedAt: parsed.data.reviewedAt,
          photoPath: parsed.data.photoPath ?? null,
          sortOrder: parsed.data.sortOrder ?? 0,
          // Unpublished unless the form says otherwise: the model's default is
          // the safe one, and an explicit `true` is a deliberate act.
          isPublished: parsed.data.isPublished ?? false,
        },
        select: CREATED_REVIEW_FIELDS,
      });

      await tx.log.create({
        data: {
          action: "CREATE",
          entity: "Review",
          entityId: created.id,
          userId: session.user.id,
        },
      });

      return created;
    });

    // The landing reads through a cached query tagged `reviews`.
    revalidateReviews();

    return NextResponse.json({ success: true, review }, { status: 201 });
  } catch (error) {
    console.error("[REVIEWS] Error al crear la reseña:", error);
    return NextResponse.json(
      { error: "Error al crear la reseña" },
      { status: 500 },
    );
  }
}
