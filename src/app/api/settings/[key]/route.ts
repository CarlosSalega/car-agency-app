import { type NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  try {
    const session = await getSession();
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { key } = await params;
    const setting = await prisma.settings.findUnique({
      where: { key },
    });

    if (!setting) {
      return NextResponse.json(
        { error: "Configuración no encontrada" },
        { status: 404 },
      );
    }

    return NextResponse.json(setting);
  } catch (error) {
    console.error(
      "[CONFIGURACIONES] Error al obtener la configuración:",
      error,
    );
    return NextResponse.json(
      { error: "Error al obtener la configuración" },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  try {
    const session = await getSession();
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { key } = await params;
    const data = await request.json();

    if (data.value === undefined || data.value === null) {
      return NextResponse.json(
        { error: "El valor es requerido" },
        { status: 400 },
      );
    }

    const setting = await prisma.settings.upsert({
      where: { key },
      update: {
        value: String(data.value),
        description: data.description?.trim() || undefined,
      },
      create: {
        key,
        value: String(data.value),
        description: data.description?.trim() || null,
      },
    });

    await prisma.log.create({
      data: {
        action: "UPDATE",
        entity: "Settings",
        entityId: setting.id,
        userId: session.user.id,
      },
    });

    return NextResponse.json({
      success: true,
      setting,
      message: "Configuración actualizada exitosamente",
    });
  } catch (error) {
    console.error(
      "[CONFIGURACIONES] Error al actualizar la configuración:",
      error,
    );
    return NextResponse.json(
      { error: "Error al actualizar la configuración" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  try {
    const session = await getSession();
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { key } = await params;

    const setting = await prisma.settings.findUnique({
      where: { key },
    });

    if (!setting) {
      return NextResponse.json(
        { error: "Configuración no encontrada" },
        { status: 404 },
      );
    }

    await prisma.settings.delete({
      where: { key },
    });

    await prisma.log.create({
      data: {
        action: "DELETE",
        entity: "Settings",
        entityId: setting.id,
        userId: session.user.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Configuración eliminada exitosamente",
    });
  } catch (error) {
    console.error(
      "[CONFIGURACIONES] Error al eliminar la configuración:",
      error,
    );
    return NextResponse.json(
      { error: "Error al eliminar la configuración" },
      { status: 500 },
    );
  }
}
