import { type NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { revalidateReviews } from "@/lib/cache";
import { prisma } from "@/lib/db";
import { reviewUpdateSchema } from "@/lib/validations/review";

/**
 * Staff-side edit and removal of a testimonial.
 *
 * Publishing is an update: `isPublished` is a field of the row, and a separate
 * "publish" endpoint would be a second way to write the same column. Unpublishing
 * revalidates like everything else, because a review hidden in the panel that
 * stays visible on the landing is the failure worth guarding here.
 */

const UPDATED_REVIEW_FIELDS = {
  id: true,
  authorName: true,
  rating: true,
  text: true,
  reviewedAt: true,
  photoPath: true,
  sortOrder: true,
  isPublished: true,
  updatedAt: true,
} as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

    const { id } = await params;

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "No pudimos leer la reseña" },
        { status: 400 },
      );
    }

    const parsed = reviewUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 },
      );
    }

    // The schema already dropped absent keys, so this writes only what the panel
    // actually sent. `photoPath: null` is how a photo gets cleared.
    const review = await prisma.$transaction(async (tx) => {
      const existing = await tx.review.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!existing) return null;

      const updated = await tx.review.update({
        where: { id },
        data: parsed.data,
        select: UPDATED_REVIEW_FIELDS,
      });

      await tx.log.create({
        data: {
          action: "UPDATE",
          entity: "Review",
          entityId: updated.id,
          userId: session.user.id,
        },
      });

      return updated;
    });

    if (!review) {
      return NextResponse.json(
        { error: "Reseña no encontrada" },
        { status: 404 },
      );
    }

    revalidateReviews();

    return NextResponse.json({ success: true, review });
  } catch (error) {
    console.error("[REVIEWS] Error al actualizar la reseña:", error);
    return NextResponse.json(
      { error: "Error al actualizar la reseña" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

    const { id } = await params;

    // The existence check sits inside the transaction and *before* the delete, so
    // a missing id answers 404 instead of a 200 that claims a deletion nobody
    // made. The `Log` row would be the only evidence, and it would be false.
    const deleted = await prisma.$transaction(async (tx) => {
      const existing = await tx.review.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!existing) return false;

      await tx.review.delete({ where: { id } });

      await tx.log.create({
        data: {
          action: "DELETE",
          entity: "Review",
          entityId: id,
          userId: session.user.id,
        },
      });

      return true;
    });

    if (!deleted) {
      return NextResponse.json(
        { error: "Reseña no encontrada" },
        { status: 404 },
      );
    }

    revalidateReviews();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[REVIEWS] Error al eliminar la reseña:", error);
    return NextResponse.json(
      { error: "Error al eliminar la reseña" },
      { status: 500 },
    );
  }
}
