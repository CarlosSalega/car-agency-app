/**
 * Report an `sslmode` in a Postgres connection string that must not be trusted.
 *
 * Pure by contract: it takes the connection string as an argument, touches no
 * global (never `process.env`) and never connects to anything. Deciding
 * whether to fail is the caller's job — see `createPrismaClient()` in
 * `db.ts`, which only throws when `NODE_ENV === "production"`.
 *
 * `verify-full` is the only acceptable value. `pg` v8 treats `require`,
 * `prefer` and `verify-ca` as aliases for `verify-full`, but `pg` v9 restores
 * real libpq semantics, where `require` means "encrypt without verifying the
 * certificate". A missing `sslmode` against a hosted database means no
 * encryption was requested at all.
 */
const SSL_MODE = {
  /** The only value that is safe to deploy. */
  SECURE: "verify-full",
  /** Returned instead of a mode when the connection string has no `sslmode`. */
  MISSING: "<missing>",
  /** Returned instead of a mode when the connection string is not a URL. */
  UNPARSEABLE: "<unparseable>",
} as const;

/**
 * @returns the offending `sslmode` value, or `null` when the mode is
 * `verify-full`.
 */
export function findInsecureSslMode(connectionString: string): string | null {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    // An unparseable connection string cannot be proven secure, so it is
    // refused rather than allowed to reach the driver and fail there.
    return SSL_MODE.UNPARSEABLE;
  }

  const mode = url.searchParams.get("sslmode");
  if (mode === SSL_MODE.SECURE) return null;

  return mode ?? SSL_MODE.MISSING;
}
