import type { SiteDefinition } from "./contract";
import { sites, type SiteSlug } from "./registry";

const VARIABLE = "SITE_SLUG";

/**
 * Explains the failure instead of merely announcing it.
 *
 * The message is read by whoever is wiring a deployment at 2am, so it names the
 * variable, the value that was actually read, and the slugs that do exist. A
 * build that fails silently, or that falls back, ships one dealership's name and
 * phone on another dealership's site, which is the defect this whole seam
 * exists to prevent.
 */
function explain(problem: string, value: string): string {
  const slugs = Object.keys(sites);
  const choices = slugs.map((slug) => `  - ${slug}`).join("\n");

  return [
    `${problem}`,
    "",
    `  ${VARIABLE} = ${value}`,
    "",
    "This repository ships these clients:",
    choices,
    "",
    "Set the variable to one of them, for example:",
    `  ${VARIABLE}=${slugs[0] ?? "<slug>"} pnpm dev`,
    "",
    "A client becomes selectable by adding its package to",
    "src/site/registry.ts, next to the package itself.",
    "",
    "There is deliberately no default: a fallback would silently build one",
    "dealership's site with another's name, phone and address.",
  ].join("\n");
}

/**
 * Resolves the client this deployment serves.
 *
 * Exported for the failure modes alone; the product imports `activeSite`.
 */
export function resolveActiveSite(rawSlug: string | undefined): SiteDefinition {
  const slug = rawSlug?.trim();

  if (rawSlug === undefined) {
    throw new Error(
      explain(
        `Missing ${VARIABLE}: this deployment does not say which client site to build.`,
        "(not set)",
      ),
    );
  }

  if (!slug) {
    throw new Error(
      explain(
        `Empty ${VARIABLE}: this deployment does not say which client site to build.`,
        `"${rawSlug}"`,
      ),
    );
  }

  // `sites` is a plain object, so `in` would also match `toString` and friends.
  if (!Object.prototype.hasOwnProperty.call(sites, slug)) {
    throw new Error(
      explain(
        `Unknown ${VARIABLE}: this deployment names a client this repository does not ship.`,
        `"${rawSlug}"`,
      ),
    );
  }

  return sites[slug as SiteSlug];
}

/**
 * **The active site.** Every consumer in the product imports this, and nothing
 * else under `src/site/`.
 *
 * There is exactly one client per deployment (single tenant), so this is resolved
 * once, at import time, from `SITE_SLUG`: no `tenantId`, no request-scoped
 * context, no branching on the host at runtime. The resolution **throws** when
 * the variable is missing or the slug is unknown, which is how the build fails.
 *
 * It must never fall back to a client: the failure mode of a resold white-label
 * is the deployment of client B showing client A's name, phone and address, and
 * a fallback turns a misconfiguration into exactly that.
 */
export const activeSite: SiteDefinition = resolveActiveSite(
  process.env.SITE_SLUG,
);

export type { SiteDefinition } from "./contract";
