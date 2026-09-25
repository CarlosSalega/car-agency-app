import { NextResponse, type NextRequest } from "next/server";

import { revalidateSellers } from "@/lib/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    const sellers = await prisma.seller.findMany({
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });

    return NextResponse.json(sellers);
  } catch (error) {
    console.error("[SELLERS] Error al obtener los vendedores:", error);
    return NextResponse.json(
      { error: "Error al obtener los vendedores" },
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

    const existingPhone = await prisma.seller.findUnique({ where: { phone } });
    if (existingPhone) {
      return NextResponse.json(
        { error: "Ya existe un vendedor con este teléfono" },
        { status: 409 },
      );
    }

    if (email) {
      const existingEmail = await prisma.seller.findUnique({
        where: { email },
      });
      if (existingEmail) {
        return NextResponse.json(
          { error: "Ya existe un vendedor con este email" },
          { status: 409 },
        );
      }
    }

    const seller = await prisma.seller.create({
      data: {
        firstName,
        lastName,
        phone,
        email,
        createdById: session.user.id,
      },
    });

    await prisma.log.create({
      data: {
        action: "CREATE",
        entity: "Seller",
        entityId: seller.id,
        userId: session.user.id,
      },
    });

    revalidateSellers();

    return NextResponse.json({ success: true, seller });
  } catch (error) {
    console.error("[SELLERS] Error al crear el vendedor:", error);
    return NextResponse.json(
      { error: "Error al crear el vendedor" },
      { status: 500 },
    );
  }
}
