import type { Role } from "@generated/prisma/client";
import { headers } from "next/headers";

import { auth } from "./server";

type BetterAuthSession = NonNullable<
  Awaited<ReturnType<typeof auth.api.getSession>>
>;

/**
 * The user shape every caller already depends on.
 *
 * `role` is narrowed back to the Prisma enum: better-auth types additional
 * fields as plain strings, but the rest of the app compares against `Role`.
 */
export type SessionUser = Omit<BetterAuthSession["user"], "role"> & {
  role: Role;
};

/**
 * The session shape every caller already depends on: the session record
 * itself with `user` attached -- **not** a `{ session, user }` wrapper.
 * 63 call sites read `session.user` and 4 read `session.expires`.
 */
export type AuthSession = {
  sessionToken: string;
  userId: string;
  expires: Date;
  user: SessionUser;
};

/**
 * Reads the better-auth session from the request cookies and maps it onto the
 * flat contract above.
 *
 * Returns `null` for an inactive user even though better-auth would happily
 * return the session: deactivating an account must invalidate it immediately,
 * which is what the old hand-rolled lookup guaranteed.
 */
export async function getSession(): Promise<AuthSession | null> {
  const result = await auth.api.getSession({ headers: await headers() });

  if (!result) return null;

  const { session, user } = result;

  if (!user.isActive) return null;

  const expires = new Date(session.expiresAt);

  if (expires < new Date()) return null;

  return {
    sessionToken: session.token,
    userId: session.userId,
    expires,
    user: { ...user, role: user.role as Role },
  };
}

export async function requireAuthSession() {
  const session = await getSession();
  if (!session) {
    throw new Error(
      "Sesión no encontrada. Esto no debería ocurrir si el layout está funcionando correctamente.",
    );
  }
  return session;
}
