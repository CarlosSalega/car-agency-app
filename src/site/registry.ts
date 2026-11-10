import type { SiteDefinition } from "./contract";
import { demo } from "./demo";

/**
 * The client packages this repository ships, keyed by the slug a deployment
 * names in `SITE_SLUG`.
 *
 * There is no directory scan on purpose. A glob over `src/site/*` would make a
 * half-written client selectable in production just by existing on disk, and it
 * would turn a typo in a folder name into a runtime surprise instead of a
 * build error. Registering a client is one line, next to the import it needs.
 *
 * The keys are the contract: `SiteSlug` is derived from them, so anything the
 * product types as a slug is checked against this object at compile time.
 *
 * **This file is a deployment seam.** A deployment adds its own client here and
 * the sync that ships the product over its tree must preserve this file, the
 * same way it preserves `src/site/theme.css` and `src/site/<client>/`.
 */
export const sites = {
  demo,
} as const satisfies Record<string, SiteDefinition>;

/** Every slug a deployment may legitimately name in `SITE_SLUG`. */
export type SiteSlug = keyof typeof sites;
