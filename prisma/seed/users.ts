import { Role } from "@prisma/client";
import type { SeedUser } from "./types";

export const seedUsers: SeedUser[] = [
  {
    key: "admin",
    email: "facundo@Car Agency Appautomotores.com",
    password: "admin123",
    name: "Administrador",
    role: Role.ADMIN,
    isActive: true,
  },
];
