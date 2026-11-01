import { NextRequest, NextResponse } from "next/server";

import { revalidateCar, revalidateCars } from "@/lib/cache";
import { prisma } from "@/lib/db";
import { ImageService } from "@/lib/images/image-service";
import { CAR_FORBIDDEN_MESSAGE, canManageCar, getSession } from "@/lib/auth";
import { carSchema } from "@/lib/validations/car";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;

    const car = await prisma.car.findUnique({
      where: { id, deletedAt: null },
      include: {
        brand: true,
        model: true,
        seller: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!car) {
      return NextResponse.json(
        { error: "Auto no encontrado" },
        { status: 404 },
      );
    }

    return NextResponse.json(car);
  } catch {
    return NextResponse.json(
      { error: "Error al obtener el auto" },
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
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;

    const car = await prisma.car.findUnique({ where: { id } });

    if (!car) {
      return NextResponse.json(
        { error: "Vehículo no encontrado" },
        { status: 404 },
      );
    }

    if (car.deletedAt) {
      return NextResponse.json({ success: true });
    }

    if (!canManageCar(car, session.user)) {
      return NextResponse.json(
        { error: "No tienes permiso para eliminar este vehículo" },
        { status: 403 },
      );
    }

    if (car.images.length > 0) {
      await Promise.all(car.images.map((key) => ImageService.delete(key)));
    }

    await prisma.car.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        images: [],
      },
    });

    await prisma.log.create({
      data: {
        action: "DELETE",
        entity: "Car",
        entityId: id,
        userId: session.user.id,
      },
    });

    revalidateCars();
    revalidateCar(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Error al eliminar el auto" },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const parsed = carSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const data = parsed.data;
    const hasSellerId = Object.prototype.hasOwnProperty.call(body, "sellerId");

    const existingCar = await prisma.car.findUnique({ where: { id } });

    if (!existingCar) {
      return NextResponse.json(
        { error: "Vehículo no encontrado" },
        { status: 404 },
      );
    }

    if (!canManageCar(existingCar, session.user)) {
      return NextResponse.json(
        { error: CAR_FORBIDDEN_MESSAGE },
        { status: 403 },
      );
    }

    const [brand, model] = await Promise.all([
      prisma.brand.findUnique({ where: { id: data.brandId } }),
      prisma.model.findUnique({ where: { id: data.modelId } }),
    ]);

    if (!brand || !model) {
      return NextResponse.json(
        { error: "Marca o modelo no encontrados" },
        { status: 400 },
      );
    }

    if (typeof data.sellerId === "string" && data.sellerId) {
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

    const newImages: string[] = Array.isArray(data.images) ? data.images : [];

    const removedImages = existingCar.images.filter(
      (img) => !newImages.includes(img),
    );

    if (removedImages.length > 0) {
      await Promise.all(removedImages.map((key) => ImageService.delete(key)));
    }

    const car = await prisma.car.update({
      where: { id },
      data: {
        title: data.title,
        brandId: data.brandId,
        modelId: data.modelId,
        ...(hasSellerId ? { sellerId: data.sellerId ?? null } : {}),
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
        images: newImages,
      },
    });

    await prisma.log.create({
      data: {
        action: "UPDATE",
        entity: "Car",
        entityId: car.id,
        userId: session.user.id,
      },
    });

    revalidateCars();
    revalidateCar(id);

    return NextResponse.json({ success: true, car });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Error al actualizar el auto" },
      { status: 500 },
    );
  }
}
