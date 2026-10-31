import { describe, expect, it } from "vitest";

import {
  bucketByChannel,
  bucketByStatus,
  bucketByWeek,
  LEAD_CHANNEL_DIRECT,
  startOfWeekAr,
  summarize,
  topCars,
  type MetricsLead,
} from "../metrics";

/**
 * Dates below are real: 2026-10-26 is a Monday, 2026-11-01 a Sunday, and
 * Argentina is UTC-3, so a Monday 00:00 there is 03:00Z.
 */
const MONDAY_26_AR = "2026-10-26T03:00:00.000Z";
const MONDAY_02_AR = "2026-11-02T03:00:00.000Z";

function lead(overrides: Partial<MetricsLead> = {}): MetricsLead {
  return {
    status: "NEW",
    createdAt: new Date("2026-10-28T15:00:00.000Z"),
    utmSource: null,
    car: null,
    ...overrides,
  };
}

describe("startOfWeekAr", () => {
  it("snaps a mid-week instant to the preceding Monday at 00:00 Argentina", () => {
    // Wednesday 28 October 2026, 12:00 in Argentina.
    const wednesday = new Date("2026-10-28T15:00:00.000Z");

    expect(startOfWeekAr(wednesday).toISOString()).toBe(MONDAY_26_AR);
  });

  it("keeps a late Sunday in the week that is ending, even though UTC already rolled over", () => {
    // Sunday 1 November 23:30 in Argentina is Monday 2 November 02:30 UTC.
    const sundayNight = new Date("2026-11-02T02:30:00.000Z");
    expect(sundayNight.getUTCDay()).toBe(1);

    expect(startOfWeekAr(sundayNight).toISOString()).toBe(MONDAY_26_AR);
  });

  it("opens a new week at Monday 00:00 Argentina", () => {
    expect(startOfWeekAr(new Date(MONDAY_02_AR)).toISOString()).toBe(
      MONDAY_02_AR,
    );
  });
});

describe("bucketByWeek", () => {
  const now = new Date(MONDAY_02_AR);

  it("returns the requested number of weeks, ascending, including empty ones", () => {
    const buckets = bucketByWeek([], 3, now);

    expect(buckets).toHaveLength(3);
    expect(buckets.map((bucket) => bucket.weekStart.toISOString())).toEqual([
      "2026-10-19T03:00:00.000Z",
      MONDAY_26_AR,
      MONDAY_02_AR,
    ]);
    expect(buckets.every((bucket) => bucket.count === 0)).toBe(true);
  });

  it("counts each lead in its own week and leaves the rest at zero", () => {
    const buckets = bucketByWeek(
      [
        lead({ createdAt: new Date("2026-10-28T15:00:00.000Z") }),
        lead({ createdAt: new Date("2026-11-02T02:30:00.000Z") }),
        lead({ createdAt: new Date("2026-11-02T12:00:00.000Z") }),
      ],
      3,
      now,
    );

    expect(buckets.map((bucket) => bucket.count)).toEqual([0, 2, 1]);
  });

  it("ignores leads older than the window instead of folding them into the first week", () => {
    const buckets = bucketByWeek(
      [lead({ createdAt: new Date("2026-09-01T12:00:00.000Z") })],
      2,
      now,
    );

    expect(buckets.map((bucket) => bucket.count)).toEqual([0, 0]);
  });

  it("returns nothing when asked for no weeks", () => {
    expect(bucketByWeek([], 0, now)).toEqual([]);
  });
});

describe("bucketByChannel", () => {
  it("calls a lead with no campaign Directo", () => {
    expect(bucketByChannel([lead()])).toEqual([
      { channel: LEAD_CHANNEL_DIRECT, count: 1 },
    ]);
  });

  it("treats a blank source as Directo too, not as its own empty channel", () => {
    expect(bucketByChannel([lead({ utmSource: "   " })])).toEqual([
      { channel: LEAD_CHANNEL_DIRECT, count: 1 },
    ]);
  });

  it("orders by count and breaks ties by name, so the same data always renders the same", () => {
    const buckets = bucketByChannel([
      lead({ utmSource: "google" }),
      lead({ utmSource: "instagram" }),
      lead({ utmSource: "instagram" }),
      lead(),
    ]);

    expect(buckets).toEqual([
      { channel: "instagram", count: 2 },
      { channel: LEAD_CHANNEL_DIRECT, count: 1 },
      { channel: "google", count: 1 },
    ]);
  });
});

describe("bucketByStatus", () => {
  const statuses = ["NEW", "CONTACTED", "NEGOTIATING", "WON", "LOST"] as const;

  it("lists every status, including the ones nobody used yet", () => {
    expect(bucketByStatus([lead({ status: "WON" })], statuses)).toEqual([
      { status: "NEW", count: 0 },
      { status: "CONTACTED", count: 0 },
      { status: "NEGOTIATING", count: 0 },
      { status: "WON", count: 1 },
      { status: "LOST", count: 0 },
    ]);
  });
});

describe("topCars", () => {
  it("ignores leads with no car and orders the rest by count", () => {
    const buckets = topCars([
      lead({ car: { title: "Toyota Hilux 2022" } }),
      lead({ car: { title: "Volkswagen Taos 2025" } }),
      lead({ car: { title: "Volkswagen Taos 2025" } }),
      lead({ car: null }),
    ]);

    expect(buckets).toEqual([
      { title: "Volkswagen Taos 2025", count: 2 },
      { title: "Toyota Hilux 2022", count: 1 },
    ]);
  });

  it("respects the limit", () => {
    const buckets = topCars(
      [
        lead({ car: { title: "A" } }),
        lead({ car: { title: "B" } }),
        lead({ car: { title: "C" } }),
      ],
      2,
    );

    expect(buckets).toHaveLength(2);
  });
});

describe("summarize", () => {
  const now = new Date(MONDAY_02_AR);

  it("reports zeros and a zero rate for an empty database instead of NaN", () => {
    const summary = summarize([], now);

    expect(summary).toEqual({
      total: 0,
      thisWeek: 0,
      pending: 0,
      won: 0,
      lost: 0,
      closed: 0,
      conversionRate: 0,
    });
    expect(Number.isNaN(summary.conversionRate)).toBe(false);
  });

  it("counts only the current week as thisWeek", () => {
    const summary = summarize(
      [
        lead({ createdAt: new Date("2026-11-02T04:00:00.000Z") }),
        lead({ createdAt: new Date("2026-11-02T02:30:00.000Z") }),
      ],
      now,
    );

    expect(summary.thisWeek).toBe(1);
    expect(summary.total).toBe(2);
  });

  it("computes the rate over closed leads only, so a lead still being worked is not a loss", () => {
    const summary = summarize(
      [
        lead({ status: "WON" }),
        lead({ status: "WON" }),
        lead({ status: "LOST" }),
        lead({ status: "NEW" }),
        lead({ status: "NEGOTIATING" }),
      ],
      now,
    );

    expect(summary).toMatchObject({ won: 2, lost: 1, closed: 3, pending: 1 });
    expect(summary.conversionRate).toBeCloseTo(2 / 3);
  });
});
