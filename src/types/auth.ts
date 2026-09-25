import { Role } from "@prisma/client";

export interface AuthUser {
  name: string | null;
  email: string;
  role: Role;
}
