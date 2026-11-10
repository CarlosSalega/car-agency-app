/**
 * The shapes of a client's seed data set.
 *
 * These are plain data, and deliberately **not** the generated Prisma enums. The
 * data lives in `src/site/<client>/`, the seam the product must never overwrite,
 * so it may not depend on `prisma/` at all: importing `@generated/prisma/client`
 * here would pull the generated client — and `node:process`, `node:path` and the
 * Prisma runtime it loads — into the site layer, for a run that only writes rows.
 *
 * The unions below repeat the schema's enum values in a shape Prisma accepts. A
 * typo cannot survive: `prisma/seed/repositories.ts` passes these values straight
 * into `create()`/`createMany()`, whose arguments are typed by the generated
 * client, so `tsc` rejects a value the database does not know.
 */

/** Mirrors `Role` in `prisma/schema.prisma`. */
export type SeedRole = "ADMIN" | "COLLABORATOR";

/** Mirrors `CarType`. */
export type SeedCarType =
  | "SUV"
  | "SEDAN"
  | "HATCHBACK"
  | "PICKUP"
  | "COUPE"
  | "VAN";

/** Mirrors `CarStatus`. */
export type SeedCarStatus =
  | "AVAILABLE"
  | "BY_APPOINTMENT"
  | "RESERVED"
  | "SOLD"
  | "INACTIVE";

/** Mirrors `FuelType`. */
export type SeedFuelType =
  | "GASOLINE"
  | "DIESEL"
  | "CNG"
  | "HYBRID"
  | "ELECTRIC"
  | "OTHER";

/** Mirrors `Transmission`. */
export type SeedTransmission = "MANUAL" | "AUTOMATIC";

/** Mirrors `Currency`. */
export type SeedCurrency = "ARS" | "USD";

/** Mirrors `LinkTreeCategory`. */
export type SeedLinkTreeCategory = "CONTACT" | "SOCIAL";

export interface SeedUser {
  key: string;
  email: string;
  password: string;
  name: string;
  role: SeedRole;
  isActive: boolean;
}

export interface SeedSeller {
  key: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  isActive: boolean;
}

export interface SeedLinkTreeLink {
  id: string;
  category: SeedLinkTreeCategory;
  label: string;
  href: string;
  iconKey: string;
  sortOrder: number;
  isActive: boolean;
}

export interface SeedCar {
  key: string;
  title: string;
  brand: string;
  model: string;
  version: string;
  year: number;
  color: string;
  kilometers: number;
  type: SeedCarType;
  fuelType: SeedFuelType;
  transmission: SeedTransmission;
  price: number;
  currency: SeedCurrency;
  description: string;
  sellerKey: string | null;
  status: SeedCarStatus;
}

export interface ImageManifestEntry {
  carKey: string;
  files: string[];
}

/**
 * A group of local assets that no catalog entry claims yet. Declaring them
 * turns "this file is unused" from a silent runtime observation into an
 * explicit, reviewable decision.
 */
export interface StagedAssetGroup {
  /**
   * Filename prefix identifying the vehicle, without the trailing separator or
   * the numeric suffix — e.g. `chevrolet_cruze` for `chevrolet_cruze_1.webp`.
   */
  vehicleKey: string;
  /** Human-readable vehicle name, used in the seed report. */
  label: string;
  /** Why these assets are intentionally not used by the current catalog. */
  reason: string;
}

export interface ImageManifest {
  entries: ImageManifestEntry[];
  stagedAssets: StagedAssetGroup[];
}

/**
 * Everything a deployment seeds, as one value.
 *
 * `src/site/seed.ts` exports the active client's set under this shape, and
 * `prisma/seed.ts` reads the data from it and the mechanisms from `./seed/*`. The
 * catalog and the image manifest are shipped together because they are two views
 * of one fact: a vehicle without its photos is a catalogue that silently shows the
 * placeholder.
 */
export interface SeedData {
  users: SeedUser[];
  sellers: SeedSeller[];
  linkTree: SeedLinkTreeLink[];
  cars: SeedCar[];
  imageManifest: ImageManifest;
}
