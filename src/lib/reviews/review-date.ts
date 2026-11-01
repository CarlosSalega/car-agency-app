/**
 * The "hace 3 meses" label under a testimonial, derived from a real date.
 *
 * Two decisions worth keeping:
 *
 * 1. **It is not stored.** The old component hardcoded the phrase next to the
 *    review, so every month the page told a slightly bigger lie. A date plus a
 *    formatter cannot drift.
 * 2. **The buckets are 30-day months, not calendar months.** The label is a
 *    feeling ("hace 3 meses"), not an accounting entry, and a calendar-correct
 *    version needs a timezone and a reference month to be testable at all. The
 *    arithmetic is therefore done on whole UTC days, so the same row renders the
 *    same text on the server and after hydration, in any timezone.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const DAYS_PER_WEEK = 7;
const DAYS_PER_MONTH = 30;
const MONTHS_PER_YEAR = 12;

/** Whole days between two instants, floored at UTC midnight of each calendar day. */
function wholeDaysBetween(from: Date, to: Date): number {
  const start = Date.UTC(
    from.getUTCFullYear(),
    from.getUTCMonth(),
    from.getUTCDate(),
  );
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());

  return Math.round((end - start) / DAY_MS);
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/**
 * @param reviewedAt When the customer wrote the review. A `Date` from a direct
 *   query, or the ISO string the cached read returns — both arrive here, so both
 *   are accepted instead of each caller coercing on its own.
 * @param now The reference instant. Passed in by the caller so the formatter is
 *   pure and the test never reads the clock.
 */
export function formatRelativeReviewDate(
  reviewedAt: Date | string,
  now: Date = new Date(),
): string {
  const date = reviewedAt instanceof Date ? reviewedAt : new Date(reviewedAt);

  if (Number.isNaN(date.getTime())) return "hoy";

  const days = wholeDaysBetween(date, now);

  // A future date is a data error, not a label. The write schema rejects it; if a
  // row arrives another way, "hoy" is the only phrasing that is not a lie.
  if (!Number.isFinite(days) || days <= 0) return "hoy";

  if (days < DAYS_PER_WEEK) return `hace ${plural(days, "día", "días")}`;

  if (days < DAYS_PER_MONTH) {
    return `hace ${plural(Math.floor(days / DAYS_PER_WEEK), "semana", "semanas")}`;
  }

  const months = Math.floor(days / DAYS_PER_MONTH);

  if (months < MONTHS_PER_YEAR) {
    return `hace ${plural(months, "mes", "meses")}`;
  }

  return `hace ${plural(Math.floor(months / MONTHS_PER_YEAR), "año", "años")}`;
}
