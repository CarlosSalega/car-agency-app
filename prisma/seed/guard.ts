/**
 * `pnpm db:seed` calls `resetDatabase()`, which empties every table the seed owns
 * before recreating it. That is correct for a local fixture and unrecoverable
 * anywhere else, and Phase 0 of the roadmap has no backup yet, so the command
 * refuses to start when the environment says it is not development.
 *
 * The decision is a pure function on purpose: it can be tested without a
 * database, a subprocess, or a shell script that lies.
 */

/** Set to `1` to allow a destructive seed outside development, on purpose. */
export const SEED_ENV_OVERRIDE = "SEED_ALLOW_DESTRUCTIVE";

/**
 * Every table `resetDatabase()` empties, in deletion order. A test asserts this
 * list still matches the `deleteMany()` calls, so the warning the operator reads
 * cannot drift away from what actually happens.
 */
export const DESTRUCTIVE_TABLES = [
  "review",
  "lead",
  "visit",
  "log",
  "car",
  "seller",
  "model",
  "brand",
  "linkTreeLink",
  "settings",
  "session",
  "account",
  "verification",
  "user",
] as const;

export interface SeedGuardInput {
  NODE_ENV?: string;
  VERCEL_ENV?: string;
  SEED_ALLOW_DESTRUCTIVE?: string;
}

export type SeedGuardDecision =
  | { allowed: true; overridden: boolean }
  | { allowed: false; reason: string };

const OVERRIDE_VALUES = new Set(["1", "true", "yes"]);

/**
 * A Vercel preview deployment points at a real database too, so `preview` is
 * blocked as well: it is not a safer place to empty the users table than
 * production is. `vercel dev` reports `development` and stays allowed.
 */
const BLOCKED_VERCEL_ENVS = new Set(["production", "preview"]);

export function decideSeedAllowed(env: SeedGuardInput): SeedGuardDecision {
  const override = (env.SEED_ALLOW_DESTRUCTIVE ?? "").trim().toLowerCase();
  if (OVERRIDE_VALUES.has(override)) {
    return { allowed: true, overridden: true };
  }

  // `tsx prisma/seed.ts` leaves NODE_ENV unset, which is a normal local run, so
  // only an explicit "production" blocks it. Blocking on "not development"
  // instead would break the documented `pnpm db:seed` flow for everyone.
  if (env.NODE_ENV === "production") {
    return { allowed: false, reason: 'NODE_ENV is "production"' };
  }

  if (env.VERCEL_ENV && BLOCKED_VERCEL_ENVS.has(env.VERCEL_ENV)) {
    return { allowed: false, reason: `VERCEL_ENV is "${env.VERCEL_ENV}"` };
  }

  return { allowed: true, overridden: false };
}

export function seedRefusalMessage(reason: string): string {
  return [
    "",
    `Refusing to seed: ${reason}.`,
    "",
    "`pnpm db:seed` empties these tables before recreating them:",
    `  ${DESTRUCTIVE_TABLES.join(", ")}`,
    "",
    "That cannot be undone without a backup. Nothing was changed.",
    `If this is intentional, run it again with ${SEED_ENV_OVERRIDE}=1.`,
    "",
  ].join("\n");
}
