/**
 * A fixed-window rate limiter, small on purpose.
 *
 * The public lead endpoint writes rows without authentication, so it needs a
 * ceiling. This is not a security boundary and the comment would be dishonest if
 * it claimed to be: the counters live in the instance's memory, so a serverless
 * deployment gets one window per warm instance and loses it on a cold start. The
 * real protections are the zod validation, the honeypot and the fact that a row
 * costs an attacker a real HTTP round trip.
 *
 * What it does buy: a single client cannot hammer the endpoint from one instance,
 * which is the accident and the lazy-script case, and it costs no dependency.
 *
 * The clock is injectable so the window behaviour can be tested without sleeping.
 */

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterSeconds: number };

export interface RateLimiterOptions {
  /** Requests allowed per window, per key. */
  limit: number;
  windowMs: number;
  /** Injected in tests; production uses the wall clock. */
  now?: () => number;
  /** Guards the map from unbounded growth under a distributed attack. */
  maxKeys?: number;
}

export interface RateLimiter {
  check(key: string): RateLimitResult;
  reset(): void;
  /** Exposed for the test that proves eviction works. */
  size(): number;
}

interface Window {
  count: number;
  resetAt: number;
}

const DEFAULT_MAX_KEYS = 5_000;

export function createRateLimiter({
  limit,
  windowMs,
  now = Date.now,
  maxKeys = DEFAULT_MAX_KEYS,
}: RateLimiterOptions): RateLimiter {
  if (limit < 1) throw new Error("limit must be at least 1");
  if (windowMs < 1) throw new Error("windowMs must be positive");

  const windows = new Map<string, Window>();

  function prune(currentTime: number): void {
    for (const [key, window] of windows) {
      if (window.resetAt <= currentTime) windows.delete(key);
    }
  }

  function makeRoom(currentTime: number): void {
    prune(currentTime);

    // Still full of live windows: drop the oldest, which is the one closest to
    // expiring anyway. Losing a counter only relaxes the limit briefly.
    while (windows.size >= maxKeys) {
      const oldest = windows.keys().next();
      if (oldest.done) break;
      windows.delete(oldest.value);
    }
  }

  return {
    check(key: string): RateLimitResult {
      const currentTime = now();
      const existing = windows.get(key);

      if (!existing || existing.resetAt <= currentTime) {
        makeRoom(currentTime);
        windows.set(key, { count: 1, resetAt: currentTime + windowMs });
        return { ok: true, remaining: limit - 1 };
      }

      if (existing.count >= limit) {
        return {
          ok: false,
          retryAfterSeconds: Math.max(
            1,
            Math.ceil((existing.resetAt - currentTime) / 1000),
          ),
        };
      }

      existing.count += 1;
      return { ok: true, remaining: limit - existing.count };
    },

    reset(): void {
      windows.clear();
    },

    size(): number {
      return windows.size;
    },
  };
}

/**
 * Best-effort client identity.
 *
 * `x-forwarded-for` is the left-most entry behind a proxy; it is spoofable when
 * the app is reachable without one, which is one more reason this limiter is a
 * speed bump rather than a gate.
 */
export function clientKeyFrom(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  return headers.get("x-real-ip")?.trim() || "unknown";
}
