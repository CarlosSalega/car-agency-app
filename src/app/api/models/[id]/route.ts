import { type NextRequest, NextResponse } from "next/server";

import { revalidateBrands, revalidateModels } from "@/lib/cache";
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
        { error: "El nombre del modelo es requerido" },
        { status: 400 },
      );
    }

    if (!data.brandId?.trim()) {
      return NextResponse.json(
        { error: "La marca es requerida" },
        { status: 400 },
      );
    }

    const brand = await prisma.brand.findUnique({
      where: { id: data.brandId },
    });

    if (!brand) {
      return NextResponse.json(
        { error: "La marca no existe" },
        { status: 404 },
      );
    }

    const existingModel = await prisma.model.findUnique({
      where: {
        name_brandId: {
          name: data.name.trim(),
          brandId: data.brandId,
        },
      },
    });

    if (existingModel && existingModel.id !== id) {
      return NextResponse.json(
        { error: "Ya existe un modelo con este nombre para esta marca" },
        { status: 409 },
      );
    }

    const model = await prisma.model.update({
      where: { id },
      data: {
        name: data.name.trim(),
        brandId: data.brandId,
      },
      include: { brand: true },
    });

    await prisma.log.create({
      data: {
        action: "UPDATE",
        entity: "Model",
        entityId: model.id,
        userId: session.user.id,
      },
    });

    revalidateModels();
    revalidateBrands();

    return NextResponse.json({ success: true, model });
  } catch (error) {
    console.error("[MODELS] Error al actualizar el modelo:", error);
    return NextResponse.json(
      { error: "Error al actualizar el modelo" },
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

    const model = await prisma.model.findUnique({
      where: { id },
      include: {
        _count: {
          select: { cars: true },
        },
      },
    });

    if (!model) {
      return NextResponse.json(
        { error: "Modelo no encontrado" },
        { status: 404 },
      );
    }

    if (model._count.cars > 0) {
      return NextResponse.json(
        {
          error: "No se puede eliminar el modelo porque tiene autos asociados",
        },
        { status: 400 },
      );
    }

    await prisma.model.delete({
      where: { id },
    });

    await prisma.log.create({
      data: {
        action: "DELETE",
        entity: "Model",
        entityId: id,
        userId: session.user.id,
      },
    });

    revalidateModels();
    revalidateBrands();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[MODELS] Error al eliminar el modelo:", error);
    return NextResponse.json(
      { error: "Error al eliminar el modelo" },
      { status: 500 },
    );
  }
}
