import type { Car, Brand, Model, Role } from "@generated/prisma/client";

export type CarWithRelations = Car & {
  brand: Brand;
  model: Model;
  user: {
    id: string;
    name: string | null;
    email: string;
    role: Role;
  } | null;
};
