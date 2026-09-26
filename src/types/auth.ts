import type { Role } from "@generated/prisma/enums";

export interface AuthUser {
  name: string | null;
  email: string;
  role: Role;
}
