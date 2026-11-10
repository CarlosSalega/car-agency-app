import { describe, expect, it } from "vitest";

import type { MeliClient, MeliQuery } from "../client";
import {
  buildItemPayload,
  createMeliItemsApi,
  type MeliItemDraft,
} from "../items";

/**
 * The wrappers are thin, so the tests pin exactly what crosses the wire: the
 * endpoint, the body and the narrowing of the answer. No retries and no state
 * decisions live here, which is why none of that is asserted.
 */

interface Call {
  readonly method: "get" | "post" | "put";
  readonly path: string;
  readonly payload?: unknown;
  readonly query?: MeliQuery;
}

function fakeClient(answers: {
  readonly get?: unknown;
  readonly post?: unknown;
  readonly put?: unknown;
}) {
  const calls: Call[] = [];

  const client: MeliClient = {
    async get<T>(path: string, query?: MeliQuery): Promise<T> {
      calls.push({ method: "get", path, query });

      return answers.get as T;
    },
    async post<T>(path: string, payload: unknown): Promise<T> {
      calls.push({ method: "post", path, payload });

      return answers.post as T;
    },
    async put<T>(path: string, payload: unknown): Promise<T> {
      calls.push({ method: "put", path, payload });

      return answers.put as T;
    },
  };

  return { client, calls };
}

const draft: MeliItemDraft = {
  title: "Volkswagen Gol 1.6",
  categoryId: "MLA1744",
  price: 12_500_000,
  currencyId: "ARS",
  pictureUrls: ["https://cdn.example.com/cars/gol.jpg"],
  attributes: [{ id: "BRAND", value_name: "Volkswagen" }],
};

describe("buildItemPayload", () => {
  it("sends the documented fields and nothing invented", () => {
    expect(buildItemPayload(draft)).toEqual({
      title: "Volkswagen Gol 1.6",
      category_id: "MLA1744",
      price: 12_500_000,
      currency_id: "ARS",
      pictures: [{ source: "https://cdn.example.com/cars/gol.jpg" }],
      attributes: [{ id: "BRAND", value_name: "Volkswagen" }],
    });
  });

  it("does not add condition, listing type, quantity or sale terms", () => {
    const payload = buildItemPayload(draft);

    for (const field of [
      "condition",
      "listing_type_id",
      "buying_mode",
      "available_quantity",
      "sale_terms",
      "description",
    ]) {
      expect(payload).not.toHaveProperty(field);
    }
  });
});

describe("createItem", () => {
  it("posts the payload to /items and narrows the answer", async () => {
    const { client, calls } = fakeClient({
      post: {
        id: "MLA100",
        status: "active",
        sub_status: "picture downloading pending",
        price: 12_500_000,
        permalink: "https://articulo.mercadolibre.com.ar/MLA-100",
        extra_field_we_ignore: true,
      },
    });

    const item = await createMeliItemsApi(client).createItem(draft);

    expect(calls).toEqual([
      { method: "post", path: "/items", payload: buildItemPayload(draft) },
    ]);
    expect(item).toEqual({
      id: "MLA100",
      status: "active",
      subStatus: "picture downloading pending",
      price: 12_500_000,
      permalink: "https://articulo.mercadolibre.com.ar/MLA-100",
    });
  });

  it("throws when the marketplace claims it created an item but names none", async () => {
    const { client } = fakeClient({ post: { status: "active" } });

    await expect(createMeliItemsApi(client).createItem(draft)).rejects.toThrow(
      /item id/,
    );
  });
});

describe("updateItem", () => {
  it("puts the patch on the encoded item path and keeps the id we addressed", async () => {
    const { client, calls } = fakeClient({
      put: { status: "closed" },
    });

    const item = await createMeliItemsApi(client).updateItem("MLA 100/1", {
      status: "closed",
    });

    expect(calls).toEqual([
      {
        method: "put",
        path: "/items/MLA%20100%2F1",
        payload: { status: "closed" },
      },
    ]);
    expect(item).toEqual({
      id: "MLA 100/1",
      status: "closed",
      subStatus: null,
      price: null,
      permalink: null,
    });
  });
});

describe("getItem", () => {
  it("reads the item and narrows the fields a handler uses", async () => {
    const { client, calls } = fakeClient({
      get: {
        id: "MLA100",
        status: "paused",
        sub_status: "picture downloading pending",
        price: 12_500_000,
        permalink: null,
        category_id: "MLA1744",
      },
    });

    const item = await createMeliItemsApi(client).getItem("MLA100");

    expect(calls).toEqual([{ method: "get", path: "/items/MLA100" }]);
    expect(item).toEqual({
      id: "MLA100",
      status: "paused",
      subStatus: "picture downloading pending",
      price: 12_500_000,
      permalink: null,
    });
  });
});
