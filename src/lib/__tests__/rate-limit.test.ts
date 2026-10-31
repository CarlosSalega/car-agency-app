import { describe, expect, it } from "vitest";

import { clientKeyFrom, createRateLimiter } from "../rate-limit";

function fixedClock(start = 1_000_000) {
  let current = start;
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms;
    },
  };
}

describe("createRateLimiter", () => {
  it("allows up to the limit and then refuses with a retry hint", () => {
    const clock = fixedClock();
    const limiter = createRateLimiter({
      limit: 3,
      windowMs: 60_000,
      now: clock.now,
    });

    expect(limiter.check("ip")).toMatchObject({ ok: true, remaining: 2 });
    expect(limiter.check("ip")).toMatchObject({ ok: true, remaining: 1 });
    expect(limiter.check("ip")).toMatchObject({ ok: true, remaining: 0 });

    const refused = limiter.check("ip");
    expect(refused.ok).toBe(false);
    expect(refused.ok === false && refused.retryAfterSeconds).toBe(60);
  });

  it("reopens the window once it expires", () => {
    const clock = fixedClock();
    const limiter = createRateLimiter({
      limit: 1,
      windowMs: 30_000,
      now: clock.now,
    });

    expect(limiter.check("ip").ok).toBe(true);
    expect(limiter.check("ip").ok).toBe(false);

    clock.advance(30_000);
    expect(limiter.check("ip")).toMatchObject({ ok: true, remaining: 0 });
  });

  it("keeps separate counters per key, so one visitor cannot block another", () => {
    const clock = fixedClock();
    const limiter = createRateLimiter({
      limit: 1,
      windowMs: 60_000,
      now: clock.now,
    });

    expect(limiter.check("a").ok).toBe(true);
    expect(limiter.check("b").ok).toBe(true);
    expect(limiter.check("a").ok).toBe(false);
    expect(limiter.check("b").ok).toBe(false);
  });

  it("reports the remaining time rounded up, never zero or negative", () => {
    const clock = fixedClock();
    const limiter = createRateLimiter({
      limit: 1,
      windowMs: 10_000,
      now: clock.now,
    });

    limiter.check("ip");
    clock.advance(9_700);

    const refused = limiter.check("ip");
    expect(refused.ok === false && refused.retryAfterSeconds).toBe(1);
  });

  it("evicts instead of growing without bound", () => {
    const clock = fixedClock();
    const limiter = createRateLimiter({
      limit: 5,
      windowMs: 60_000,
      now: clock.now,
      maxKeys: 10,
    });

    for (let index = 0; index < 50; index += 1) limiter.check(`ip-${index}`);

    expect(limiter.size()).toBeLessThanOrEqual(10);
  });

  it("drops expired windows before making room, so they do not count against the cap", () => {
    const clock = fixedClock();
    const limiter = createRateLimiter({
      limit: 5,
      windowMs: 1_000,
      now: clock.now,
      maxKeys: 3,
    });

    for (let index = 0; index < 3; index += 1) limiter.check(`old-${index}`);
    expect(limiter.size()).toBe(3);

    clock.advance(1_000);
    limiter.check("fresh");

    expect(limiter.size()).toBe(1);
  });

  it("rejects a non-positive configuration instead of silently allowing nothing", () => {
    expect(() => createRateLimiter({ limit: 0, windowMs: 1_000 })).toThrow();
    expect(() => createRateLimiter({ limit: 1, windowMs: 0 })).toThrow();
  });
});

describe("clientKeyFrom", () => {
  it("takes the left-most forwarded address", () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.7, 10.0.0.1, 10.0.0.2",
    });

    expect(clientKeyFrom(headers)).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip", () => {
    expect(clientKeyFrom(new Headers({ "x-real-ip": "203.0.113.9" }))).toBe(
      "203.0.113.9",
    );
  });

  it("groups callers with no address headers under one key", () => {
    expect(clientKeyFrom(new Headers())).toBe("unknown");
  });
});
