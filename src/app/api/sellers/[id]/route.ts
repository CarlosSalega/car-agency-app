import { type NextRequest, NextResponse } from "next/server";

import { revalidateSellers } from "@/lib/cache";
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

    const firstName = String(data.firstName ?? "").trim();
    const lastName = String(data.lastName ?? "").trim();
    const phone = String(data.phone ?? "").trim();
    const emailRaw =
      data.email === undefined || data.email === null
        ? ""
        : String(data.email).trim();
    const email = emailRaw.length ? emailRaw : null;

    if (!firstName)
      return NextResponse.json(
        { error: "El nombre es requerido" },
        { status: 400 },
      );
    if (!lastName)
      return NextResponse.json(
        { error: "El apellido es requerido" },
        { status: 400 },
      );
    if (!phone)
      return NextResponse.json(
        { error: "El teléfono es requerido" },
        { status: 400 },
      );

    const existingSeller = await prisma.seller.findUnique({ where: { id } });
    if (!existingSeller) {
      return NextResponse.json(
        { error: "Vendedor no encontrado" },
        { status: 404 },
      );
    }

    const existingPhone = await prisma.seller.findUnique({ where: { phone } });
    if (existingPhone && existingPhone.id !== id) {
      return NextResponse.json(
        { error: "Ya existe un vendedor con este teléfono" },
        { status: 409 },
      );
    }

    if (email) {
      const existingEmail = await prisma.seller.findUnique({
        where: { email },
      });
      if (existingEmail && existingEmail.id !== id) {
        return NextResponse.json(
          { error: "Ya existe un vendedor con este email" },
          { status: 409 },
        );
      }
    }

    const seller = await prisma.seller.update({
      where: { id },
      data: {
        firstName,
        lastName,
        phone,
        email,
      },
    });

    await prisma.log.create({
      data: {
        action: "UPDATE",
        entity: "Seller",
        entityId: seller.id,
        userId: session.user.id,
      },
    });

    revalidateSellers();

    return NextResponse.json({ success: true, seller });
  } catch (error) {
    console.error("[SELLERS] Error al actualizar el vendedor:", error);
    return NextResponse.json(
      { error: "Error al actualizar el vendedor" },
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

    const seller = await prisma.seller.findUnique({
      where: { id },
      include: {
        _count: { select: { cars: true } },
      },
    });

    if (!seller) {
      return NextResponse.json(
        { error: "Vendedor no encontrado" },
        { status: 404 },
      );
    }

    if (seller._count.cars > 0) {
      return NextResponse.json(
        { error: "No se puede eliminar: tiene autos asociados" },
        { status: 400 },
      );
    }

    await prisma.seller.delete({ where: { id } });

    await prisma.log.create({
      data: {
        action: "DELETE",
        entity: "Seller",
        entityId: id,
        userId: session.user.id,
      },
    });

    revalidateSellers();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[SELLERS] Error al eliminar el vendedor:", error);
    return NextResponse.json(
      { error: "Error al eliminar el vendedor" },
      { status: 500 },
    );
  }
}
