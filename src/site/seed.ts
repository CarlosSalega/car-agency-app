/*
 * The active client's seed data.
 *
 * The catalogue, the sellers, the staff account and the link tree are the
 * client's data, so they live behind the same seam as the identity and the copy
 * instead of in `prisma/`, which the product owns. A sync that ships the product
 * over a deployment's tree used to overwrite its inventory with the demo's; with
 * this file, `src/site/<client>/` and this one file are the only things the sync
 * has to preserve.
 *
 * **This file is a deployment seam**, like `src/site/registry.ts` and
 * `src/site/theme.css`. This repository ships the demo set; a deployment changes
 * the two specifiers below to its own `./<client>/seed/` and keeps this file.
 *
 * Nothing in the app imports it: the data is for `prisma/seed.ts`, which is
 * developer tooling, so the catalogue never enters a page bundle — and it is
 * deliberately not part of `SiteDefinition`, because importing `activeSite`
 * everywhere would put eighteen vehicles in every one of those bundles.
 */
export { demoSeed as seedData } from "./demo/seed";

export type {
  ImageManifest,
  ImageManifestEntry,
  SeedCar,
  SeedCarStatus,
  SeedCarType,
  SeedCurrency,
  SeedData,
  SeedFuelType,
  SeedLinkTreeCategory,
  SeedLinkTreeLink,
  SeedRole,
  SeedSeller,
  SeedTransmission,
  SeedUser,
  StagedAssetGroup,
} from "./demo/seed/types";
