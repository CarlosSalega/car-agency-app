import { describe, expect, it } from "vitest";

import { backoffDelayMs, nextRunAt, pickJitter } from "@/lib/jobs/backoff";

/**
 * Backoff is the only part of the retry policy that can be decided without a
 * database, so every rule lives in a pure function and is pinned here.
 *
 * The jitter draw is a separate function on purpose: `Math.random()` inside
 * `nextRunAt` would make "later than the previous attempt" untestable, and this
 * queue's whole point is that a retry lands where the policy says.
 */

const NOW = new Date("2026-02-01T00:00:00.000Z");
const BASE_MS = 1_000;
const CAP_MS = 8_000;

describe("backoffDelayMs", () => {
  it("waits the base delay when nothing has failed yet", () => {
    expect(
      backoffDelayMs({ attempts: 0, baseMs: BASE_MS, capMs: CAP_MS }),
    ).toBe(BASE_MS);
  });

  it("grows exponentially with the attempts already made", () => {
    const delays = [0, 1, 2, 3].map((attempts) =>
      backoffDelayMs({ attempts, baseMs: BASE_MS, capMs: 1_000_000 }),
    );

    expect(delays).toEqual([1_000, 2_000, 4_000, 8_000]);

    for (let index = 1; index < delays.length; index += 1) {
      expect(delays[index]).toBeGreaterThan(delays[index - 1]);
    }
  });

  it("never exceeds the cap, however many attempts have failed", () => {
    for (const attempts of [0, 1, 2, 3, 4, 10, 100, 10_000]) {
      expect(
        backoffDelayMs({ attempts, baseMs: BASE_MS, capMs: CAP_MS }),
      ).toBeLessThanOrEqual(CAP_MS);
    }

    expect(
      backoffDelayMs({ attempts: 30, baseMs: BASE_MS, capMs: CAP_MS }),
    ).toBe(CAP_MS);
  });

  it("treats a negative attempts count as no attempts", () => {
    expect(
      backoffDelayMs({ attempts: -3, baseMs: BASE_MS, capMs: CAP_MS }),
    ).toBe(BASE_MS);
  });

  it("never returns a negative delay", () => {
    expect(backoffDelayMs({ attempts: 2, baseMs: -1_000, capMs: CAP_MS })).toBe(
      0,
    );
  });

  it("scales the capped delay by the injected jitter multiplier", () => {
    expect(
      backoffDelayMs({
        attempts: 2,
        baseMs: BASE_MS,
        capMs: CAP_MS,
        jitter: 0.5,
      }),
    ).toBe(2_000);

    // Jitter can only shorten a delay, so the cap still holds.
    expect(
      backoffDelayMs({
        attempts: 30,
        baseMs: BASE_MS,
        capMs: CAP_MS,
        jitter: 0.5,
      }),
    ).toBe(4_000);
  });
});

describe("pickJitter", () => {
  it("is deterministic for a fixed random source", () => {
    expect(pickJitter(() => 0)).toBe(1);
    expect(pickJitter(() => 1)).toBe(0.75);
    expect(pickJitter(() => 0.5)).toBe(0.875);
  });

  it("stays inside the spread window", () => {
    for (const random of [0, 0.1, 0.5, 0.9, 1]) {
      const jitter = pickJitter(() => random);
      expect(jitter).toBeGreaterThanOrEqual(0.75);
      expect(jitter).toBeLessThanOrEqual(1);
    }
  });

  it("honours a caller-chosen spread", () => {
    expect(pickJitter(() => 1, 0.5)).toBe(0.5);
  });
});

describe("nextRunAt", () => {
  it("adds the delay to the injected clock", () => {
    const at = nextRunAt({
      attempts: 0,
      now: NOW,
      baseMs: BASE_MS,
      capMs: CAP_MS,
    });

    expect(at.toISOString()).toBe("2026-02-01T00:00:01.000Z");
  });

  it("moves later with every failed attempt", () => {
    const first = nextRunAt({
      attempts: 0,
      now: NOW,
      baseMs: BASE_MS,
      capMs: 1_000_000,
    });
    const second = nextRunAt({
      attempts: 1,
      now: NOW,
      baseMs: BASE_MS,
      capMs: 1_000_000,
    });

    expect(second.getTime()).toBeGreaterThan(first.getTime());
  });

  it("stops growing at the cap", () => {
    const at = nextRunAt({
      attempts: 50,
      now: NOW,
      baseMs: BASE_MS,
      capMs: CAP_MS,
    });

    expect(at.getTime() - NOW.getTime()).toBe(CAP_MS);
  });

  it("is deterministic for a given jitter pick", () => {
    const at = nextRunAt({
      attempts: 1,
      now: NOW,
      baseMs: BASE_MS,
      capMs: CAP_MS,
      jitter: pickJitter(() => 0.5),
    });

    expect(at.getTime()).toBe(NOW.getTime() + 1_750);
  });
});
