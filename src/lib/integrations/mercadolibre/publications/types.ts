import type { CategoryAttribute, CategoryPrediction } from "../categories";
import type { MeliItemsApi } from "../items";

/**
 * The publication vocabulary, as data.
 *
 * The handlers take every collaborator injected — a store, the item API, the
 * category services, the image URL resolver — so the rules are exercised with a
 * fake and no database or network. Nothing here imports `@/lib/db`: a test of
 * "a missing attribute never reaches the marketplace" must not need a
 * connection string to prove it.
 *
 * `PublicationState` mirrors the Prisma enum one for one. A state the enum does
 * not have is not a state, so the union is spelled out instead of derived from
 * a string.
 */

export type PublicationState =
  | "DRAFT"
  | "PUBLISHING"
  | "PUBLISHED"
  | "OUTDATED"
  | "DIVERGED"
  | "PAUSED"
  | "REMOVED"
  | "FAILED";

/**
 * What we last sent, so "Mercado Libre differs because somebody edited it" can
 * be told apart from "we have not pushed yet" (D1).
 *
 * `status` is the remote status we observed at that sync, not a field we send:
 * the item is created with the category's own status semantics.
 */
export interface PublicationSnapshot {
  readonly price: number;
  readonly title: string;
  readonly status: string | null;
  readonly pictureCount: number;
}

/** The vehicle fields the handlers read. `Car` plus its brand and model names. */
export interface PublicationCar {
  readonly id: string;
  readonly title: string;
  readonly year: number;
  readonly version: string | null;
  readonly price: number;
  readonly currency: string;
  readonly images: readonly string[];
  readonly status: string;
  readonly soldAt: Date | null;
  readonly brandName: string;
  readonly modelName: string;
}

export interface PublicationAccount {
  readonly id: string;
  readonly siteId: string | null;
}

/** One `Publication` row with the rows a handler needs, already joined. */
export interface PublicationView {
  readonly id: string;
  readonly carId: string;
  readonly channel: string;
  readonly accountId: string;
  readonly remoteId: string | null;
  readonly state: PublicationState;
  readonly remoteStatus: string | null;
  readonly remoteSubStatus: string | null;
  readonly syncedSnapshot: PublicationSnapshot | null;
  readonly syncedAt: Date | null;
  readonly lastError: string | null;
  readonly car: PublicationCar;
  readonly account: PublicationAccount;
}

/**
 * A partial write. Every field is optional and an omitted field is not touched,
 * so a handler can update the state without clearing a snapshot it did not
 * compute.
 */
export interface PublicationPatch {
  readonly state?: PublicationState;
  readonly remoteId?: string | null;
  readonly remoteStatus?: string | null;
  readonly remoteSubStatus?: string | null;
  readonly syncedSnapshot?: PublicationSnapshot | null;
  readonly syncedAt?: Date | null;
  readonly lastError?: string | null;
}

/** JSON that fits a `PublicationEvent.payload` column without a codec. */
export type PublicationEventPayload = Readonly<
  Record<string, string | number | boolean | null>
>;

export interface PublicationEventInput {
  /** Short verb-like label: `create`, `sale-close`, `sync-diverged`. */
  readonly kind: string;
  readonly payload?: PublicationEventPayload;
}

/**
 * Storage, narrowed to the four operations the handlers decide.
 *
 * `load` joins the car (with brand and model names) and the account: a handler
 * that has to make three reads before deciding anything is a handler whose
 * failures are hard to attribute.
 */
export interface PublicationStore {
  load(publicationId: string): Promise<PublicationView | null>;
  update(publicationId: string, patch: PublicationPatch): Promise<void>;
  appendEvent(
    publicationId: string,
    event: PublicationEventInput,
  ): Promise<void>;
}

/**
 * The category services, as one port.
 *
 * `site` comes from the linked account because the predictor is per site: an
 * account linked to MLA must not be predicted against MLB.
 */
export interface PublicationCatalog {
  predictCategory(input: {
    readonly title: string;
    readonly site: string | null;
  }): Promise<CategoryPrediction | null>;
  getRequiredAttributes(
    categoryId: string,
  ): Promise<readonly CategoryAttribute[]>;
}

/**
 * The one image size this feature uses.
 *
 * `detail` is 800×600: above Mercado Libre's 500 px minimum and inside its
 * 1920 px maximum. The 1200×1200 `marketplace` variant is T7 and deliberately
 * not added here.
 */
export type PublicationImageVariant = "detail";

/** The marketplace surface of one account, resolved lazily per publication. */
export interface PublicationChannel {
  readonly items: MeliItemsApi;
  readonly catalog: PublicationCatalog;
}

/**
 * Account id → its marketplace surface. A factory instead of one shared client
 * because the access token belongs to the account, and the token manager must
 * see the account it is refreshing.
 */
export type PublicationChannelFactory = (
  accountId: string,
) => PublicationChannel;

export interface PublicationDeps {
  readonly store: PublicationStore;
  readonly channelFor: PublicationChannelFactory;
  readonly resolveImageUrl: (
    key: string,
    variant: PublicationImageVariant,
  ) => string;
}

/** The queue hands a handler its own clock, so `syncedAt` agrees with it. */
export interface PublicationContext {
  readonly now: Date;
}

export type PublicationOutcome =
  | "published"
  | "already-published"
  | "price-updated"
  | "unchanged"
  | "diverged"
  | "sold-closed"
  | "paused"
  | "closed"
  | "synced"
  | "failed";

export interface OperationResult {
  readonly outcome: PublicationOutcome;
  readonly state: PublicationState;
}

export type PublicationRunner = (
  deps: PublicationDeps,
  publicationId: string,
  context: PublicationContext,
) => Promise<OperationResult>;

/**
 * Reads a `syncedSnapshot` column into the shape the handlers expect.
 *
 * The column is `Json` and can hold a payload written by an older version of
 * this code, so an unreadable snapshot is `null` — "we do not know what we
 * sent" — rather than a crash in the middle of a publish.
 */
export function parseSnapshot(value: unknown): PublicationSnapshot | null {
  if (typeof value !== "object" || value === null) return null;

  const record = value as Record<string, unknown>;
  const { price, title, pictureCount, status } = record;

  if (typeof price !== "number" || !Number.isFinite(price)) return null;
  if (typeof title !== "string" || title.trim() === "") return null;
  if (
    typeof pictureCount !== "number" ||
    !Number.isInteger(pictureCount) ||
    pictureCount < 0
  ) {
    return null;
  }
  if (status !== undefined && status !== null && typeof status !== "string") {
    return null;
  }

  return {
    price,
    title,
    status: typeof status === "string" ? status : null,
    pictureCount,
  };
}
