import type { Car, Brand, Model, User } from "@prisma/client";

export type CarWithRelations = Car & {
  brand: Brand;
  model: Model;
  user: User | null;
};
