import { describe, expect, it, vi } from "vitest";

import { RateLimitedError } from "@/lib/jobs/types";

import { createMeliClient, MeliApiError, MeliTimeoutError } from "../client";
import { fakeFetch, fakeResponse } from "./fake-response";

const ACCESS_TOKEN = "APP_USR-secret-access-token";

function client(
  fetchImpl: typeof fetch,
  options: { readonly now?: () => Date; readonly timeoutMs?: number } = {},
) {
  return createMeliClient({
    getAccessToken: async () => ACCESS_TOKEN,
    fetchImpl,
    baseUrl: "https://api.example.com",
    ...options,
  });
}

/** A `fetch` that answers only when the request is aborted. */
function hangingFetch() {
  return fakeFetch(
    (_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        });
      }),
  );
}

describe("the bearer token", () => {
  it("is requested again for every call, so a refreshed token is picked up", async () => {
    const { impl, calls } = fakeFetch(() => fakeResponse({ body: {} }));

    let issued = 0;
    const withRotatingToken = createMeliClient({
      getAccessToken: async () => {
        issued += 1;
        return `token-${issued}`;
      },
      fetchImpl: impl,
      baseUrl: "https://api.example.com",
    });

    await withRotatingToken.get("/users/me");
    await withRotatingToken.get("/users/me");

    expect(calls).toHaveLength(2);
    expect(calls[0].init.headers).toMatchObject({
      authorization: "Bearer token-1",
    });
    expect(calls[1].init.headers).toMatchObject({
      authorization: "Bearer token-2",
    });
  });
});

describe("the query string", () => {
  it("encodes every value and drops the ones that are not set", async () => {
    const { impl, calls } = fakeFetch(() => fakeResponse({ body: {} }));

    await client(impl).get("/sites/MLA/domain_discovery/search", {
      q: "VW Golf 1.6 & aire",
      limit: 1,
      catalog: true,
      missing: undefined,
      empty: null,
    });

    const [call] = calls;
    const url = new URL(call.url);

    expect(url.pathname).toBe("/sites/MLA/domain_discovery/search");
    expect(url.searchParams.get("q")).toBe("VW Golf 1.6 & aire");
    expect(url.searchParams.get("limit")).toBe("1");
    expect(url.searchParams.get("catalog")).toBe("true");
    expect(url.searchParams.has("missing")).toBe(false);
    expect(url.searchParams.has("empty")).toBe(false);
    // The separator inside the value must travel encoded, not as a second
    // parameter that splits the title in two.
    expect(call.url).toContain("%26");
  });

  it("joins the path onto the base url whether or not the slashes match", async () => {
    const { impl, calls } = fakeFetch(() => fakeResponse({ body: {} }));

    await client(impl).get("categories/MLA1744/attributes");
    await client(impl).get("/categories/MLA1744/attributes");

    expect(calls[0].url).toBe(
      "https://api.example.com/categories/MLA1744/attributes",
    );
    expect(calls[1].url).toBe(
      "https://api.example.com/categories/MLA1744/attributes",
    );
  });
});

describe("a 429", () => {
  it("throws the queue's RateLimitedError with the Retry-After in seconds", async () => {
    const { impl } = fakeFetch(() =>
      fakeResponse({ status: 429, headers: { "retry-after": "120" } }),
    );

    const error = await client(impl)
      .get("/items")
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(RateLimitedError);
    expect((error as RateLimitedError).retryAfterMs).toBe(120_000);
  });

  it("parses a Retry-After written as an HTTP date", async () => {
    const now = new Date("2026-11-05T12:00:00.000Z");
    const retryAt = new Date(now.getTime() + 90_000).toUTCString();
    const { impl } = fakeFetch(() =>
      fakeResponse({ status: 429, headers: { "retry-after": retryAt } }),
    );

    const error = await client(impl, { now: () => now })
      .get("/items")
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(RateLimitedError);
    expect((error as RateLimitedError).retryAfterMs).toBe(90_000);
  });

  it("carries no wait when the header is absent", async () => {
    const { impl } = fakeFetch(() => fakeResponse({ status: 429 }));

    const error = await client(impl)
      .get("/items")
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(RateLimitedError);
    expect((error as RateLimitedError).retryAfterMs).toBeUndefined();
  });

  it("carries no wait when the header is not a number or a date", async () => {
    const { impl } = fakeFetch(() =>
      fakeResponse({ status: 429, headers: { "retry-after": "soon" } }),
    );

    const error = await client(impl)
      .get("/items")
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(RateLimitedError);
    expect((error as RateLimitedError).retryAfterMs).toBeUndefined();
  });
});

describe("another non-2xx", () => {
  it("throws MeliApiError with the status, the path and a short body excerpt", async () => {
    const { impl } = fakeFetch(() =>
      fakeResponse({
        status: 400,
        rawBody: JSON.stringify({
          message: "invalid access token",
          error: "bad_request",
        }),
      }),
    );

    const error = await client(impl)
      .get("/items", { ids: "MLA1" })
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(MeliApiError);
    expect((error as MeliApiError).status).toBe(400);
    expect((error as MeliApiError).path).toBe("/items");
    expect((error as MeliApiError).bodyExcerpt).toContain("invalid access");
    expect((error as MeliApiError).bodyExcerpt.length).toBeLessThanOrEqual(300);
    expect((error as MeliApiError).message).toContain("400");
  });

  it("truncates a body that goes on and on", async () => {
    const { impl } = fakeFetch(() =>
      fakeResponse({ status: 500, rawBody: "x".repeat(5_000) }),
    );

    const error = (await client(impl)
      .get("/items")
      .catch((thrown: unknown) => thrown)) as MeliApiError;

    expect(error.bodyExcerpt.length).toBeLessThanOrEqual(300);
  });

  it("reports a 2xx whose body is not JSON instead of returning undefined", async () => {
    const { impl } = fakeFetch(() =>
      fakeResponse({ status: 200, rawBody: "<html>hi</html>" }),
    );

    const error = (await client(impl)
      .get("/items")
      .catch((thrown: unknown) => thrown)) as MeliApiError;

    expect(error).toBeInstanceOf(MeliApiError);
    expect(error.status).toBe(200);
    expect(error.bodyExcerpt).not.toContain(ACCESS_TOKEN);
  });
});

describe("a timeout", () => {
  it("aborts the request instead of waiting forever", async () => {
    const { impl } = hangingFetch();

    const error = await client(impl, { timeoutMs: 10 })
      .get("/items")
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(MeliTimeoutError);
    expect((error as MeliTimeoutError).timeoutMs).toBe(10);
    expect((error as MeliTimeoutError).path).toBe("/items");
  });

  it("clears its timer once the call is done", async () => {
    vi.useFakeTimers();

    try {
      const { impl } = fakeFetch(() => fakeResponse({ body: { ok: true } }));

      await expect(
        client(impl, { timeoutMs: 1_000 }).get<{ ok: boolean }>("/items"),
      ).resolves.toEqual({ ok: true });
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("the token", () => {
  const failures = [
    {
      name: "rate limited",
      fetch: fakeFetch(() => fakeResponse({ status: 429 })),
      timeoutMs: undefined,
    },
    {
      name: "rejected",
      fetch: fakeFetch(() =>
        fakeResponse({ status: 401, rawBody: "unauthorized" }),
      ),
      timeoutMs: undefined,
    },
    {
      name: "a server error",
      fetch: fakeFetch(() => fakeResponse({ status: 500, rawBody: "boom" })),
      timeoutMs: undefined,
    },
    { name: "timed out", fetch: hangingFetch(), timeoutMs: 5 },
  ];

  it.each(failures)(
    "never appears in the error, even when the call is $name",
    async ({ fetch, timeoutMs }) => {
      const error = (await client(fetch.impl, { timeoutMs })
        .get("/items")
        .catch((thrown: unknown) => thrown)) as Error;

      expect(error).toBeInstanceOf(Error);
      expect(error.message).not.toContain(ACCESS_TOKEN);
      expect(
        JSON.stringify(error, Object.getOwnPropertyNames(error)),
      ).not.toContain(ACCESS_TOKEN);
    },
  );
});
