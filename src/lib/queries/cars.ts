import { unstable_cache } from "next/cache";
import type {
  CarType,
  FuelType,
  Prisma,
  Transmission,
} from "@generated/prisma/client";
import { prisma } from "@/lib/db";
import { prismaSafe } from "@/lib/prisma-safe";
import { stableStringify, CACHE_REVALIDATE, CACHE_TAGS } from "@/lib/cache";

export type CarListFilters = {
  brandId?: string;
  modelId?: string;
  type?: string;
  fuelType?: string;
  transmission?: string;
  minYear?: number;
  maxYear?: number;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  /** Display order. Absent means newest first, which is the catalog's default. */
  sort?: string;
};

/**
 * The order the visitor picked, mapped to Prisma.
 *
 * An unknown value falls back to newest first instead of throwing: a hand-typed
 * `?sort=loquesea` is a URL, not an error page. Every tie breaks by newest, so the
 * list is stable across requests (and the cache key already includes `sort`).
 */
function buildOrderBy(sort?: string): Prisma.CarOrderByWithRelationInput[] {
  switch (sort) {
    case "precio-asc":
      return [{ price: "asc" }, { createdAt: "desc" }];
    case "precio-desc":
      return [{ price: "desc" }, { createdAt: "desc" }];
    case "km-asc":
      return [{ kilometers: "asc" }, { createdAt: "desc" }];
    default:
      return [{ createdAt: "desc" }];
  }
}

export function buildWhere(filters: CarListFilters): Prisma.CarWhereInput {
  const where: Prisma.CarWhereInput = {
    status: { in: ["AVAILABLE", "BY_APPOINTMENT"] },
    deletedAt: null,
  };

  if (filters.brandId) where.brandId = filters.brandId;
  if (filters.modelId) where.modelId = filters.modelId;
  if (filters.type) where.type = filters.type as CarType;
  if (filters.fuelType) where.fuelType = filters.fuelType as FuelType;
  if (filters.transmission)
    where.transmission = filters.transmission as Transmission;
  if (filters.minYear != null || filters.maxYear != null) {
    where.year = {};
    if (filters.minYear != null) where.year.gte = filters.minYear;
    if (filters.maxYear != null) where.year.lte = filters.maxYear;
  }
  if (filters.minPrice != null || filters.maxPrice != null) {
    where.price = {};
    if (filters.minPrice != null) where.price.gte = filters.minPrice;
    if (filters.maxPrice != null) where.price.lte = filters.maxPrice;
  }
  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: "insensitive" } },
      { description: { contains: filters.search, mode: "insensitive" } },
      { brand: { name: { contains: filters.search, mode: "insensitive" } } },
      { model: { name: { contains: filters.search, mode: "insensitive" } } },
    ];
  }

  return where;
}

export async function getPublicCarsList(
  filters: CarListFilters,
  skip: number,
  take: number,
) {
  const filtersKey = stableStringify(filters);

  return unstable_cache(
    async (f: CarListFilters, s: number, t: number) =>
      prismaSafe(() =>
        prisma.car.findMany({
          where: buildWhere(f),
          include: { brand: true, model: true },
          orderBy: buildOrderBy(f.sort),
          skip: s,
          take: t,
        }),
      ),
    [CACHE_TAGS.CARS, "cars-list", filtersKey, String(skip), String(take)],
    {
      tags: [CACHE_TAGS.CARS],
      revalidate: CACHE_REVALIDATE.CARS_LIST,
    },
  )(filters, skip, take);
}

export async function getPublicCarsCount(filters: CarListFilters) {
  const filtersKey = stableStringify(filters);

  return unstable_cache(
    async (f: CarListFilters) =>
      prismaSafe(() => prisma.car.count({ where: buildWhere(f) })),
    [CACHE_TAGS.CARS, "cars-count", filtersKey],
    {
      tags: [CACHE_TAGS.CARS],
      revalidate: CACHE_REVALIDATE.CARS_LIST,
    },
  )(filters);
}

export async function getPublicCarBySlug(slug: string) {
  return unstable_cache(
    async (s: string) =>
      prismaSafe(() =>
        prisma.car.findFirst({
          where: {
            slug: s,
            status: { in: ["AVAILABLE", "BY_APPOINTMENT"] },
            deletedAt: null,
          },
          include: {
            brand: true,
            model: true,
            seller: true,
          },
        }),
      ),
    [CACHE_TAGS.CARS, "car-by-slug", slug],
    { tags: [CACHE_TAGS.CARS], revalidate: CACHE_REVALIDATE.CAR_DETAIL },
  )(slug);
}

export async function getPublicCarSlugs() {
  return unstable_cache(
    async () =>
      prismaSafe(() =>
        prisma.car.findMany({
          where: {
            status: { in: ["AVAILABLE", "BY_APPOINTMENT"] },
            deletedAt: null,
          },
          // `updatedAt` feeds the sitemap: one shared `new Date()` for every URL
          // tells Google "everything changed now" on every build, which is how a
          // sitemap teaches a crawler to ignore its lastModified.
          select: { slug: true, updatedAt: true },
        }),
      ),
    [CACHE_TAGS.CARS, "car-slugs"],
    { tags: [CACHE_TAGS.CARS], revalidate: CACHE_REVALIDATE.CAR_DETAIL },
  )();
}

export async function getPublicLatestCars(take: number) {
  return unstable_cache(
    async (t: number) =>
      prismaSafe(() =>
        prisma.car.findMany({
          where: {
            status: { in: ["AVAILABLE", "BY_APPOINTMENT"] },
            deletedAt: null,
          },
          include: { brand: true, model: true },
          orderBy: { createdAt: "desc" },
          take: t,
        }),
      ),
    [CACHE_TAGS.CARS, "latest-cars", String(take)],
    { tags: [CACHE_TAGS.CARS], revalidate: CACHE_REVALIDATE.CARS_LIST },
  )(take);
}

/**
 * The single source of truth for the admin car listing. The query below spreads
 * this object, and `CarListItem` in `src/types/cars.ts` is derived from it with
 * `CarGetPayload<typeof adminCarsListArgs>`, so the type cannot drift away from
 * the query that actually runs.
 */
export const adminCarsListArgs = {
  include: {
    brand: true,
    model: true,
    user: {
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    },
  },
} satisfies Prisma.CarDefaultArgs;

export async function getAdminCarsList(skip: number, take: number) {
  return prisma.car.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    skip,
    take,
    ...adminCarsListArgs,
  });
}

export async function getAdminCarsCount() {
  return prisma.car.count({
    where: { deletedAt: null },
  });
}

/**
 * The single source of truth for the admin car edit form. `seller` is
 * deliberately absent: nothing reads it, and the form is a client component, so
 * including it would serialize seller PII to the browser.
 */
export const adminCarForEditArgs = {
  include: {
    brand: true,
    model: true,
  },
} satisfies Prisma.CarDefaultArgs;

export async function getAdminCarForEdit(id: string) {
  return prisma.car.findUnique({
    where: { id },
    ...adminCarForEditArgs,
  });
}

export async function getAdminCarStats() {
  const [
    totalCars,
    availableCars,
    byAppointmentCars,
    reservedCars,
    soldCars,
    totalVisits,
  ] = await Promise.all([
    prisma.car.count({ where: { deletedAt: null } }),
    prisma.car.count({
      where: { status: "AVAILABLE", deletedAt: null },
    }),
    prisma.car.count({
      where: { status: "BY_APPOINTMENT", deletedAt: null },
    }),
    prisma.car.count({
      where: { status: "RESERVED", deletedAt: null },
    }),
    prisma.car.count({ where: { status: "SOLD", deletedAt: null } }),
    prisma.visit.count(),
  ]);

  return {
    totalCars,
    availableCars,
    byAppointmentCars,
    reservedCars,
    soldCars,
    totalVisits,
  };
}

export const getCarsList = getPublicCarsList;
export const getCarsCount = getPublicCarsCount;
export const getCarBySlug = getPublicCarBySlug;
export const getCarSlugs = getPublicCarSlugs;
export const getLatestCars = getPublicLatestCars;
