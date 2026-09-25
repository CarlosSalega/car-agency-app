import slugify from "slugify";
import { prisma } from "@/lib/db";

export function generateSlugBase(
  brand: string,
  model: string,
  version: string,
  year: number,
  km: number,
) {
  return slugify(`${brand} ${model} ${version} ${year} ${km}`, {
    lower: true,
    strict: true,
  });
}

export async function generateUniqueSlug(base: string) {
  let slug = base;

  while (await prisma.car.findFirst({ where: { slug } })) {
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }

  return slug;
}
