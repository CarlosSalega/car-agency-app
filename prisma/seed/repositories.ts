import crypto from "node:crypto";
import type { PrismaClient } from "@generated/prisma/client";
import { hashPassword } from "better-auth/crypto";
import { brands } from "@/data/brands";
import { modelsByBrand } from "@/data/modelsByBrand";
import type { SeedCar, SeedLinkTreeLink, SeedSeller, SeedUser } from "./types";

export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.review.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.visit.deleteMany();
  await prisma.log.deleteMany();
  await prisma.car.deleteMany();
  await prisma.seller.deleteMany();
  await prisma.model.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.linkTreeLink.deleteMany();
  await prisma.settings.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.verification.deleteMany();
  await prisma.user.deleteMany();
}

export async function createUser(prisma: PrismaClient, user: SeedUser) {
  // better-auth verifies against `Account.password`, not a `User` column, and
  // requires `accountId` to equal the user id. Hashing with
  // `better-auth/crypto` keeps the seed on the exact scrypt implementation the
  // sign-in endpoint verifies with -- no second hasher to drift out of sync.
  const id = crypto.randomUUID();
  const password = await hashPassword(user.password);

  return prisma.user.create({
    data: {
      id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      accounts: {
        create: {
          accountId: id,
          providerId: "credential",
          password,
        },
      },
    },
  });
}

export async function createLinkTreeLinks(
  prisma: PrismaClient,
  links: SeedLinkTreeLink[],
) {
  await prisma.linkTreeLink.createMany({ data: links });
}

export async function createSeller(
  prisma: PrismaClient,
  seller: SeedSeller,
  createdById: string,
) {
  return prisma.seller.create({
    data: {
      firstName: seller.firstName,
      lastName: seller.lastName,
      phone: seller.phone,
      email: seller.email,
      isActive: seller.isActive,
      createdById,
    },
  });
}

export interface BrandModelIds {
  brandMap: Record<string, string>;
  modelMap: Record<string, string>;
}

export async function createBrandsAndModels(
  prisma: PrismaClient,
  createdById: string,
): Promise<BrandModelIds> {
  const brandMap: Record<string, string> = {};
  const modelMap: Record<string, string> = {};
  const brandRecords = [...new Set(brands)].map((name) => ({
    id: crypto.randomUUID(),
    name,
    createdById,
  }));

  await prisma.brand.createMany({ data: brandRecords });
  for (const brand of brandRecords) {
    brandMap[brand.name] = brand.id;
  }

  const modelRecords = brandRecords.flatMap((brand) =>
    [
      ...new Set(modelsByBrand[brand.name as keyof typeof modelsByBrand] ?? []),
    ].map((name) => ({
      key: `${brand.name}-${name}`,
      data: {
        id: crypto.randomUUID(),
        name,
        brandId: brand.id,
        createdById,
      },
    })),
  );

  await prisma.model.createMany({
    data: modelRecords.map((record) => record.data),
  });
  for (const record of modelRecords) {
    modelMap[record.key] = record.data.id;
  }

  return { brandMap, modelMap };
}

export async function createCar(
  prisma: PrismaClient,
  car: SeedCar,
  relations: {
    brandId: string;
    modelId: string;
    sellerId: string | null;
    userId: string;
  },
  images: string[],
  slug: string,
) {
  return prisma.car.create({
    data: {
      title: car.title,
      slug,
      brandId: relations.brandId,
      modelId: relations.modelId,
      sellerId: relations.sellerId,
      version: car.version,
      year: car.year,
      color: car.color,
      kilometers: car.kilometers,
      type: car.type,
      fuelType: car.fuelType,
      transmission: car.transmission,
      price: car.price,
      currency: car.currency,
      description: car.description,
      images,
      status: car.status,
      userId: relations.userId,
    },
  });
}

/**
 * Demo inquiries. `createMany` because there are a few hundred and none of them
 * needs a round trip of its own.
 */
export async function createLeads(
  prisma: PrismaClient,
  leads: {
    name: string;
    phone: string;
    email: string | null;
    message: string | null;
    status: string;
    source: string | null;
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
    referrer: string | null;
    consentAt: Date | null;
    notes: string | null;
    carId: string | null;
    sellerId: string | null;
    createdAt: Date;
  }[],
) {
  return prisma.lead.createMany({ data: leads as never });
}
