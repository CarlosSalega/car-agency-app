/**
 * When a retry happens, with no I/O and no `Math.random()` inside the delay.
 *
 * MercadoLibre publishes no numeric rate limit, only `429` plus "back off with
 * jitter, do not burst" guidance, so the policy is defensive: exponential from
 * a base delay, capped so a bad hour does not become a bad day, and jittered so
 * two jobs that failed together do not retry together.
 *
 * The jitter draw is a separate function (`pickJitter`) because a random value
 * picked inside `nextRunAt` would make every assertion about a retry time
 * untestable. Callers pick a value and pass it in; production passes
 * `pickJitter()` (possibly with a seeded source), tests pass a literal.
 */

/** First retry waits 30 s. */
export const DEFAULT_BASE_MS = 30_000;

/** No single retry waits longer than one hour. */
export const DEFAULT_CAP_MS = 60 * 60 * 1_000;

/** Jitter may shorten a delay by at most this share. */
export const DEFAULT_JITTER_SPREAD = 0.25;

export interface BackoffPolicy {
  readonly baseMs?: number;
  readonly capMs?: number;
  /**
   * Multiplier from `pickJitter`, in `[1 - spread, 1]`. Defaults to 1 (no
   * jitter) so a caller that never thinks about jitter still gets a
   * deterministic schedule.
   */
  readonly jitter?: number;
}

export interface BackoffDelayInput extends BackoffPolicy {
  /**
   * Attempts already made. 0 means nothing has failed yet and the delay is the
   * base; every further attempt doubles it until the cap.
   */
  readonly attempts: number;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * The delay before the next attempt, in milliseconds. Never negative and never
 * above the cap, whatever the arguments say.
 */
export function backoffDelayMs(input: BackoffDelayInput): number {
  const baseMs = Math.max(0, input.baseMs ?? DEFAULT_BASE_MS);
  const capMs = Math.max(0, input.capMs ?? DEFAULT_CAP_MS);
  const attempts = Math.max(0, Math.floor(input.attempts));
  const jitter = input.jitter === undefined ? 1 : clamp01(input.jitter);

  // `2 ** attempts` saturates at Infinity for large counts, and `Math.min`
  // turns that into the cap instead of an Invalid Date.
  const exponential = baseMs * 2 ** attempts;
  const capped = Math.min(capMs, exponential);

  return Math.max(0, Math.round(capped * jitter));
}

/**
 * A pure jitter multiplier in `[1 - spread, 1]`.
 *
 * `random()` is injected so the draw is reproducible: `pickJitter(() => 0)`
 * is the full delay, `pickJitter(() => 1)` is the shortest one the policy
 * allows.
 */
export function pickJitter(
  random: () => number = Math.random,
  spread = DEFAULT_JITTER_SPREAD,
): number {
  return 1 - clamp01(spread) * clamp01(random());
}

export interface NextRunAtInput extends BackoffDelayInput {
  readonly now: Date;
}

/** The moment of the next attempt, measured from the injected clock. */
export function nextRunAt(input: NextRunAtInput): Date {
  return new Date(input.now.getTime() + backoffDelayMs(input));
}
