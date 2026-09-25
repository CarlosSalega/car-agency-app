import { NextRequest, NextResponse } from "next/server";

import { generateSlugBase, generateUniqueSlug } from "@/lib/cars/slug";
import { revalidateCar, revalidateCars } from "@/lib/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { carSchema } from "@/lib/validations/car";
import type { CreateCarPayload } from "@/types/car-form";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();

    const parsed = carSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const data: CreateCarPayload = parsed.data;

    const brand = await prisma.brand.findUnique({
      where: { id: data.brandId },
    });
    const model = await prisma.model.findUnique({
      where: { id: data.modelId },
    });

    if (!brand || !model) {
      return NextResponse.json(
        { error: "Marca o modelo no encontrados" },
        { status: 400 },
      );
    }

    if (data.sellerId) {
      const seller = await prisma.seller.findUnique({
        where: { id: data.sellerId },
      });

      if (!seller || !seller.isActive) {
        return NextResponse.json(
          { error: "Vendedor no encontrado" },
          { status: 400 },
        );
      }
    }

    const slug = await generateUniqueSlug(
      generateSlugBase(
        brand.name,
        model.name,
        data.version ?? "",
        Number(data.year),
        Number(data.kilometers),
      ),
    );

    const car = await prisma.car.create({
      data: {
        title: data.title,
        slug,
        brandId: data.brandId,
        modelId: data.modelId,
        sellerId: data.sellerId ?? null,
        version: data.version,
        color: data.color,
        year: Number(data.year),
        kilometers: Number(data.kilometers),
        type: data.type,
        fuelType: data.fuelType,
        transmission: data.transmission,
        price: Number(data.price),
        currency: data.currency,
        description: data.description,
        status: data.status,
        paymentMethods: Array.isArray(data.paymentMethods)
          ? data.paymentMethods
          : [],
        images: Array.isArray(data.images) ? data.images : [],
        userId: session.user.id,
      },
    });

    await prisma.log.create({
      data: {
        action: "CREATE",
        entity: "Car",
        entityId: car.id,
        userId: session.user.id,
      },
    });

    revalidateCars();
    revalidateCar(car.id);

    return NextResponse.json({ success: true, car });
  } catch (error) {
    console.error("Error creating car:", error);

    if (error instanceof Error) {
      if (error.message.includes("unique constraint")) {
        return NextResponse.json(
          {
            error:
              "Ese slug o patente ya existe. Intenta con valores diferentes.",
          },
          { status: 400 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { error: "Error al crear el auto" },
      { status: 500 },
    );
  }
}
