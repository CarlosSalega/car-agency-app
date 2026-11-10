import type { MeliAttribute } from "./attributes";
import type { MeliClient } from "./client";

/**
 * The Mercado Libre item surface, and nothing else.
 *
 * Thin on purpose: no retries (the queue owns them), no state decisions (the
 * publication handlers own those) and no interpretation of an error (the client
 * already turns `429` into `RateLimitedError`). These wrappers exist so a
 * handler never spells an endpoint or reads an unvalidated field.
 *
 * The response is narrowed to the fields this feature reads. Keeping the whole
 * marketplace resource would let it leak into storage and turn a field ML
 * renames into a crash two layers away.
 */

/** A Mercado Libre item, narrowed. */
export interface MeliItem {
  readonly id: string;
  readonly status: string | null;
  /** Verbatim: `picture downloading pending` is transient and not a failure. */
  readonly subStatus: string | null;
  readonly price: number | null;
  readonly permalink: string | null;
}

export interface MeliItemDraft {
  readonly title: string;
  readonly categoryId: string;
  readonly price: number;
  readonly currencyId: string;
  /** Public URLs; ML fetches them. The `source` form is the documented one. */
  readonly pictureUrls: readonly string[];
  readonly attributes: readonly MeliAttribute[];
}

/** The only remote fields this feature writes. */
export interface MeliItemUpdate {
  readonly status?: "active" | "paused" | "closed";
  readonly price?: number;
}

export interface MeliItemsApi {
  createItem(draft: MeliItemDraft): Promise<MeliItem>;
  updateItem(remoteId: string, patch: MeliItemUpdate): Promise<MeliItem>;
  getItem(remoteId: string): Promise<MeliItem>;
}

/**
 * The exact body of `POST /items`.
 *
 * Only fields the verified documentation pins are sent:
 *
 * | Field           | Why                                                 |
 * | --------------- | --------------------------------------------------- |
 * | `title`         | the vehicle title we own                            |
 * | `category_id`   | from the runtime predictor (T6)                     |
 * | `price`         | our price                                           |
 * | `currency_id`   | our currency                                        |
 * | `pictures`      | `pictures[].source` with public URLs is documented   |
 * | `attributes`    | the required set the category itself declares        |
 *
 * Deliberately absent, because the documentation does not pin them for a used
 * vehicle: `condition`, `listing_type_id`, `buying_mode`, `available_quantity`,
 * `sale_terms` (mandatory only for reconditioned items) and `description`
 * (its endpoint is a separate resource). Inventing values for them would turn
 * an honest `400` into a wrong listing.
 */
export function buildItemPayload(
  draft: MeliItemDraft,
): Record<string, unknown> {
  return {
    title: draft.title,
    category_id: draft.categoryId,
    price: draft.price,
    currency_id: draft.currencyId,
    pictures: draft.pictureUrls.map((source) => ({ source })),
    attributes: draft.attributes.map(({ id, value_name }) => ({
      id,
      value_name,
    })),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Narrows the marketplace response.
 *
 * `fallbackId` is for writes: we already know the item id we addressed, and a
 * `PUT` that answers with a partial resource is a success, not a missing id.
 * A creation without an id is unambiguously broken and throws.
 */
function narrowItem(payload: unknown, fallbackId: string | null): MeliItem {
  const record = isRecord(payload) ? payload : {};

  const id =
    typeof record.id === "string" && record.id !== "" ? record.id : fallbackId;

  if (id === null) {
    throw new Error(
      "Mercado Libre answered the item creation without an item id.",
    );
  }

  return {
    id,
    status: typeof record.status === "string" ? record.status : null,
    subStatus: typeof record.sub_status === "string" ? record.sub_status : null,
    price: typeof record.price === "number" ? record.price : null,
    permalink: typeof record.permalink === "string" ? record.permalink : null,
  };
}

export function createMeliItemsApi(client: MeliClient): MeliItemsApi {
  return {
    async createItem(draft) {
      const payload = await client.post<unknown>(
        "/items",
        buildItemPayload(draft),
      );

      return narrowItem(payload, null);
    },

    async updateItem(remoteId, patch) {
      const payload = await client.put<unknown>(
        `/items/${encodeURIComponent(remoteId)}`,
        patch,
      );

      return narrowItem(payload, remoteId);
    },

    async getItem(remoteId) {
      const payload = await client.get<unknown>(
        `/items/${encodeURIComponent(remoteId)}`,
      );

      return narrowItem(payload, remoteId);
    },
  };
}
