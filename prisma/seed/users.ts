import { Role } from "@generated/prisma/client";
import type { SeedUser } from "./types";

export const seedUsers: SeedUser[] = [
  {
    key: "admin",
    email: "admin@caragency.com",
    password: "admin1234",
    name: "Administrador",
    role: Role.ADMIN,
    isActive: true,
  },
];
