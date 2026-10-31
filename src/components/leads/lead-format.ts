/**
 * Date rendering for the panel.
 *
 * The formatter pins the time zone instead of using the runtime's: the same
 * component is rendered on the server and hydrated in the browser, and an
 * unpinned formatter produces two different strings when those disagree, which
 * React reports as a hydration mismatch.
 */
const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Argentina/Buenos_Aires",
});

export function formatLeadDateTime(value: Date): string {
  return DATE_TIME_FORMATTER.format(value);
}

/**
 * The x-axis label of a week bucket: day and month (`19/10`).
 *
 * Same pinned time zone as above, for the same reason: the label is produced
 * during the server render and again during hydration, and the two must agree.
 */
const WEEK_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "America/Argentina/Buenos_Aires",
});

export function formatLeadWeekLabel(value: Date): string {
  return WEEK_FORMATTER.format(value);
}

/**
 * How a lead arrived, in the order a person reads it: source, then medium, then
 * campaign (`instagram · cpc · hilux-octubre`).
 *
 * "Directo" covers both a visitor with no campaign and one whose campaign was
 * never captured; the dialog shows the referrer and the landing page underneath
 * when they exist, so the coarse answer is never the only one.
 */
export function formatLeadChannel(lead: {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
}): string {
  const parts = [lead.utmSource, lead.utmMedium, lead.utmCampaign].filter(
    (part): part is string => Boolean(part),
  );

  return parts.length > 0 ? parts.join(" · ") : "Directo";
}
