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
};

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
          orderBy: { createdAt: "desc" },
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
          select: { slug: true },
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

export async function getAdminCarsList(skip: number, take: number) {
  return prisma.car.findMany({
    where: { deletedAt: null },
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
    orderBy: { createdAt: "desc" },
    skip,
    take,
  });
}

export async function getAdminCarsCount() {
  return prisma.car.count({
    where: { deletedAt: null },
  });
}

export async function getAdminCarForEdit(id: string) {
  return prisma.car.findUnique({
    where: { id },
    include: {
      brand: true,
      model: true,
      seller: true,
    },
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
