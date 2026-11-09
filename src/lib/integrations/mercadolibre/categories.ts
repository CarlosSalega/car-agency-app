import type { MeliClient } from "./client";

/**
 * What Mercado Libre requires of a listing, discovered at runtime.
 *
 * The blocking attribute set is whatever carries `tags.required` in
 * `GET /categories/{id}/attributes`. The documentation gives the mechanism and
 * one worked example (`MLA1744`: BRAND, MODEL, TRIM, VEHICLE_YEAR), not a fixed
 * list, and ML can make a new attribute mandatory without telling anyone. A
 * hand-written table would therefore rot into a publish that fails with an
 * opaque `400`.
 *
 * Two calls:
 *
 * - `predictCategory` turns a vehicle title into a category id
 *   (`/sites/MLA/domain_discovery/search`, one suggestion). Nothing is predicted
 *   for a title the predictor does not recognise, and the caller must then ask a
 *   human instead of guessing.
 * - `getCategoryAttributes` lists the required attributes of a category.
 *
 * The list is cached because a category's requirements change on the marketplace's
 * schedule, not ours, and a publish is not frequent enough to pay a round trip
 * every time. The cache is the only defence against a stale set, so it has a TTL:
 * see `CATEGORY_ATTRIBUTE_TTL_MS`.
 */

export interface CategoryAttribute {
  readonly id: string;
  readonly name: string;
  readonly valueType: string | null;
}

export interface CategoryPrediction {
  readonly categoryId: string;
  readonly categoryName: string | null;
  readonly domainId: string | null;
}

/**
 * How long a cached required-attribute set is trusted: one day.
 *
 * The trade is lopsided. A fetch costs one cheap GET per category per day for
 * the handful of categories a dealership actually uses. A stale set costs a
 * publish that fails at the API with an error nobody can read, because the
 * missing attribute is decided by ML, not by us. One day bounds the damage to "a
 * newly required attribute is noticed within a day, with no deploy", while still
 * removing essentially all of the traffic. `maxAgeMs: 0` forces a refetch for a
 * publication that was rejected for an attribute we did not send.
 */
export const CATEGORY_ATTRIBUTE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * One cached row.
 *
 * `attributes` is the `Json` column as stored, so it is `unknown`: the database
 * can hold anything, including a payload written by an older version of this
 * code. `getRequiredAttributes` validates it before trusting it.
 */
export interface CategoryAttributeCacheEntry {
  readonly attributes: unknown;
  readonly fetchedAt: Date;
}

export interface CategoryAttributeCacheStore {
  read(categoryId: string): Promise<CategoryAttributeCacheEntry | null>;
  write(entry: {
    readonly categoryId: string;
    readonly attributes: readonly CategoryAttribute[];
    readonly fetchedAt: Date;
  }): Promise<void>;
}

interface PredictionPayload {
  readonly category_id?: unknown;
  readonly category_name?: unknown;
  readonly domain_id?: unknown;
}

interface RawAttribute {
  readonly id?: unknown;
  readonly name?: unknown;
  readonly value_type?: unknown;
  readonly tags?: { readonly required?: unknown } | null;
}

/**
 * The category ML suggests for a title, or `null`.
 *
 * `limit=1` on purpose: the first suggestion is the one the marketplace itself
 * would use, and offering a car agency a list of near-misses to choose from is a
 * decision it cannot make better than the predictor.
 */
export async function predictCategory({
  client,
  title,
  site = "MLA",
}: {
  readonly client: MeliClient;
  readonly title: string;
  readonly site?: string;
}): Promise<CategoryPrediction | null> {
  const query = title.trim();

  // An empty query would return the site's most popular category, which is a
  // confident-looking wrong answer.
  if (query === "") return null;

  const payload = await client.get<unknown>(
    `/sites/${encodeURIComponent(site)}/domain_discovery/search`,
    { q: query, limit: 1 },
  );

  if (!Array.isArray(payload)) return null;

  const [first] = payload as PredictionPayload[];
  const categoryId = first?.category_id;

  if (typeof categoryId !== "string" || categoryId === "") return null;

  return {
    categoryId,
    categoryName:
      typeof first.category_name === "string" ? first.category_name : null,
    domainId: typeof first.domain_id === "string" ? first.domain_id : null,
  };
}

/**
 * The attributes this category marks as required.
 *
 * `tags.required` is the only thing that decides it. `catalog_required` and the
 * other tags describe the catalog, not a listing, and sending everything the
 * category mentions would make the payload say more than the vehicle knows.
 */
export async function getCategoryAttributes({
  client,
  categoryId,
}: {
  readonly client: MeliClient;
  readonly categoryId: string;
}): Promise<CategoryAttribute[]> {
  const payload = await client.get<unknown>(
    `/categories/${encodeURIComponent(categoryId)}/attributes`,
  );

  if (!Array.isArray(payload)) return [];

  const attributes: CategoryAttribute[] = [];

  for (const entry of payload as RawAttribute[]) {
    if (typeof entry !== "object" || entry === null) continue;
    if (entry.tags?.required !== true) continue;
    if (typeof entry.id !== "string" || entry.id === "") continue;

    attributes.push({
      id: entry.id,
      name: typeof entry.name === "string" ? entry.name : entry.id,
      valueType: typeof entry.value_type === "string" ? entry.value_type : null,
    });
  }

  return attributes;
}

function parseCachedAttributes(value: unknown): CategoryAttribute[] | null {
  if (!Array.isArray(value)) return null;

  const attributes: CategoryAttribute[] = [];

  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) return null;

    const record = entry as Record<string, unknown>;

    if (typeof record.id !== "string" || typeof record.name !== "string") {
      return null;
    }

    attributes.push({
      id: record.id,
      name: record.name,
      valueType: typeof record.valueType === "string" ? record.valueType : null,
    });
  }

  return attributes;
}

/**
 * The required attributes of a category, from the cache when it is fresh enough.
 *
 * A cached row that cannot be parsed is treated as absent rather than as empty:
 * returning `[]` would tell the caller "nothing is required" and produce exactly
 * the opaque publish failure this module exists to prevent.
 */
export async function getRequiredAttributes(
  categoryId: string,
  {
    client,
    store,
    maxAgeMs = CATEGORY_ATTRIBUTE_TTL_MS,
    now = () => new Date(),
  }: {
    readonly client: MeliClient;
    readonly store: CategoryAttributeCacheStore;
    readonly maxAgeMs?: number;
    readonly now?: () => Date;
  },
): Promise<CategoryAttribute[]> {
  const cached = await store.read(categoryId);
  // Read the clock once: an age and a `fetchedAt` measured against two different
  // "now"s is how a cache entry looks stale for a millisecond and refetches.
  const at = now();

  if (cached !== null && cached.fetchedAt instanceof Date) {
    const age = at.getTime() - cached.fetchedAt.getTime();

    if (Number.isFinite(age) && age < maxAgeMs) {
      const parsed = parseCachedAttributes(cached.attributes);

      if (parsed !== null) return parsed;
    }
  }

  const attributes = await getCategoryAttributes({ client, categoryId });

  await store.write({ categoryId, attributes, fetchedAt: at });

  return attributes;
}
