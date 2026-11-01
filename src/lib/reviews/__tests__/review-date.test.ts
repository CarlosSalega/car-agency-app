import { describe, expect, it } from "vitest";

import { formatRelativeReviewDate } from "@/lib/reviews";

/**
 * The "hace 3 meses" label used to be a string baked into the component, which
 * is a lie the moment a month passes. It is derived from `reviewedAt` now, so the
 * formatter is the only thing that can be wrong.
 *
 * `now` is always passed explicitly: a test that reads the clock is a test that
 * fails on a Tuesday in another timezone.
 */

const NOW = new Date("2026-11-01T15:00:00.000Z");

const day = (iso: string) => new Date(`${iso}T12:00:00.000Z`);

describe("formatRelativeReviewDate", () => {
  it("says hoy for a review written earlier the same day", () => {
    expect(formatRelativeReviewDate(day("2026-11-01"), NOW)).toBe("hoy");
  });

  it("says hace 1 día for the previous day", () => {
    expect(formatRelativeReviewDate(day("2026-10-31"), NOW)).toBe("hace 1 día");
  });

  it("counts days below a week", () => {
    expect(formatRelativeReviewDate(day("2026-10-28"), NOW)).toBe(
      "hace 4 días",
    );
  });

  it("switches to weeks at seven days", () => {
    expect(formatRelativeReviewDate(day("2026-10-25"), NOW)).toBe(
      "hace 1 semana",
    );
    expect(formatRelativeReviewDate(day("2026-10-11"), NOW)).toBe(
      "hace 3 semanas",
    );
  });

  it("switches to months at thirty days", () => {
    expect(formatRelativeReviewDate(day("2026-10-02"), NOW)).toBe("hace 1 mes");
    expect(formatRelativeReviewDate(day("2026-08-01"), NOW)).toBe(
      "hace 3 meses",
    );
  });

  it("switches to years at twelve months", () => {
    expect(formatRelativeReviewDate(day("2025-11-01"), NOW)).toBe("hace 1 año");
    expect(formatRelativeReviewDate(day("2023-11-01"), NOW)).toBe(
      "hace 3 años",
    );
  });

  it("accepts the ISO string the cached read returns", () => {
    // `unstable_cache` hands back JSON, so this is the shape production passes.
    expect(formatRelativeReviewDate("2026-07-01T12:00:00.000Z", NOW)).toBe(
      "hace 4 meses",
    );
  });

  it("falls back to hoy for a date it cannot parse", () => {
    expect(formatRelativeReviewDate("not-a-date", NOW)).toBe("hoy");
  });

  it("does not invent a future label for a date ahead of now", () => {
    // The write schema rejects future dates; this is the formatter staying total
    // for a row that arrived another way (an import, a manual edit).
    expect(formatRelativeReviewDate(day("2026-12-01"), NOW)).toBe("hoy");
  });
});
