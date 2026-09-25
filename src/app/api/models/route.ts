import { NextResponse, type NextRequest } from "next/server";

import { revalidateBrands, revalidateModels } from "@/lib/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get("brandId");

    const models = await prisma.model.findMany({
      where: brandId ? { brandId } : undefined,
      orderBy: { name: "asc" },
      include: { brand: true },
    });

    return NextResponse.json(models);
  } catch (error) {
    console.error("[MODELS] Error al obtener los modelos:", error);
    return NextResponse.json(
      { error: "Error al obtener los modelos" },
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

    if (existingModel) {
      return NextResponse.json(
        { error: "Ya existe un modelo con este nombre para esta marca" },
        { status: 409 },
      );
    }

    const model = await prisma.model.create({
      data: {
        name: data.name.trim(),
        brandId: data.brandId,
        createdById: session.user.id,
      },
      include: { brand: true },
    });

    await prisma.log.create({
      data: {
        action: "CREATE",
        entity: "Model",
        entityId: model.id,
        userId: session.user.id,
      },
    });

    revalidateModels();
    revalidateBrands();

    return NextResponse.json({ success: true, model });
  } catch (error) {
    console.error("[MODELS] Error al crear el modelo:", error);
    return NextResponse.json(
      { error: "Error al crear el modelo" },
      { status: 500 },
    );
  }
}
