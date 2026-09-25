import type {
  CarStatus,
  CarType,
  Currency,
  FuelType,
  LinkTreeCategory,
  Role,
  Transmission,
} from "@prisma/client";

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

export interface ImageManifest {
  entries: ImageManifestEntry[];
}

export interface ImageUploadFailure {
  file: string;
  reason: string;
}

export interface ImageSummary {
  matchedFiles: string[];
  unmatchedFiles: string[];
  uploadFailures: ImageUploadFailure[];
  placeholderCars: string[];
}

export interface SeedSummary {
  carsCreated: number;
  brandsCreated: number;
  modelsCreated: number;
  images: ImageSummary;
}
