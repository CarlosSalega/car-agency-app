import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    const settings = await prisma.settings.findMany({
      orderBy: { key: "asc" },
    });
    return NextResponse.json(settings);
  } catch (error) {
    console.error(
      "[CONFIGURACIONES] Error al obtener las configuraciones:",
      error,
    );
    return NextResponse.json(
      { error: "Error al obtener las configuraciones" },
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
    if (!data.key?.trim()) {
      return NextResponse.json(
        { error: "La clave es requerida" },
        { status: 400 },
      );
    }
    if (data.value === undefined || data.value === null) {
      return NextResponse.json(
        { error: "El valor es requerido" },
        { status: 400 },
      );
    }
    const existingSetting = await prisma.settings.findUnique({
      where: { key: data.key.trim() },
    });
    if (existingSetting) {
      return NextResponse.json(
        { error: "Ya existe una configuración con esta clave" },
        { status: 409 },
      );
    }
    const setting = await prisma.settings.create({
      data: {
        key: data.key.trim(),
        value: String(data.value),
        description: data.description?.trim() || null,
      },
    });
    await prisma.log.create({
      data: {
        action: "CREATE",
        entity: "Settings",
        entityId: setting.id,
        userId: session.user.id,
      },
    });
    return NextResponse.json({
      success: true,
      setting,
      message: "Configuración creada exitosamente",
    });
  } catch (error) {
    console.error("[CONFIGURACIONES] Error al crear la configuración:", error);
    return NextResponse.json(
      { error: "Error al crear la configuración" },
      { status: 500 },
    );
  }
}
