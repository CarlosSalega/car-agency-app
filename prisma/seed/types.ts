import type {
  CarStatus,
  CarType,
  Currency,
  FuelType,
  LinkTreeCategory,
  Role,
  Transmission,
} from "@generated/prisma/client";

export interface SeedUser {
  key: string;
  email: string;
  password: string;
  name: string;
  role: Role;
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
  category: LinkTreeCategory;
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
  type: CarType;
  fuelType: FuelType;
  transmission: Transmission;
  price: number;
  currency: Currency;
  description: string;
  sellerKey: string | null;
  status: CarStatus;
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
