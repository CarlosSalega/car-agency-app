import { type NextRequest, NextResponse } from "next/server";

import { verifyPassword } from "@/lib/auth/auth";
import { prisma } from "@/lib/db";
import { isRateLimited, getTimeUntilReset } from "@/lib/rate-limit";
import { createSession } from "@/lib/auth/";
import { loginSchema } from "@/lib/validations/auth";

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0] ||
      request.headers.get("x-real-ip") ||
      "unknown";

    if (isRateLimited(ip)) {
      const timeUntilReset = getTimeUntilReset(ip);
      return NextResponse.json(
        {
          error: "Demasiados intentos de inicio de sesión",
          message: `Por favor, intenta nuevamente en ${Math.ceil(timeUntilReset / 60)} minutos`,
          retryAfter: timeUntilReset,
        },
        { status: 429 },
      );
    }

    const json = await request.json();

    const validationResult = loginSchema.safeParse(json);

    if (!validationResult.success) {
      const errorMessages = validationResult.error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`,
      );

      return NextResponse.json(
        {
          error: "Datos de login inválidos",
          details: errorMessages,
        },
        { status: 400 },
      );
    }

    const { email, password } = validationResult.data;

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        hashedPassword: true,
        role: true,
        isActive: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Email o contraseña incorrectos" },
        { status: 401 },
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        {
          error: "Tu cuenta está desactivada. Contacta al administrador.",
        },
        { status: 403 },
      );
    }

    if (!user.hashedPassword) {
      return NextResponse.json(
        {
          error: "Error de configuración de cuenta. Contacta al administrador.",
        },
        { status: 500 },
      );
    }

    const isValid = await verifyPassword(password, user.hashedPassword);

    if (!isValid) {
      return NextResponse.json(
        { error: "Email o contraseña incorrectos" },
        { status: 401 },
      );
    }

    await createSession(user.id);

    await prisma.log.create({
      data: {
        action: "LOGIN",
        entity: "User",
        entityId: user.id,
        userId: user.id,
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      message: "Inicio de sesión exitoso",
    });
  } catch (error) {
    console.error("[AUTH] Error al iniciar sesión:", error);

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Formato de datos inválido" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Error interno del servidor. Intenta nuevamente." },
      { status: 500 },
    );
  }
}
