import { type NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { leadStatusUpdateSchema } from "@/lib/validations/lead";

/**
 * Staff-side lead update: the status transition and the internal note.
 *
 * The audit row is written inside the same transaction as the status. S5 says
 * every status change is in `Log`, and a change committed without its row would
 * be an invisible edit. Only ADMIN reaches this route: a lead carries a
 * visitor's personal data, which is why the panel section is admin-only too.
 */

const UPDATED_LEAD_FIELDS = {
  id: true,
  status: true,
  notes: true,
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
        { error: "No pudimos leer la consulta" },
        { status: 400 },
      );
    }

    const parsed = leadStatusUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 },
      );
    }

    // The schema trims the note and turns an empty string into `undefined`, so
    // an emptied textarea clears the column instead of storing whitespace.
    const lead = await prisma.$transaction(async (tx) => {
      const existing = await tx.lead.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!existing) return null;

      const updated = await tx.lead.update({
        where: { id },
        data: {
          status: parsed.data.status,
          notes: parsed.data.notes ?? null,
        },
        select: UPDATED_LEAD_FIELDS,
      });

      await tx.log.create({
        data: {
          action: "UPDATE",
          entity: "Lead",
          entityId: updated.id,
          userId: session.user.id,
        },
      });

      return updated;
    });

    if (!lead) {
      return NextResponse.json(
        { error: "Consulta no encontrada" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, lead });
  } catch (error) {
    console.error("[LEADS] Error al actualizar la consulta:", error);
    return NextResponse.json(
      { error: "Error al actualizar la consulta" },
      { status: 500 },
    );
  }
}
