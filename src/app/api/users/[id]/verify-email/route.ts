import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { isEmailConfigured } from "@/lib/email/send";

/**
 * Sends a verification email to one user.
 *
 * Admin-only, and deliberately not a public endpoint: better-auth's
 * `/send-verification-email` accepts an arbitrary `email` in its body, so
 * exposing it directly would let anyone mail-bomb any address. Here the address
 * comes from the database row the admin selected, never from the request.
 */
export async function POST(
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
      select: { id: true, email: true, emailVerified: true, isActive: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 },
      );
    }

    if (user.emailVerified) {
      return NextResponse.json(
        { error: "El email ya está verificado" },
        { status: 409 },
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: "No se puede verificar el email de un usuario desactivado" },
        { status: 400 },
      );
    }

    // Absolute on purpose: better-auth validates `callbackURL` against the
    // trusted origin, and a relative path cannot be resolved for that check.
    const baseUrl = process.env.BETTER_AUTH_URL ?? request.nextUrl.origin;

    if (!isEmailConfigured()) {
      return NextResponse.json(
        { error: "El envío de emails no está configurado" },
        { status: 503 },
      );
    }

    await auth.api.sendVerificationEmail({
      body: {
        email: user.email,
        callbackURL: `${baseUrl}/verify-email`,
      },
      headers: await headers(),
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
      message: "Enviamos un enlace de verificación",
    });
  } catch (error) {
    console.error("[USERS] Error al enviar la verificación:", error);

    return NextResponse.json(
      { error: "No se pudo enviar el email de verificación" },
      { status: 502 },
    );
  }
}
