import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

import { prisma } from "@/lib/db";

/**
 * The single better-auth instance.
 *
 * Two deliberate choices worth naming:
 *
 * 1. `session.expiresIn` is one hour, matching the hand-rolled session it
 *    replaces. The 56 call sites read `session.expires` and assume that window.
 * 2. Inactive accounts are blocked in a `databaseHooks.session.create.before`
 *    hook instead of at the login endpoint. better-auth has no notion of
 *    `isActive`, so without this an admin-disabled user could still obtain a
 *    session; aborting session creation keeps the old guarantee that a
 *    deactivated account cannot stay signed in.
 */
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
    // `admin1234` is 9 characters, so a minimum of 10 would make the seeded
    // admin uncreatable. 8 is better-auth's default and still stricter than
    // the 6 the project enforced before.
    minPasswordLength: 8,
  },
  session: {
    expiresIn: 60 * 60,
    updateAge: 60 * 5,
  },
  user: {
    additionalFields: {
      // Server-owned: `input: false` keeps a client from setting its own role
      // or reactivating itself through the sign-up payload.
      role: {
        type: "string",
        required: false,
        defaultValue: "COLLABORATOR",
        input: false,
      },
      isActive: {
        type: "boolean",
        required: false,
        defaultValue: true,
        input: false,
      },
    },
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { isActive: true },
          });

          if (!user?.isActive) return false;

          return { data: session };
        },
      },
    },
  },
  advanced: {
    database: {
      // The schema declares `@default(uuid())`; let better-auth produce the
      // same shape instead of its shorter default identifier.
      generateId: () => crypto.randomUUID(),
    },
  },
});
