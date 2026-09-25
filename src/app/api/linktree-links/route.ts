import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    const links = await prisma.linkTreeLink.findMany({
      orderBy: [
        { category: "asc" },
        { sortOrder: "asc" },
        { createdAt: "asc" },
      ],
    });

    return NextResponse.json(links);
  } catch (error) {
    console.error("[LINKTREE] Error al obtener los enlaces:", error);
    return NextResponse.json(
      { error: "Error al obtener los enlaces" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const data = await request.json();

    const category = String(data.category ?? "").trim();
    if (category !== "CONTACT" && category !== "SOCIAL") {
      return NextResponse.json(
        { error: "Categoría inválida" },
        { status: 400 },
      );
    }

    const label = String(data.label ?? "").trim();
    const href = String(data.href ?? "").trim();
    const iconKeyRaw =
      data.iconKey === undefined || data.iconKey === null
        ? ""
        : String(data.iconKey).trim();
    const iconKey = iconKeyRaw.length ? iconKeyRaw : null;

    const sortOrder = Number.isFinite(Number(data.sortOrder))
      ? Number(data.sortOrder)
      : 0;
    const isActive =
      data.isActive === undefined || data.isActive === null
        ? true
        : Boolean(data.isActive);

    if (!label) {
      return NextResponse.json(
        { error: "El título es requerido" },
        { status: 400 },
      );
    }

    if (!href) {
      return NextResponse.json(
        { error: "El enlace es requerido" },
        { status: 400 },
      );
    }

    const link = await prisma.linkTreeLink.create({
      data: {
        category,
        label,
        href,
        iconKey,
        sortOrder,
        isActive,
      },
    });

    await prisma.log.create({
      data: {
        action: "CREATE",
        entity: "LinkTreeLink",
        entityId: link.id,
        userId: session.user.id,
      },
    });

    return NextResponse.json({
      success: true,
      link,
      message: "Enlace creado exitosamente",
    });
  } catch (error) {
    console.error("[LINKTREE] Error al crear el enlace:", error);
    return NextResponse.json(
      { error: "Error al crear el enlace" },
      { status: 500 },
    );
  }
}
