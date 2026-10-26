import type { Role } from "@generated/prisma/client";

export type UserWithCount = {
  id: string;
  name: string | null;
  email: string;
  emailVerified: boolean;
  role: Role;
  isActive: boolean;
  createdAt: Date;
  _count: {
    cars: number;
  };
};
