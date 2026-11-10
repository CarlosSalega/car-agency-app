import type { StagedAssetGroup } from "@/site/seed";

/**
 * The seed machinery's own shapes: how the run reports, and how the files in
 * `public/autos` divide up.
 *
 * The **data** shapes are not here. A client's seed set lives in
 * `src/site/<client>/seed/`, the seam the product must never overwrite, so those
 * interfaces had to leave this folder: a site module importing `prisma/seed/types`
 * would tie the client package to the product's seed script, and their old
 * definitions imported the generated Prisma enums, which would drag the Prisma
 * client into the site layer. They are re-exported below so the machinery still
 * has one module to import for the data it writes.
 */
export type {
  ImageManifest,
  ImageManifestEntry,
  SeedCar,
  SeedLinkTreeLink,
  SeedSeller,
  SeedUser,
  StagedAssetGroup,
} from "@/site/seed";

/**
 * How the files found in `public/autos` divide up. `orphans` is the only
 * category that represents real drift: a file that is neither claimed by the
 * catalog nor declared as staged.
 */
export interface ImageAssetPartition {
  claimed: string[];
  staged: string[];
  orphans: string[];
}

export interface ImageUploadFailure {
  file: string;
  reason: string;
}

export interface ImageSummary {
  matchedFiles: string[];
  stagedAssets: StagedAssetGroup[];
  stagedFiles: string[];
  orphanFiles: string[];
  uploadFailures: ImageUploadFailure[];
  placeholderCars: string[];
}

export interface SeedSummary {
  carsCreated: number;
  brandsCreated: number;
  modelsCreated: number;
  /** Demo inquiries, only ever written to a seeded development database. */
  leadsCreated: number;
  images: ImageSummary;
}
