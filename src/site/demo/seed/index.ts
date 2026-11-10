/**
 * The demo seed set, as one value.
 *
 * A deployment replaces this folder with its own `src/site/<client>/seed/` and
 * points `src/site/seed.ts` at it: the catalogue, the sellers, the staff account
 * and the link tree are the client's data, exactly like the identity and the
 * copy. The product ships this set so a fresh clone has something to browse.
 *
 * The phases of the seed live in `prisma/seed.ts`, not here: it creates the
 * staff user first (every seller row records its creator), then the sellers,
 * then the catalogue that points at them. The order of the imports below is
 * therefore irrelevant to what gets written.
 */
import { seedCars } from "./cars";
import { imageManifest } from "./image-manifest";
import { seedLinkTreeLinks } from "./link-tree";
import { seedSellers } from "./sellers";
import type { SeedData } from "./types";
import { seedUsers } from "./users";

export const demoSeed: SeedData = {
  users: seedUsers,
  sellers: seedSellers,
  linkTree: seedLinkTreeLinks,
  cars: seedCars,
  imageManifest,
};
