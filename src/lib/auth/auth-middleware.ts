import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/auth";

class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export async function requireAuth(request?: NextRequest) {
  const session = await getSession();

  if (!session || !session.user) {
    throw new AuthError("No autenticado", 401);
  }

  if (session.expires < new Date()) {
    throw new AuthError("Sesión expirada", 401);
  }

  if (!session.user.isActive) {
    throw new AuthError("Usuario inactivo", 403);
  }

  return session.user;
}

export async function requireAdmin(request?: NextRequest) {
  const user = await requireAuth(request);

  if (user.role !== "ADMIN") {
    throw new AuthError(
      "Acceso denegado. Se requiere rol de administrador",
      403,
    );
  }

  return user;
}

export function withAuth(
  handler: (request: NextRequest, user: any) => Promise<NextResponse>,
) {
  return async (request: NextRequest) => {
    try {
      const user = await requireAuth(request);
      return handler(request, user);
    } catch (error) {
      if (error instanceof AuthError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.statusCode },
        );
      }
      return NextResponse.json(
        { error: "Error de autenticación" },
        { status: 500 },
      );
    }
  };
}

export function withAdmin(
  handler: (request: NextRequest, user: any) => Promise<NextResponse>,
) {
  return async (request: NextRequest) => {
    try {
      const user = await requireAdmin(request);
      return handler(request, user);
    } catch (error) {
      if (error instanceof AuthError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.statusCode },
        );
      }
      return NextResponse.json(
        { error: "Error de autenticación" },
        { status: 500 },
      );
    }
  };
}
