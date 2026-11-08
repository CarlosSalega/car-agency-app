import type { Logger } from "image-uploads";
import { createBetterAuthActorResolver } from "image-uploads/better-auth";
import { createUploadHandler } from "image-uploads/next";

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { imageProvider } from "@/lib/images/provider";

/**
 * The module defaults to a silent logger; this route has always logged what it
 * refused and what it failed, and an operator reads those lines in the runtime
 * logs. `console` only — no logging dependency, and no user-facing copy here:
 * the messages and contexts are the module's.
 */
const logger: Logger = {
  warn: (message, context) => console.warn(message, context),
  error: (message, context) => console.error(message, context),
};

/**
 * `/api/upload` — POST stores one image, DELETE removes one.
 *
 * The pipeline order is the module's: authenticate (401) → validate the file
 * (400/413) → authorize the delete (403) → provider. This file owns only the
 * three app-specific inputs: who the actor is, which file is acceptable, and
 * whether the actor owns the key.
 *
 * `getSession` already returns `null` for a deactivated account and for an
 * expired session, so the actor resolver inherits both semantics unchanged.
 */
const { POST, DELETE } = createUploadHandler({
  provider: imageProvider,

  logger,

  getActor: createBetterAuthActorResolver({ getSession: () => getSession() }),

  validate: { maxBytes: 15 * 1024 * 1024, mimePrefixes: ["image/"] },

  /**
   * Ownership is `Car.images`, unchanged: a key no car lists is nobody's, a key
   * listed by the actor's own car (or by any car, for an ADMIN) is fair game,
   * and anything else belongs to another seller.
   *
   * The module maps `NOT_OWNED` and `OTHER_OWNER` onto the two Spanish 403
   * bodies this route has always returned.
   */
  authorizeDelete: async ({ key, actor }) => {
    const carsWithImage = await prisma.car.findMany({
      where: {
        images: {
          has: key,
        },
      },
      select: { userId: true },
    });

    if (carsWithImage.length === 0) {
      return { allowed: false, reason: "NOT_OWNED" };
    }

    const hasPermission =
      actor.role === "ADMIN" ||
      carsWithImage.some((car) => car.userId === actor.id);

    return hasPermission
      ? { allowed: true }
      : { allowed: false, reason: "OTHER_OWNER" };
  },
});

export { POST, DELETE };
