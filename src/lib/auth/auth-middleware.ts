import { NextRequest } from "next/server";

import { getSession } from "@/lib/auth";

export type AuthenticatedUser = NonNullable<
  Awaited<ReturnType<typeof getSession>>
>["user"];

/**
 * The guards' failure mode.
 *
 * Exported on purpose: a route that catches this has to be able to map
 * `statusCode` onto a response, and an error nobody can identify is a trap.
 *
 * `withAuth` / `withAdmin` used to do that mapping here. They were removed
 * because no route ever imported them and their `(request)` signature silently
 * dropped Next's second handler argument (`{ params }`), so adopting them as-is
 * would have broken every dynamic route such as `/api/cars/[id]`.
 */
export class AuthError extends Error {
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
