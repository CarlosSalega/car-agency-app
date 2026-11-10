import { vi, type Mock } from "vitest";

import type { CategoryAttribute, CategoryPrediction } from "../../categories";
import type { MeliItem, MeliItemsApi } from "../../items";
import type {
  PublicationAccount,
  PublicationCar,
  PublicationCatalog,
  PublicationDeps,
  PublicationEventPayload,
  PublicationPatch,
  PublicationStore,
  PublicationView,
} from "../types";

/**
 * Injected doubles for the publication handlers.
 *
 * No database and no network: the item API and the catalog are `vi.fn`s, the
 * store is an in-memory row, and the image resolver is a pure function. The
 * interesting rules of T8 are "did this call happen at all", which a fake
 * answers exactly.
 */

export const PUBLICATION_ID = "pub-1";
export const ACCOUNT_ID = "account-1";
export const NOW = new Date("2026-03-10T12:00:00.000Z");

export function publicationCar(
  overrides: Partial<PublicationCar> = {},
): PublicationCar {
  return {
    id: "car-1",
    title: "Volkswagen Gol 1.6 Comfortline",
    year: 2018,
    version: "1.6 Comfortline",
    price: 12_500_000,
    currency: "ARS",
    images: ["cars/gol-front", "cars/gol-back"],
    status: "AVAILABLE",
    soldAt: null,
    brandName: "Volkswagen",
    modelName: "Gol",
    ...overrides,
  };
}

interface ViewOverrides extends Omit<
  Partial<PublicationView>,
  "car" | "account"
> {
  readonly car?: Partial<PublicationCar>;
  readonly account?: Partial<PublicationAccount>;
}

export function publicationView(
  overrides: ViewOverrides = {},
): PublicationView {
  const { car, account, ...rest } = overrides;

  return {
    id: PUBLICATION_ID,
    carId: "car-1",
    channel: "MERCADOLIBRE",
    accountId: ACCOUNT_ID,
    remoteId: null,
    state: "DRAFT",
    remoteStatus: null,
    remoteSubStatus: null,
    syncedSnapshot: null,
    syncedAt: null,
    lastError: null,
    car: publicationCar(car),
    account: { id: ACCOUNT_ID, siteId: "MLA", ...account },
    ...rest,
  };
}

/** A publication that was already created on the marketplace. */
export function publishedView(overrides: ViewOverrides = {}): PublicationView {
  const view = publicationView(overrides);

  return {
    ...view,
    remoteId: view.remoteId ?? "MLA100",
    state: overrides.state ?? "PUBLISHED",
    remoteStatus: view.remoteStatus ?? "active",
    syncedSnapshot: view.syncedSnapshot ?? {
      price: view.car.price,
      title: view.car.title,
      status: "active",
      pictureCount: 2,
    },
    syncedAt: view.syncedAt ?? new Date("2026-03-01T10:00:00.000Z"),
  };
}

export interface RecordedEvent {
  readonly publicationId: string;
  readonly kind: string;
  readonly payload: PublicationEventPayload | undefined;
}

export interface FakePublicationStore {
  readonly store: PublicationStore;
  readonly updates: ReadonlyArray<{
    readonly publicationId: string;
    readonly patch: PublicationPatch;
  }>;
  readonly events: readonly RecordedEvent[];
  view(): PublicationView;
}

export function createFakePublicationStore(
  seed: PublicationView = publicationView(),
): FakePublicationStore {
  let current = seed;
  const updates: Array<{
    readonly publicationId: string;
    readonly patch: PublicationPatch;
  }> = [];
  const events: RecordedEvent[] = [];

  const store: PublicationStore = {
    async load(publicationId) {
      return publicationId === current.id ? current : null;
    },

    async update(publicationId, patch) {
      if (publicationId !== current.id) {
        throw new Error(
          `The test updated the wrong publication: ${publicationId}`,
        );
      }

      updates.push({ publicationId, patch });
      current = { ...current, ...patch };
    },

    async appendEvent(publicationId, event) {
      events.push({
        publicationId,
        kind: event.kind,
        payload: event.payload,
      });
    },
  };

  return {
    store,
    updates,
    events,
    view: () => current,
  };
}

export interface HarnessOptions {
  readonly view?: PublicationView;
  readonly item?: Partial<MeliItem>;
  readonly requiredAttributes?: readonly CategoryAttribute[];
  readonly prediction?: CategoryPrediction | null;
  readonly imageUrl?: (key: string, variant: "detail") => string;
}

export interface TestHarness {
  readonly deps: PublicationDeps;
  readonly publicationStore: FakePublicationStore;
  readonly items: {
    readonly createItem: Mock<MeliItemsApi["createItem"]>;
    readonly updateItem: Mock<MeliItemsApi["updateItem"]>;
    readonly getItem: Mock<MeliItemsApi["getItem"]>;
  };
  readonly catalog: {
    readonly predictCategory: Mock<PublicationCatalog["predictCategory"]>;
    readonly getRequiredAttributes: Mock<
      PublicationCatalog["getRequiredAttributes"]
    >;
  };
  readonly resolveImageUrl: Mock<(key: string, variant: "detail") => string>;
}

const DEFAULT_ATTRIBUTES: readonly CategoryAttribute[] = [
  { id: "BRAND", name: "Marca", valueType: "string" },
  { id: "MODEL", name: "Modelo", valueType: "string" },
  { id: "TRIM", name: "Versión", valueType: "string" },
  { id: "VEHICLE_YEAR", name: "Año", valueType: "number" },
];

export function createHarness(options: HarnessOptions = {}): TestHarness {
  const view = options.view ?? publicationView();
  const publicationStore = createFakePublicationStore(view);

  const remote: MeliItem = {
    id: "MLA100",
    status: "active",
    subStatus: null,
    price: view.car.price,
    permalink: "https://articulo.mercadolibre.com.ar/MLA-100",
    ...options.item,
  };

  const items: TestHarness["items"] = {
    createItem: vi.fn<MeliItemsApi["createItem"]>(async (draft) => ({
      ...remote,
      price: draft.price,
    })),
    updateItem: vi.fn<MeliItemsApi["updateItem"]>(async (remoteId, patch) => ({
      ...remote,
      id: remoteId,
      status: patch.status ?? remote.status,
      price: patch.price ?? remote.price,
    })),
    getItem: vi.fn<MeliItemsApi["getItem"]>(async () => remote),
  };

  const catalog: TestHarness["catalog"] = {
    predictCategory: vi.fn<PublicationCatalog["predictCategory"]>(async () =>
      options.prediction === undefined
        ? {
            categoryId: "MLA1744",
            categoryName: "Autos y Camionetas",
            domainId: "MLA-CARS_AND_TRUCKS",
          }
        : options.prediction,
    ),
    getRequiredAttributes: vi.fn<PublicationCatalog["getRequiredAttributes"]>(
      async () => options.requiredAttributes ?? DEFAULT_ATTRIBUTES,
    ),
  };

  const resolveImageUrl = vi.fn<(key: string, variant: "detail") => string>(
    options.imageUrl ??
      ((key) => `https://cdn.example.com/w_800,h_600/${key}.jpg`),
  );

  return {
    deps: {
      store: publicationStore.store,
      channelFor: vi.fn(() => ({ items, catalog })),
      resolveImageUrl,
    },
    publicationStore,
    items,
    catalog,
    resolveImageUrl,
  };
}
