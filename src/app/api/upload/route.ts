import type { Logger } from "@/modules/image-uploads";
import { createBetterAuthActorResolver } from "@/modules/image-uploads/adapters/better-auth";
import { createUploadHandler } from "@/modules/image-uploads/next";

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAuthorizeDelete } from "@/lib/images/authorize-delete";
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
const authorizeDelete = createAuthorizeDelete({
  findCarsUsingKey: (key) =>
    prisma.car.findMany({
      where: { images: { has: key } },
      select: { userId: true },
    }),

  findUploadByKey: (key) =>
    prisma.imageUpload.findUnique({
      where: { key },
      select: { userId: true },
    }),
});

const { POST, DELETE } = createUploadHandler({
  provider: imageProvider,

  logger,

  getActor: createBetterAuthActorResolver({ getSession: () => getSession() }),

  validate: { maxBytes: 15 * 1024 * 1024, mimePrefixes: ["image/"] },

  /**
   * A key listed by a car is authorised by that car: the actor's own car, or
   * any car for an ADMIN. A key no car lists falls back to the upload record,
   * so the uploader can clean up an image that was never attached. The record
   * is never consulted while a car uses the key.
   *
   * The module maps `NOT_OWNED` and `OTHER_OWNER` onto the two Spanish 403
   * bodies this route has always returned.
   */
  authorizeDelete,

  /**
   * The asset already exists once the provider answers, so a failed write must
   * not turn the answer into a 500: the client would retry an upload that did
   * land and leave an orphan nobody can trace. `upsert` keeps a repeated key
   * from throwing.
   */
  onUploaded: async ({ actor, result }) => {
    await prisma.imageUpload.upsert({
      where: { key: result.key },
      create: { key: result.key, userId: actor.id },
      update: { userId: actor.id },
    });
  },

  /** `deleteMany` so a key with no record is a no-op instead of a throw. */
  onDeleted: async ({ key }) => {
    await prisma.imageUpload.deleteMany({ where: { key } });
  },
});

export { POST, DELETE };
