import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const data = await request.json();

    const existing = await prisma.linkTreeLink.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Enlace no encontrado" },
        { status: 404 },
      );
    }

    const categoryRaw =
      data.category === undefined || data.category === null
        ? undefined
        : String(data.category).trim();

    if (
      categoryRaw !== undefined &&
      categoryRaw !== "CONTACT" &&
      categoryRaw !== "SOCIAL"
    ) {
      return NextResponse.json(
        { error: "Categoría inválida" },
        { status: 400 },
      );
    }

    const label =
      data.label === undefined || data.label === null
        ? undefined
        : String(data.label).trim();
    const href =
      data.href === undefined || data.href === null
        ? undefined
        : String(data.href).trim();

    const iconKey =
      data.iconKey === undefined
        ? undefined
        : data.iconKey === null
          ? null
          : String(data.iconKey).trim() || null;

    const sortOrder =
      data.sortOrder === undefined || data.sortOrder === null
        ? undefined
        : Number(data.sortOrder);

    const isActive =
      data.isActive === undefined || data.isActive === null
        ? undefined
        : Boolean(data.isActive);

    if (label !== undefined && !label) {
      return NextResponse.json(
        { error: "El título es requerido" },
        { status: 400 },
      );
    }

    if (href !== undefined && !href) {
      return NextResponse.json(
        { error: "El enlace es requerido" },
        { status: 400 },
      );
    }

    const link = await prisma.linkTreeLink.update({
      where: { id },
      data: {
        category: categoryRaw,
        label,
        href,
        iconKey,
        sortOrder,
        isActive,
      },
    });

    await prisma.log.create({
      data: {
        action: "UPDATE",
        entity: "LinkTreeLink",
        entityId: link.id,
        userId: session.user.id,
      },
    });

    return NextResponse.json({
      success: true,
      link,
      message: "Enlace actualizado exitosamente",
    });
  } catch (error) {
    console.error("[LINKTREE] Error al actualizar el enlace:", error);
    return NextResponse.json(
      { error: "Error al actualizar el enlace" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;

    const existing = await prisma.linkTreeLink.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Enlace no encontrado" },
        { status: 404 },
      );
    }

    await prisma.linkTreeLink.delete({ where: { id } });

    await prisma.log.create({
      data: {
        action: "DELETE",
        entity: "LinkTreeLink",
        entityId: existing.id,
        userId: session.user.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Enlace eliminado exitosamente",
    });
  } catch (error) {
    console.error("[LINKTREE] Error al eliminar el enlace:", error);
    return NextResponse.json(
      { error: "Error al eliminar el enlace" },
      { status: 500 },
    );
  }
}
