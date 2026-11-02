import { glautos } from "./glautos";

/**
 * **The active site.** Every consumer in the product imports this, and nothing
 * else under `src/site/`.
 *
 * There is exactly one client per deployment (single tenant), so this is a plain
 * constant rather than a lookup: no `tenantId`, no request-scoped context, no
 * runtime branching on the host.
 *
 * **Phase 1 replaces the body of this file** with a resolution from `SITE_SLUG`
 * that **fails the build** when the value is missing or unknown. It must never
 * fall back to a default client: the failure mode of a resold white-label is the
 * deployment of client B showing client A's name, phone and address, and a
 * fallback turns a misconfiguration into exactly that.
 */
export const activeSite = glautos;

export type { SiteDefinition } from "./contract";
