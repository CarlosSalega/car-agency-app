import { Prisma, type PrismaClient } from "@generated/prisma/client";

import { MeliRuntimeError } from "./errors";
import {
  parseSnapshot,
  type PublicationEventInput,
  type PublicationPatch,
  type PublicationState,
  type PublicationStore,
  type PublicationView,
} from "./types";

/**
 * The production store behind the publication handlers.
 *
 * Kept apart from the rules for the same reason `category-cache.ts` is apart
 * from `categories.ts`: a test of "a missing attribute never reaches the
 * marketplace" must not build a Prisma client (or demand `DATABASE_URL`) while
 * the module is evaluated.
 *
 * `load` joins the car with its brand and model and the account, because a
 * handler that has to make three reads before deciding anything has failures
 * that are hard to attribute. The select list is explicit: the row also carries
 * nothing sensitive, but a `findUnique` without a projection drifts silently
 * when a column is added.
 */

export function createPrismaPublicationStore(
  prisma: PrismaClient,
): PublicationStore {
  return {
    async load(publicationId): Promise<PublicationView | null> {
      const row = await prisma.publication.findUnique({
        where: { id: publicationId },
        select: {
          id: true,
          carId: true,
          channel: true,
          accountId: true,
          remoteId: true,
          state: true,
          remoteStatus: true,
          remoteSubStatus: true,
          syncedSnapshot: true,
          syncedAt: true,
          lastError: true,
          car: {
            select: {
              id: true,
              title: true,
              year: true,
              version: true,
              price: true,
              currency: true,
              images: true,
              status: true,
              soldAt: true,
              brand: { select: { name: true } },
              model: { select: { name: true } },
            },
          },
          account: { select: { id: true, siteId: true } },
        },
      });

      if (row === null) return null;

      return {
        id: row.id,
        carId: row.carId,
        channel: row.channel,
        accountId: row.accountId,
        remoteId: row.remoteId,
        state: row.state,
        remoteStatus: row.remoteStatus,
        remoteSubStatus: row.remoteSubStatus,
        syncedSnapshot: parseSnapshot(row.syncedSnapshot),
        syncedAt: row.syncedAt,
        lastError: row.lastError,
        car: {
          id: row.car.id,
          title: row.car.title,
          year: row.car.year,
          version: row.car.version,
          price: row.car.price,
          currency: row.car.currency,
          images: row.car.images,
          status: row.car.status,
          soldAt: row.car.soldAt,
          brandName: row.car.brand.name,
          modelName: row.car.model.name,
        },
        account: { id: row.account.id, siteId: row.account.siteId },
      };
    },

    async update(publicationId, patch: PublicationPatch): Promise<void> {
      const data: Prisma.PublicationUncheckedUpdateInput = {};

      if (patch.state !== undefined) data.state = patch.state;
      if (patch.remoteId !== undefined) data.remoteId = patch.remoteId;
      if (patch.remoteStatus !== undefined) {
        data.remoteStatus = patch.remoteStatus;
      }
      if (patch.remoteSubStatus !== undefined) {
        data.remoteSubStatus = patch.remoteSubStatus;
      }
      if (patch.syncedAt !== undefined) data.syncedAt = patch.syncedAt;
      if (patch.lastError !== undefined) data.lastError = patch.lastError;

      if (patch.syncedSnapshot !== undefined) {
        // Clearing a JSON column needs `DbNull`, not `null`: Prisma treats a
        // bare `null` as "leave it alone" and the difference is silent.
        data.syncedSnapshot =
          patch.syncedSnapshot === null
            ? Prisma.DbNull
            : (patch.syncedSnapshot as unknown as Prisma.InputJsonValue);
      }

      await prisma.publication.update({ where: { id: publicationId }, data });
    },

    async appendEvent(
      publicationId: string,
      event: PublicationEventInput,
    ): Promise<void> {
      await prisma.publicationEvent.create({
        data: {
          publicationId,
          kind: event.kind,
          ...(event.payload === undefined
            ? {}
            : { payload: event.payload as unknown as Prisma.InputJsonValue }),
        },
      });
    },
  };
}

/** What the command line needs to know about the row it is about to queue. */
export interface EnsuredPublication {
  readonly id: string;
  readonly state: PublicationState;
  readonly remoteId: string | null;
}

const CHANNEL = "MERCADOLIBRE";

/**
 * The publication of one vehicle on one account, read without writing.
 *
 * Separate from `ensurePrismaPublication` so a dry run can report what it would
 * queue without creating the row it is describing.
 */
export async function findPrismaPublication(
  prisma: PrismaClient,
  { carId, accountId }: { readonly carId: string; readonly accountId: string },
): Promise<EnsuredPublication | null> {
  const row = await prisma.publication.findUnique({
    where: {
      carId_channel_accountId: { carId, channel: CHANNEL, accountId },
    },
    select: { id: true, state: true, remoteId: true },
  });

  return row === null
    ? null
    : { id: row.id, state: row.state, remoteId: row.remoteId };
}

/**
 * The publication row for one vehicle on one account, created on first use.
 *
 * `upsert` on the schema's compound unique key, so two callers cannot create
 * two rows for the same vehicle: the handler's idempotency is only as good as
 * the row it writes to. A missing or deleted vehicle is refused before the
 * upsert, because the foreign key error Prisma would raise names a constraint
 * and not the problem.
 */
export async function ensurePrismaPublication(
  prisma: PrismaClient,
  { carId, accountId }: { readonly carId: string; readonly accountId: string },
): Promise<EnsuredPublication> {
  const car = await prisma.car.findUnique({
    where: { id: carId },
    select: { id: true, deletedAt: true },
  });

  if (car === null) {
    throw new MeliRuntimeError(`No existe un vehículo con id "${carId}".`);
  }

  if (car.deletedAt !== null) {
    throw new MeliRuntimeError(
      `El vehículo "${carId}" está eliminado: restaurálo antes de publicarlo.`,
    );
  }

  const row = await prisma.publication.upsert({
    where: {
      carId_channel_accountId: { carId, channel: CHANNEL, accountId },
    },
    create: { carId, channel: CHANNEL, accountId },
    // An existing row is left exactly as it is: this command queues work, it
    // does not reset the state of a publication that may already be live.
    update: {},
    select: { id: true, state: true, remoteId: true },
  });

  return { id: row.id, state: row.state, remoteId: row.remoteId };
}
