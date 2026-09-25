import { type NextRequest, NextResponse } from "next/server";

import { revalidateBrands } from "@/lib/cache";
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

    if (!data.name?.trim()) {
      return NextResponse.json(
        { error: "El nombre de la marca es requerido" },
        { status: 400 },
      );
    }

    const existingBrand = await prisma.brand.findUnique({
      where: { name: data.name.trim() },
    });

    if (existingBrand && existingBrand.id !== id) {
      return NextResponse.json(
        { error: "Ya existe una marca con este nombre" },
        { status: 409 },
      );
    }

    const brand = await prisma.brand.update({
      where: { id },
      data: {
        name: data.name.trim(),
      },
      include: {
        models: {
          orderBy: { name: "asc" },
        },
      },
    });

    await prisma.log.create({
      data: {
        action: "UPDATE",
        entity: "Brand",
        entityId: brand.id,
        userId: session.user.id,
      },
    });

    revalidateBrands();

    return NextResponse.json({
      success: true,
      brand,
      message: "Marca actualizada exitosamente",
    });
  } catch (error) {
    console.error("[BRANDS] Error al actualizar la marca:", error);
    return NextResponse.json(
      { error: "Error al actualizar la marca" },
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

    const brand = await prisma.brand.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            cars: true,
            models: true,
          },
        },
      },
    });

    if (!brand) {
      return NextResponse.json(
        { error: "Marca no encontrada" },
        { status: 404 },
      );
    }

    if (brand._count.cars > 0 || brand._count.models > 0) {
      return NextResponse.json(
        {
          error:
            "No se puede eliminar la marca porque tiene autos o modelos asociados",
        },
        { status: 400 },
      );
    }

    await prisma.brand.delete({
      where: { id },
    });

    await prisma.log.create({
      data: {
        action: "DELETE",
        entity: "Brand",
        entityId: id,
        userId: session.user.id,
      },
    });

    revalidateBrands();

    return NextResponse.json({
      success: true,
      message: "Marca eliminada exitosamente",
    });
  } catch (error) {
    console.error("[BRANDS] Error al eliminar la marca:", error);
    return NextResponse.json(
      { error: "Error al eliminar la marca" },
      { status: 500 },
    );
  }
}
