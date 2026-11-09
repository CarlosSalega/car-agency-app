import { describe, expect, it } from "vitest";

import { buildIdempotencyKey } from "@/lib/jobs/idempotency";

/**
 * The key is what makes "publish this car" one row instead of five. It has to
 * be stable across processes (no timestamps, no object ids, no random), and it
 * has to distinguish every pair of logical operations that must not be merged.
 */

const PUBLISH = {
  kind: "publish",
  channel: "MERCADOLIBRE",
  accountId: "account-1",
  carId: "car-1",
} as const;

describe("buildIdempotencyKey", () => {
  it("is stable for the same logical operation", () => {
    expect(buildIdempotencyKey({ ...PUBLISH })).toBe(
      buildIdempotencyKey({ ...PUBLISH }),
    );
  });

  it("keeps the kind readable as a prefix", () => {
    expect(buildIdempotencyKey({ ...PUBLISH }).startsWith("publish:")).toBe(
      true,
    );
  });

  it("differs across kinds", () => {
    const keys = ["publish", "update", "pause", "close"].map((kind) =>
      buildIdempotencyKey({ ...PUBLISH, kind }),
    );

    expect(new Set(keys).size).toBe(keys.length);
  });

  it("differs across channels for the same vehicle and account", () => {
    expect(buildIdempotencyKey({ ...PUBLISH, channel: "FACEBOOK" })).not.toBe(
      buildIdempotencyKey({ ...PUBLISH, channel: "INSTAGRAM" }),
    );
  });

  it("differs across accounts on the same channel", () => {
    expect(
      buildIdempotencyKey({ ...PUBLISH, accountId: "account-2" }),
    ).not.toBe(buildIdempotencyKey({ ...PUBLISH }));
  });

  it("differs across vehicles", () => {
    expect(buildIdempotencyKey({ ...PUBLISH, carId: "car-2" })).not.toBe(
      buildIdempotencyKey({ ...PUBLISH }),
    );
  });

  it("does not collapse when a part contains the separator", () => {
    const split = buildIdempotencyKey({
      ...PUBLISH,
      accountId: "a:b",
      carId: "c",
    });
    const shifted = buildIdempotencyKey({
      ...PUBLISH,
      accountId: "a",
      carId: "b:c",
    });

    expect(split).not.toBe(shifted);
  });
});
