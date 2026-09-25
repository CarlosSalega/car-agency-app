import { NextResponse, type NextRequest } from "next/server";

import { revalidateBrands } from "@/lib/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
export async function GET() {
  try {
    const brands = await prisma.brand.findMany({
      orderBy: { name: "asc" },
      include: {
        models: {
          orderBy: { name: "asc" },
        },
      },
    });
    return NextResponse.json(brands);
  } catch (error) {
    console.error("[BRANDS] Error al obtener las marcas:", error);
    return NextResponse.json(
      { error: "Error al obtener las marcas" },
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
        { error: "El nombre de la marca es requerido" },
        { status: 400 },
      );
    }
    const existingBrand = await prisma.brand.findUnique({
      where: { name: data.name.trim() },
    });
    if (existingBrand) {
      return NextResponse.json(
        { error: "Ya existe una marca con este nombre" },
        { status: 409 },
      );
    }
    const brand = await prisma.brand.create({
      data: {
        name: data.name.trim(),
        createdById: session.user.id,
      },
      include: {
        models: {
          orderBy: { name: "asc" },
        },
      },
    });
    await prisma.log.create({
      data: {
        action: "CREATE",
        entity: "Brand",
        entityId: brand.id,
        userId: session.user.id,
      },
    });
    revalidateBrands();
    return NextResponse.json({
      success: true,
      brand,
      message: "Marca creada exitosamente",
    });
  } catch (error) {
    console.error("[BRANDS] Error al crear la marca:", error);
    return NextResponse.json(
      { error: "Error al crear la marca" },
      { status: 500 },
    );
  }
}
