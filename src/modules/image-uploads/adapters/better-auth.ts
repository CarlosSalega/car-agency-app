import type { Actor } from "../core/types";
import type { GetActor } from "../guards/types";

export interface BetterAuthUserLike {
  readonly id?: string | null;
  readonly role?: string | null;

  readonly isActive?: boolean | null;
}

export interface BetterAuthSessionLike {
  readonly user?: BetterAuthUserLike | null;
  readonly session?: { readonly expiresAt?: Date | string | null } | null;
}

export interface BetterAuthActorOptions {
  readonly requireActive?: boolean;

  readonly checkExpiry?: boolean;

  readonly now?: () => number;
}

export function betterAuthActorFromSession(
  session: BetterAuthSessionLike | null | undefined,
  options: BetterAuthActorOptions = {},
): Actor | null {
  const user = session?.user;

  if (!user || typeof user.id !== "string" || user.id.length === 0) {
    return null;
  }

  if (options.requireActive !== false && user.isActive === false) {
    return null;
  }

  if (
    options.checkExpiry !== false &&
    isExpired(session?.session?.expiresAt, options.now)
  ) {
    return null;
  }

  return user.role === undefined || user.role === null
    ? { id: user.id }
    : { id: user.id, role: user.role };
}

export interface BetterAuthActorResolverOptions<
  Req,
> extends BetterAuthActorOptions {
  readonly getSession: (
    request: Req,
  ) =>
    | Promise<BetterAuthSessionLike | null | undefined>
    | BetterAuthSessionLike
    | null
    | undefined;
}

export function createBetterAuthActorResolver<Req = unknown>(
  options: BetterAuthActorResolverOptions<Req>,
): GetActor<Req> {
  return async (request: Req) =>
    betterAuthActorFromSession(await options.getSession(request), options);
}

function isExpired(
  expiresAt: Date | string | null | undefined,
  now: (() => number) | undefined,
): boolean {
  if (expiresAt === null || expiresAt === undefined) return false;

  const timestamp =
    expiresAt instanceof Date ? expiresAt.getTime() : Date.parse(expiresAt);

  if (Number.isNaN(timestamp)) return false;

  return timestamp <= (now?.() ?? Date.now());
}
