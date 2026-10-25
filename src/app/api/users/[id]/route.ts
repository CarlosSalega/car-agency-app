import type { Prisma } from "@generated/prisma/client";
import { hashPassword } from "better-auth/crypto";
import { type NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
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
    });

    if (!user) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("[USUARIO] Error al obtener el usuario:", error);
    return NextResponse.json(
      { error: "Error al obtener el usuario" },
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
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
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

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      return NextResponse.json(
        { error: "El formato del email es inválido" },
        { status: 400 },
      );
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        email: data.email.trim().toLowerCase(),
        NOT: { id },
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Ya existe otro usuario con este email" },
        { status: 409 },
      );
    }

    const updateData: Prisma.UserUpdateInput = {
      name: data.name.trim(),
      email: data.email.trim().toLowerCase(),
      isActive: data.isActive !== undefined ? data.isActive : true,
      ...(data.role ? { role: data.role } : {}),
    };

    const newPassword = data.password?.trim();

    if (newPassword && newPassword.length < 8) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 8 caracteres" },
        { status: 400 },
      );
    }

    // One transaction: a password that fails to persist must not leave the
    // profile fields already updated.
    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (newPassword) {
        const password = await hashPassword(newPassword);

        // The credential row is what better-auth actually verifies against.
        // It is created on sign-up; this upsert covers a user that predates it.
        const { count } = await tx.account.updateMany({
          where: { userId: id, providerId: "credential" },
          data: { password },
        });

        if (count === 0) {
          await tx.account.create({
            data: {
              userId: id,
              accountId: id,
              providerId: "credential",
              password,
            },
          });
        }
      }

      return updated;
    });

    await prisma.log.create({
      data: {
        action: "UPDATE",
        entity: "User",
        entityId: user.id,
        userId: session.user.id,
      },
    });

    return NextResponse.json({
      success: true,
      user,
      message: "Usuario actualizado exitosamente",
    });
  } catch (error) {
    console.error("[USERS] Error al actualizar el usuario:", error);

    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return NextResponse.json(
        { error: "Ya existe otro usuario con este email" },
        { status: 409 },
      );
    }

    if (
      error instanceof Error &&
      error.message.includes("Record to update not found")
    ) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { error: "Error al actualizar el usuario" },
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

    const userToDelete = await prisma.user.findUnique({
      where: { id },
    });

    if (!userToDelete) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 },
      );
    }

    if (id === session.user.id) {
      return NextResponse.json(
        { error: "No puedes desactivar tu propio usuario" },
        { status: 400 },
      );
    }

    if (!userToDelete.isActive) {
      return NextResponse.json({
        success: true,
        message: "Usuario desactivado exitosamente",
      });
    }

    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    await prisma.log.create({
      data: {
        action: "DELETE",
        entity: "User",
        entityId: id,
        userId: session.user.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Usuario desactivado exitosamente",
    });
  } catch (error) {
    console.error("[USUARIO] Error al desactivar el usuario:", error);

    if (
      error instanceof Error &&
      error.message.includes("Record to update not found")
    ) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { error: "Error al desactivar el usuario" },
      { status: 500 },
    );
  }
}
