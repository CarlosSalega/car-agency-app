import type { Car, Brand, Model, User } from "@generated/prisma/client";

export type CarWithRelations = Car & {
  brand: Brand;
  model: Model;
  user: User | null;
};
