import { beforeEach, describe, expect, it, vi } from "vitest";

const { carMocks, logMocks, visitMocks } = vi.hoisted(() => ({
  carMocks: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
  },
  logMocks: {
    findMany: vi.fn(),
  },
  visitMocks: {
    count: vi.fn(),
  },
}));

vi.mock("next/cache", () => ({
  unstable_cache: (callback: (...args: unknown[]) => unknown) => callback,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    car: carMocks,
    log: logMocks,
    visit: visitMocks,
  },
}));

import {
  buildWhere,
  getAdminCarForEdit,
  getAdminCarStats,
  getAdminCarsCount,
  getAdminCarsList,
  getPublicCarBySlug,
  getPublicCarSlugs,
  getPublicCarsCount,
  getPublicCarsList,
  getPublicLatestCars,
} from "@/lib/queries/cars";

const publicWhere = {
  status: { in: ["AVAILABLE", "BY_APPOINTMENT"] },
  deletedAt: null,
};

describe("buildWhere", () => {
  it("always includes the public visibility predicate", () => {
    expect(buildWhere({})).toEqual(publicWhere);
  });

  it("combines filters with the public visibility predicate", () => {
    expect(
      buildWhere({
        brandId: "brand-1",
        modelId: "model-1",
        type: "SEDAN",
        fuelType: "GASOLINE",
        transmission: "AUTOMATIC",
        minYear: 2020,
        maxYear: 2024,
        minPrice: 10_000,
        maxPrice: 20_000,
        search: "sport",
      }),
    ).toEqual({
      ...publicWhere,
      brandId: "brand-1",
      modelId: "model-1",
      type: "SEDAN",
      fuelType: "GASOLINE",
      transmission: "AUTOMATIC",
      year: { gte: 2020, lte: 2024 },
      price: { gte: 10_000, lte: 20_000 },
      OR: [
        { title: { contains: "sport", mode: "insensitive" } },
        { description: { contains: "sport", mode: "insensitive" } },
        { brand: { name: { contains: "sport", mode: "insensitive" } } },
        { model: { name: { contains: "sport", mode: "insensitive" } } },
      ],
    });
  });
});

describe("public car queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries a public car by slug with findFirst", async () => {
    carMocks.findFirst.mockResolvedValue({ slug: "car-1" });

    await getPublicCarBySlug("car-1");

    expect(carMocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: "car-1", ...publicWhere } }),
    );
  });

  it("queries the public car list with findMany", async () => {
    carMocks.findMany.mockResolvedValue([]);

    await getPublicCarsList({ brandId: "brand-1" }, 0, 12);

    expect(carMocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ...publicWhere, brandId: "brand-1" },
        skip: 0,
        take: 12,
      }),
    );
  });

  it("counts public cars", async () => {
    carMocks.count.mockResolvedValue(7);

    await getPublicCarsCount({});

    expect(carMocks.count).toHaveBeenCalledWith({ where: publicWhere });
  });

  it("queries public car slugs with findMany", async () => {
    carMocks.findMany.mockResolvedValue([]);

    await getPublicCarSlugs();

    expect(carMocks.findMany).toHaveBeenCalledWith({
      where: publicWhere,
      select: { slug: true },
    });
  });

  it("queries public latest cars with findMany", async () => {
    carMocks.findMany.mockResolvedValue([]);

    await getPublicLatestCars(4);

    expect(carMocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: publicWhere, take: 4 }),
    );
  });
});

describe("admin car queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries the admin car list with pagination and relations", async () => {
    carMocks.findMany.mockResolvedValue([]);

    await getAdminCarsList(12, 12);

    expect(carMocks.findMany).toHaveBeenCalledWith({
      where: { deletedAt: null },
      include: {
        brand: true,
        model: true,
        user: true,
      },
      orderBy: { createdAt: "desc" },
      skip: 12,
      take: 12,
    });
  });

  it("counts non-deleted admin cars", async () => {
    carMocks.count.mockResolvedValue(7);

    await expect(getAdminCarsCount()).resolves.toBe(7);

    expect(carMocks.count).toHaveBeenCalledWith({
      where: { deletedAt: null },
    });
  });

  it("queries a car for admin edit without filtering soft-deleted cars", async () => {
    const car = { id: "car-1" };
    carMocks.findUnique.mockResolvedValue(car);

    await expect(getAdminCarForEdit("car-1")).resolves.toBe(car);

    expect(carMocks.findUnique).toHaveBeenCalledWith({
      where: { id: "car-1" },
      include: {
        brand: true,
        model: true,
        seller: true,
      },
    });
  });

  it("returns the existing admin dashboard counts and recent logs", async () => {
    const recentLogs = [{ id: "log-1" }];
    carMocks.count
      .mockResolvedValueOnce(30)
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(7)
      .mockResolvedValueOnce(8);
    visitMocks.count.mockResolvedValue(100);
    logMocks.findMany.mockResolvedValue(recentLogs);

    await expect(getAdminCarStats()).resolves.toEqual({
      totalCars: 30,
      availableCars: 10,
      byAppointmentCars: 5,
      reservedCars: 7,
      soldCars: 8,
      totalVisits: 100,
      recentLogs,
    });

    expect(carMocks.count).toHaveBeenNthCalledWith(1, {
      where: { deletedAt: null },
    });
    expect(carMocks.count).toHaveBeenNthCalledWith(2, {
      where: { status: "AVAILABLE", deletedAt: null },
    });
    expect(carMocks.count).toHaveBeenNthCalledWith(3, {
      where: { status: "BY_APPOINTMENT", deletedAt: null },
    });
    expect(carMocks.count).toHaveBeenNthCalledWith(4, {
      where: { status: "RESERVED", deletedAt: null },
    });
    expect(carMocks.count).toHaveBeenNthCalledWith(5, {
      where: { status: "SOLD", deletedAt: null },
    });
    expect(visitMocks.count).toHaveBeenCalledWith();
    expect(logMocks.findMany).toHaveBeenCalledWith({
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
  });
});
