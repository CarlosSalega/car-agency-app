import type { Role } from "@generated/prisma/client";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

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

/**
 * The page-level guard: every admin page starts with this.
 *
 * It **redirects** instead of throwing. Throwing looked equivalent -- the layout
 * already redirects, so a page should never see a null session -- but the layout
 * and the page render concurrently. When a stale cookie points at a session row
 * that no longer exists, the page's throw lands while the layout is redirecting,
 * and Next downgrades the clean `307` to a `200` carrying a one-second meta
 * refresh plus an error payload. The browser then reloads instead of navigating.
 *
 * `redirect()` raises its own control-flow error, so it composes with the
 * layout's redirect: both point at `/admin/login` and Next resolves them to a
 * single `307`.
 */
export async function requireAuthSession() {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  return session;
}
