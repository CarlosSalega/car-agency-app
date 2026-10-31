import type { LeadStatus } from "@generated/prisma/enums";

/**
 * Aggregation for the panel dashboard.
 *
 * Two decisions worth stating, because both are places where a dashboard lies
 * quietly:
 *
 * 1. **Weeks are bucketed in Argentina time, with a fixed offset.** Argentina is
 *    UTC-3 all year and has no daylight saving, so a constant is correct and far
 *    easier to reason about than `Intl`. A lead that arrives at 23:30 local on a
 *    Sunday must count in that week, not in the next one because UTC already
 *    rolled over.
 *
 * 2. **Empty weeks are kept, with a zero.** A 12-week series with three data
 *    points has to render twelve slots; dropping the empty ones compresses the
 *    x-axis and turns a flat month into a cliff.
 *
 * The conversion rate divides by *closed* leads (won + lost), not by all of
 * them: an inquiry still being worked has no verdict yet, and counting it as a
 * loss would punish the person answering the phone for answering late.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const AR_OFFSET_MS = -3 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

export const LEAD_CHANNEL_DIRECT = "Directo";

export interface MetricsLead {
  status: LeadStatus;
  createdAt: Date;
  utmSource: string | null;
  car: { title: string } | null;
}

export interface WeeklyBucket {
  /** Monday 00:00 in Argentina, as an instant. */
  weekStart: Date;
  count: number;
}

export interface ChannelBucket {
  channel: string;
  count: number;
}

export interface StatusBucket {
  status: LeadStatus;
  count: number;
}

export interface CarBucket {
  title: string;
  count: number;
}

export interface LeadSummary {
  total: number;
  thisWeek: number;
  pending: number;
  won: number;
  lost: number;
  closed: number;
  /** Won over closed, as a ratio between 0 and 1. Zero when nothing closed. */
  conversionRate: number;
}

/** Monday 00:00 in Argentina for the week that contains `date`. */
export function startOfWeekAr(date: Date): Date {
  const shifted = new Date(date.getTime() + AR_OFFSET_MS);
  const weekday = shifted.getUTCDay();
  const daysSinceMonday = (weekday + 6) % 7;
  const mondayShifted = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate() - daysSinceMonday,
  );

  return new Date(mondayShifted - AR_OFFSET_MS);
}

/**
 * `weeks` buckets ending with the week that contains `now`, ascending.
 * Leads older than the window are ignored; the summary carries the totals.
 */
export function bucketByWeek(
  leads: readonly MetricsLead[],
  weeks: number,
  now: Date,
): WeeklyBucket[] {
  if (weeks < 1) return [];

  const currentWeekStart = startOfWeekAr(now).getTime();
  const buckets = new Map<number, number>();

  for (let index = weeks - 1; index >= 0; index -= 1) {
    buckets.set(currentWeekStart - index * WEEK_MS, 0);
  }

  for (const lead of leads) {
    const key = startOfWeekAr(lead.createdAt).getTime();
    const current = buckets.get(key);
    if (current !== undefined) buckets.set(key, current + 1);
  }

  return [...buckets.entries()]
    .sort(([left], [right]) => left - right)
    .map(([weekStart, count]) => ({ weekStart: new Date(weekStart), count }));
}

export function bucketByChannel(
  leads: readonly MetricsLead[],
): ChannelBucket[] {
  const counts = new Map<string, number>();

  for (const lead of leads) {
    const channel = lead.utmSource?.trim() || LEAD_CHANNEL_DIRECT;
    counts.set(channel, (counts.get(channel) ?? 0) + 1);
  }

  return (
    [...counts.entries()]
      .map(([channel, count]) => ({ channel, count }))
      // Ties by name, so the same data always renders in the same order.
      .sort(
        (left, right) =>
          right.count - left.count || left.channel.localeCompare(right.channel),
      )
  );
}

/** Every status is present, including the ones with zero leads. */
export function bucketByStatus(
  leads: readonly MetricsLead[],
  statuses: readonly LeadStatus[],
): StatusBucket[] {
  const counts = new Map<LeadStatus, number>(
    statuses.map((status) => [status, 0]),
  );

  for (const lead of leads) {
    const current = counts.get(lead.status);
    if (current !== undefined) counts.set(lead.status, current + 1);
  }

  return statuses.map((status) => ({ status, count: counts.get(status) ?? 0 }));
}

export function topCars(leads: readonly MetricsLead[], limit = 5): CarBucket[] {
  const counts = new Map<string, number>();

  for (const lead of leads) {
    const title = lead.car?.title;
    if (!title) continue;
    counts.set(title, (counts.get(title) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([title, count]) => ({ title, count }))
    .sort(
      (left, right) =>
        right.count - left.count || left.title.localeCompare(right.title),
    )
    .slice(0, Math.max(0, limit));
}

export function summarize(
  leads: readonly MetricsLead[],
  now: Date,
): LeadSummary {
  const currentWeekStart = startOfWeekAr(now).getTime();
  const currentWeekEnd = currentWeekStart + WEEK_MS;

  let thisWeek = 0;
  let pending = 0;
  let won = 0;
  let lost = 0;

  for (const lead of leads) {
    const created = lead.createdAt.getTime();
    if (created >= currentWeekStart && created < currentWeekEnd) thisWeek += 1;

    if (lead.status === "NEW") pending += 1;
    if (lead.status === "WON") won += 1;
    if (lead.status === "LOST") lost += 1;
  }

  const closed = won + lost;

  return {
    total: leads.length,
    thisWeek,
    pending,
    won,
    lost,
    closed,
    // 0/0 is NaN, and NaN renders as "NaN%" in the panel.
    conversionRate: closed === 0 ? 0 : won / closed,
  };
}
