import type { Prisma } from "@generated/prisma/client";
import { hashPassword } from "better-auth/crypto";

import { type NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const search = searchParams.get("search") || "";
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = search
      ? {
          OR: [
            {
              name: {
                contains: search,
                mode: "insensitive" as Prisma.QueryMode,
              },
            },
            {
              email: {
                contains: search,
                mode: "insensitive" as Prisma.QueryMode,
              },
            },
          ],
        }
      : {};

    const [users, totalCount] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          emailVerified: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              cars: true,
              logs: true,
            },
          },
        },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return NextResponse.json({
      users,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNextPage: page * limit < totalCount,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("[USERS] Error al obtener los usuarios:", error);
    return NextResponse.json(
      { error: "Error al obtener los usuarios" },
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
        { error: "El nombre es requerido" },
        { status: 400 },
      );
    }

    if (!data.email?.trim()) {
      return NextResponse.json(
        { error: "El email es requerido" },
        { status: 400 },
      );
    }

    if (!data.password?.trim()) {
      return NextResponse.json(
        { error: "La contraseña es requerida" },
        { status: 400 },
      );
    }

    if (data.password.length < 8) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 8 caracteres" },
        { status: 400 },
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      return NextResponse.json(
        { error: "El formato del email es inválido" },
        { status: 400 },
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: data.email.trim().toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Ya existe un usuario con este email" },
        { status: 409 },
      );
    }

    const hashedPassword = await hashPassword(data.password);
    // better-auth reads credentials from `Account`, not from a column on
    // `User`. `accountId` must equal the user id, so the id is generated here
    // rather than left to the database default.
    const userId = crypto.randomUUID();

    const user = await prisma.user.create({
      data: {
        id: userId,
        name: data.name.trim(),
        email: data.email.trim().toLowerCase(),
        role: data.role || "COLLABORATOR",
        isActive: data.isActive !== undefined ? data.isActive : true,
        accounts: {
          create: {
            accountId: userId,
            providerId: "credential",
            password: hashedPassword,
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    await prisma.log.create({
      data: {
        action: "CREATE",
        entity: "User",
        entityId: user.id,
        userId: session.user.id,
      },
    });

    return NextResponse.json({
      success: true,
      user,
      message: "Usuario creado exitosamente",
    });
  } catch (error) {
    console.error("[USUARIOS] Error al crear el usuario:", error);

    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return NextResponse.json(
        { error: "Ya existe un usuario con este email" },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: "Error al crear el usuario" },
      { status: 500 },
    );
  }
}
