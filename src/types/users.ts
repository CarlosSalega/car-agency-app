import type { Role } from "@prisma/client";

export type UserWithCount = {
  id: string;
  name: string | null;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
  _count: {
    cars: number;
  };
};
