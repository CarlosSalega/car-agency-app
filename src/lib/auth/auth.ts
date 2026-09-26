import type { User } from "@generated/prisma/client";

import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hashedPassword: string,
): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword);
}

export async function getUserByEmail(email: string): Promise<User | null> {
  return prisma.user.findUnique({
    where: { email },
  });
}

export async function createUser(
  email: string,
  password: string,
  name: string,
  role: "ADMIN" | "COLLABORATOR" = "COLLABORATOR",
) {
  const hashedPassword = await hashPassword(password);
  return prisma.user.create({
    data: {
      email,
      name,
      hashedPassword,
      role,
    },
  });
}

/**
 * Clean up expired sessions from the database
 * Call this periodically (e.g., via cron job)
 */
export async function cleanupExpiredSessions(): Promise<void> {
  await prisma.session.deleteMany({
    where: {
      expires: {
        lt: new Date(),
      },
    },
  });
}
