/**
 * First-touch attribution for an inquiry.
 *
 * Two facts shape this module:
 *
 * 1. UTMs live on the URL of the page the visitor browsed, not on the URL the
 *    form posts to, so the browser has to read them.
 * 2. The `referer` header the server sees is *our own* car page, which is why it
 *    lands in `Lead.source` and not here. The site that actually brought the
 *    visitor is `document.referrer`, and only the browser knows it.
 *
 * Nothing here trusts the client for anything that matters: attribution is the
 * visitor's own claim about where they came from, and the worst case is a
 * wrong channel on a row nobody's permissions depend on.
 *
 * First touch wins. A visitor who arrives from Instagram and then reloads the
 * homepage directly still belongs to Instagram, because overwriting the first
 * value with a later, emptier one is how attribution silently degrades to
 * "direct" for everybody.
 */

export const ATTRIBUTION_STORAGE_KEY = "gl-attribution";

/** Long enough for a campaign name, short enough to stay out of a DB column's way. */
export const MAX_ATTRIBUTION_LENGTH = 120;

export interface LeadAttribution {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  referrer?: string;
}

const UTM_PARAMS: Record<string, keyof LeadAttribution> = {
  utm_source: "utmSource",
  utm_medium: "utmMedium",
  utm_campaign: "utmCampaign",
};

const ATTRIBUTION_FIELDS = [
  "utmSource",
  "utmMedium",
  "utmCampaign",
  "referrer",
] as const;

/**
 * Trim, collapse whitespace, drop control characters and cap the length. A
 * campaign name arrives from a URL a stranger controls, so it is normalised
 * here rather than at every read site.
 */
export function cleanAttributionValue(
  value: string | null | undefined,
): string | undefined {
  if (typeof value !== "string") return undefined;

  const cleaned = value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned === "") return undefined;

  return cleaned.slice(0, MAX_ATTRIBUTION_LENGTH);
}

/**
 * Reads the campaign parameters from a query string and the external referrer.
 *
 * `selfHost` exists to keep our own domain out of `referrer`: an internal
 * navigation is not a source, and storing it would make every inquiry look like
 * it was referred by the site itself.
 */
export function parseAttribution(
  search: string,
  referrer: string | null | undefined,
  selfHost?: string,
): LeadAttribution {
  const result: LeadAttribution = {};

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
    params = new URLSearchParams();
  }

  for (const [param, field] of Object.entries(UTM_PARAMS)) {
    const value = cleanAttributionValue(params.get(param));
    if (value) result[field] = value;
  }

  const externalReferrer = cleanReferrer(referrer, selfHost);
  if (externalReferrer) result.referrer = externalReferrer;

  return result;
}

function cleanReferrer(
  referrer: string | null | undefined,
  selfHost?: string,
): string | undefined {
  const cleaned = cleanAttributionValue(referrer);
  if (!cleaned) return undefined;

  let url: URL;
  try {
    url = new URL(cleaned);
  } catch {
    // A referrer that is not a URL is not usable as a channel.
    return undefined;
  }

  if (!/^https?:$/.test(url.protocol)) return undefined;
  if (selfHost && url.host === selfHost) return undefined;

  return cleanAttributionValue(`${url.host}${url.pathname}`);
}

/**
 * Keeps the stored first touch and only fills the gaps, so a later landing with
 * no campaign cannot erase the campaign that brought the visitor.
 */
export function mergeFirstTouch(
  stored: LeadAttribution | null | undefined,
  incoming: LeadAttribution,
): LeadAttribution {
  const merged: LeadAttribution = {};

  for (const field of ATTRIBUTION_FIELDS) {
    merged[field] = stored?.[field] ?? incoming[field];
  }

  return merged;
}

export function isEmptyAttribution(
  attribution: LeadAttribution | null | undefined,
): boolean {
  if (!attribution) return true;

  return ATTRIBUTION_FIELDS.every((field) => !attribution[field]);
}

/** Only the fields that carry a value, so the request body stays small. */
export function compactAttribution(
  attribution: LeadAttribution | null | undefined,
): LeadAttribution {
  if (!attribution) return {};

  const compact: LeadAttribution = {};
  for (const field of ATTRIBUTION_FIELDS) {
    const value = cleanAttributionValue(attribution[field]);
    if (value) compact[field] = value;
  }

  return compact;
}

function readStored(storage: Storage | undefined): LeadAttribution | null {
  if (!storage) return null;

  try {
    const raw = storage.getItem(ATTRIBUTION_STORAGE_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;

    return compactAttribution(parsed as LeadAttribution);
  } catch {
    // Private mode, a quota error, or a corrupted value: attribution is not
    // worth breaking a page over.
    return null;
  }
}

/**
 * Browser-side read for the form. Prefers the persisted first touch and falls
 * back to the current URL, which covers a visitor who landed with UTMs directly
 * on the car page.
 */
export function readAttribution(): LeadAttribution {
  if (typeof window === "undefined") return {};

  let storage: Storage | undefined;
  try {
    storage = window.sessionStorage;
  } catch {
    storage = undefined;
  }

  const stored = readStored(storage);
  const incoming = parseAttribution(
    window.location.search,
    document.referrer,
    window.location.host,
  );

  return compactAttribution(mergeFirstTouch(stored, incoming));
}

/**
 * Persists the first touch. Returns the attribution that is now in storage so a
 * caller (or a test) can assert what a later submit would send.
 */
export function captureFirstTouch(): LeadAttribution {
  if (typeof window === "undefined") return {};

  let storage: Storage | undefined;
  try {
    storage = window.sessionStorage;
  } catch {
    storage = undefined;
  }

  const stored = readStored(storage);
  const incoming = parseAttribution(
    window.location.search,
    document.referrer,
    window.location.host,
  );

  if (isEmptyAttribution(incoming)) return compactAttribution(stored);

  const merged = compactAttribution(mergeFirstTouch(stored, incoming));

  try {
    storage?.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // Not being able to persist still leaves the value usable for this page.
  }

  return merged;
}
