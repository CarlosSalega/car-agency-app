import { describe, expect, it } from "vitest";

import { createMeliClient, type MeliClient } from "../client";
import {
  CATEGORY_ATTRIBUTE_TTL_MS,
  getCategoryAttributes,
  getRequiredAttributes,
  predictCategory,
  type CategoryAttribute,
  type CategoryAttributeCacheStore,
} from "../categories";
import { fakeFetch, fakeResponse, unreachableFetch } from "./fake-response";

const NOW = new Date("2026-11-05T12:00:00.000Z");
const HOUR_MS = 60 * 60 * 1000;

function clientFor(fetchImpl: typeof fetch): MeliClient {
  return createMeliClient({
    getAccessToken: async () => "APP_USR-token",
    fetchImpl,
    baseUrl: "https://api.example.com",
  });
}

/** Answers every call with `body`, so a test can inspect the request instead. */
function clientAnswering(body: unknown) {
  const { impl, calls } = fakeFetch(() => fakeResponse({ body }));
  return { client: clientFor(impl), calls };
}

const PREDICTION = {
  category_id: "MLA1744",
  category_name: "Autos y Camionetas",
  domain_id: "MLA-CARS_AND_VANS",
  attributes: [{ id: "BRAND", value: "Volkswagen" }],
};

const RAW_ATTRIBUTES = [
  {
    id: "BRAND",
    name: "Marca",
    value_type: "string",
    tags: { required: true },
  },
  {
    id: "MODEL",
    name: "Modelo",
    value_type: "string",
    tags: { required: true },
  },
  {
    id: "ITEM_CONDITION",
    name: "Condición",
    value_type: "list",
    tags: { required: false },
  },
  { id: "SELLER_SKU", name: "SKU", value_type: "string" },
  {
    id: "VEHICLE_YEAR",
    name: "Año",
    value_type: "number",
    tags: { required: true, catalog_required: false },
  },
];

const REQUIRED: CategoryAttribute[] = [
  { id: "BRAND", name: "Marca", valueType: "string" },
  { id: "MODEL", name: "Modelo", valueType: "string" },
  { id: "VEHICLE_YEAR", name: "Año", valueType: "number" },
];

class FakeCacheStore implements CategoryAttributeCacheStore {
  readonly entries = new Map<
    string,
    { attributes: CategoryAttribute[]; fetchedAt: Date }
  >();
  readonly writes: Array<{
    categoryId: string;
    attributes: readonly CategoryAttribute[];
    fetchedAt: Date;
  }> = [];

  seed(categoryId: string, attributes: unknown, fetchedAt: Date) {
    this.entries.set(categoryId, {
      attributes: attributes as CategoryAttribute[],
      fetchedAt,
    });
  }

  async read(categoryId: string) {
    return this.entries.get(categoryId) ?? null;
  }

  async write(entry: {
    categoryId: string;
    attributes: readonly CategoryAttribute[];
    fetchedAt: Date;
  }) {
    this.writes.push(entry);
    this.entries.set(entry.categoryId, {
      attributes: [...entry.attributes],
      fetchedAt: entry.fetchedAt,
    });
  }
}

describe("predictCategory", () => {
  it("asks the predictor for one suggestion and returns it", async () => {
    const { client, calls } = clientAnswering([PREDICTION]);

    const prediction = await predictCategory({
      client,
      title: "Volkswagen Golf 1.6 Highline",
    });

    expect(prediction).toEqual({
      categoryId: "MLA1744",
      categoryName: "Autos y Camionetas",
      domainId: "MLA-CARS_AND_VANS",
    });

    const url = new URL(calls[0].url);
    expect(url.pathname).toBe("/sites/MLA/domain_discovery/search");
    expect(url.searchParams.get("q")).toBe("Volkswagen Golf 1.6 Highline");
    expect(url.searchParams.get("limit")).toBe("1");
  });

  it("returns null when nothing is predicted", async () => {
    const { client } = clientAnswering([]);

    await expect(
      predictCategory({ client, title: "algo que no es un auto" }),
    ).resolves.toBeNull();
  });

  it("asks nothing for a blank title instead of taking the site's top category", async () => {
    const never = unreachableFetch();

    await expect(
      predictCategory({ client: clientFor(never.impl), title: "   " }),
    ).resolves.toBeNull();
    expect(never.calls).toHaveLength(0);
  });

  it("asks the site it was given, MLA by default", async () => {
    const { client, calls } = clientAnswering([PREDICTION]);

    await predictCategory({ client, title: "Golf", site: "MLB" });

    expect(new URL(calls[0].url).pathname).toBe(
      "/sites/MLB/domain_discovery/search",
    );
  });
});

describe("getCategoryAttributes", () => {
  it("keeps only the attributes the category marks as required", async () => {
    const { client, calls } = clientAnswering(RAW_ATTRIBUTES);

    const attributes = await getCategoryAttributes({
      client,
      categoryId: "MLA1744",
    });

    expect(attributes).toEqual(REQUIRED);
    expect(new URL(calls[0].url).pathname).toBe(
      "/categories/MLA1744/attributes",
    );
  });

  it("returns nothing when the category has no required attribute", async () => {
    const { client } = clientAnswering([{ id: "SELLER_SKU", name: "SKU" }]);

    await expect(
      getCategoryAttributes({ client, categoryId: "MLA1744" }),
    ).resolves.toEqual([]);
  });
});

describe("getRequiredAttributes", () => {
  it("answers from a fresh cache without touching the network", async () => {
    const store = new FakeCacheStore();
    store.seed("MLA1744", REQUIRED, new Date(NOW.getTime() - HOUR_MS));
    const never = unreachableFetch();

    await expect(
      getRequiredAttributes("MLA1744", {
        client: clientFor(never.impl),
        store,
        now: () => NOW,
      }),
    ).resolves.toEqual(REQUIRED);
    expect(never.calls).toHaveLength(0);
    expect(store.writes).toEqual([]);
  });

  it("fetches and stores when nothing is cached", async () => {
    const store = new FakeCacheStore();
    const { client, calls } = clientAnswering(RAW_ATTRIBUTES);

    await expect(
      getRequiredAttributes("MLA1744", { client, store, now: () => NOW }),
    ).resolves.toEqual(REQUIRED);

    expect(calls).toHaveLength(1);
    expect(store.writes).toEqual([
      { categoryId: "MLA1744", attributes: REQUIRED, fetchedAt: NOW },
    ]);
  });

  it("refetches once the cached set is older than the TTL", async () => {
    const store = new FakeCacheStore();
    store.seed(
      "MLA1744",
      [{ id: "BRAND", name: "Marca", valueType: "string" }],
      new Date(NOW.getTime() - CATEGORY_ATTRIBUTE_TTL_MS - 1),
    );
    const { client, calls } = clientAnswering(RAW_ATTRIBUTES);

    await expect(
      getRequiredAttributes("MLA1744", { client, store, now: () => NOW }),
    ).resolves.toEqual(REQUIRED);
    expect(calls).toHaveLength(1);
    expect(store.writes[0]).toEqual({
      categoryId: "MLA1744",
      attributes: REQUIRED,
      fetchedAt: NOW,
    });
  });

  it("keeps a cached set for a day, so a newly required attribute appears within it", async () => {
    expect(CATEGORY_ATTRIBUTE_TTL_MS).toBe(24 * HOUR_MS);

    const fresh = new FakeCacheStore();
    fresh.seed("MLA1744", REQUIRED, new Date(NOW.getTime() - 23 * HOUR_MS));
    const never = unreachableFetch();

    await getRequiredAttributes("MLA1744", {
      client: clientFor(never.impl),
      store: fresh,
      now: () => NOW,
    });
    expect(never.calls).toHaveLength(0);

    const stale = new FakeCacheStore();
    stale.seed("MLA1744", REQUIRED, new Date(NOW.getTime() - 25 * HOUR_MS));
    const { client, calls } = clientAnswering(RAW_ATTRIBUTES);

    await getRequiredAttributes("MLA1744", {
      client,
      store: stale,
      now: () => NOW,
    });
    expect(calls).toHaveLength(1);
  });

  it("refetches instead of trusting a cache payload it cannot read", async () => {
    const store = new FakeCacheStore();
    store.seed("MLA1744", [{ nope: true }], new Date(NOW.getTime() - HOUR_MS));
    const { client, calls } = clientAnswering(RAW_ATTRIBUTES);

    await expect(
      getRequiredAttributes("MLA1744", { client, store, now: () => NOW }),
    ).resolves.toEqual(REQUIRED);
    expect(calls).toHaveLength(1);
  });
});
