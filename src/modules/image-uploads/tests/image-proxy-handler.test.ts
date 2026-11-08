import { describe, expect, it, vi } from "vitest";

import {
  createImageProxyHandler,
  DEFAULT_IMAGE_CACHE_SECONDS,
  DEFAULT_IMAGE_PROXY_TIMEOUT_MS,
} from "../next/image-proxy-handler";

interface Context {
  readonly params: Promise<{ path: string[] }>;
}

const context = (path: string[]): Context => ({
  params: Promise.resolve({ path }),
});

function handlerWith(
  overrides: Partial<
    Parameters<typeof createImageProxyHandler<Context>>[0]
  > = {},
) {
  const logger = { warn: vi.fn(), error: vi.fn() };

  return createImageProxyHandler<Context>({
    provider: "cloudinary",
    sources: {
      cloudinary: { baseUrl: "https://res.cloudinary.com/demo/image/upload" },
    },
    getPath: (_request, received) =>
      received.params.then((params) => params.path),
    logger,
    ...overrides,
  });
}

describe("createImageProxyHandler", () => {
  it("answers 400 when the path is empty", async () => {
    const handler = handlerWith({});

    const response = await handler.GET(
      new Request("http://localhost/api/images"),
      context(["", ""]),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Ruta de imagen no proporcionada",
    });
  });

  it("answers 500 when the configured provider has no source", async () => {
    const handler = handlerWith({ sources: {} });

    const response = await handler.GET(
      new Request("http://localhost/api/images"),
      context(["cars", "abc.webp"]),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Error al obtener la imagen",
    });
  });

  it("fetches the joined path under the provider base and streams the image back", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { "content-type": "image/webp" },
        }),
    );
    const handler = handlerWith({ fetchImpl });

    const response = await handler.GET(
      new Request("http://localhost/api/images"),
      context(["cars", "abc.webp"]),
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://res.cloudinary.com/demo/image/upload/cars/abc.webp",
      {
        headers: { "User-Agent": "Mozilla/5.0", Accept: "image/*" },
        signal: expect.any(AbortSignal),
      },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/webp");
    expect(await response.arrayBuffer()).toEqual(
      new Uint8Array([1, 2, 3]).buffer,
    );
  });

  it("sets the immutable cache policy and the nosniff guard", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        new Response("x", {
          status: 200,
          headers: { "content-type": "image/png" },
        }),
    );
    const handler = handlerWith({ fetchImpl, cacheSeconds: 60 });

    const response = await handler.GET(
      new Request("http://localhost/api/images"),
      context(["cars", "abc.png"]),
    );

    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=60, immutable, stale-while-revalidate=60",
    );
    expect(response.headers.get("CDN-Cache-Control")).toBe(
      "public, max-age=60",
    );
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("defaults the cache window to one week", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        new Response("x", {
          status: 200,
          headers: { "content-type": "image/png" },
        }),
    );
    const handler = handlerWith({ fetchImpl });

    const response = await handler.GET(
      new Request("http://localhost/api/images"),
      context(["cars", "abc.png"]),
    );

    expect(DEFAULT_IMAGE_CACHE_SECONDS).toBe(604800);
    expect(response.headers.get("Cache-Control")).toContain("max-age=604800");
  });

  it("falls back to image/webp when upstream does not declare an image type", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response("<html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
    );
    const handler = handlerWith({ fetchImpl });

    const response = await handler.GET(
      new Request("http://localhost/api/images"),
      context(["cars", "abc"]),
    );

    expect(response.headers.get("Content-Type")).toBe("image/webp");
  });

  it("answers 404 when upstream does not have the asset", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("missing", { status: 404 }),
    );
    const handler = handlerWith({ fetchImpl });

    const response = await handler.GET(
      new Request("http://localhost/api/images"),
      context(["cars", "gone.webp"]),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Imagen no encontrada",
    });
  });

  it("answers 500 and logs when the fetch throws", async () => {
    const error = vi.fn();
    const handler = handlerWith({
      fetchImpl: vi.fn(async () => {
        throw new Error("ECONNRESET");
      }),
      logger: { warn: vi.fn(), error },
    });

    const response = await handler.GET(
      new Request("http://localhost/api/images"),
      context(["cars", "abc.webp"]),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Error al obtener la imagen",
    });
    expect(error).toHaveBeenCalledWith("Image proxy failed", {
      error: "ECONNRESET",
    });
  });

  it("only adds the Next revalidate option when the deployment asks for it", async () => {
    const withRevalidate = vi.fn<typeof fetch>(
      async () =>
        new Response("x", {
          status: 200,
          headers: { "content-type": "image/png" },
        }),
    );
    await handlerWith({
      fetchImpl: withRevalidate,
      revalidateSeconds: 604800,
    }).GET(new Request("http://localhost/api/images"), context(["a.webp"]));

    expect(withRevalidate.mock.calls[0]?.[1]).toEqual({
      headers: { "User-Agent": "Mozilla/5.0", Accept: "image/*" },
      next: { revalidate: 604800 },
      signal: expect.any(AbortSignal),
    });

    const withoutRevalidate = vi.fn<typeof fetch>(
      async () =>
        new Response("x", {
          status: 200,
          headers: { "content-type": "image/png" },
        }),
    );
    await handlerWith({ fetchImpl: withoutRevalidate }).GET(
      new Request("http://localhost/api/images"),
      context(["a.webp"]),
    );

    expect(withoutRevalidate.mock.calls[0]?.[1]).not.toHaveProperty("next");
  });

  it("ships the sandboxing CSP with the 200 response", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        new Response("x", {
          status: 200,
          headers: { "content-type": "image/png" },
        }),
    );
    const handler = handlerWith({ fetchImpl });

    const response = await handler.GET(
      new Request("http://localhost/api/images"),
      context(["cars", "abc.png"]),
    );

    expect(response.headers.get("Content-Security-Policy")).toBe(
      "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    );
  });

  it("omits the CSP header when the deployment passes null", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        new Response("x", {
          status: 200,
          headers: { "content-type": "image/png" },
        }),
    );
    const handler = handlerWith({ fetchImpl, contentSecurityPolicy: null });

    const response = await handler.GET(
      new Request("http://localhost/api/images"),
      context(["cars", "abc.png"]),
    );

    expect(response.headers.get("Content-Security-Policy")).toBeNull();
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("uses the configured CSP verbatim", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        new Response("x", {
          status: 200,
          headers: { "content-type": "image/png" },
        }),
    );
    const handler = handlerWith({
      fetchImpl,
      contentSecurityPolicy: "default-src 'self'",
    });

    const response = await handler.GET(
      new Request("http://localhost/api/images"),
      context(["cars", "abc.png"]),
    );

    expect(response.headers.get("Content-Security-Policy")).toBe(
      "default-src 'self'",
    );
  });

  it("passes an abort signal to the upstream fetch by default", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        new Response("x", {
          status: 200,
          headers: { "content-type": "image/png" },
        }),
    );
    const handler = handlerWith({ fetchImpl });

    await handler.GET(
      new Request("http://localhost/api/images"),
      context(["cars", "abc.png"]),
    );

    const init = fetchImpl.mock.calls[0]?.[1];
    expect(DEFAULT_IMAGE_PROXY_TIMEOUT_MS).toBe(10000);
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it(
    "answers 504 with the timeout message when upstream never resolves",
    { timeout: 2000 },
    async () => {
      const fetchImpl = vi.fn<typeof fetch>(
        () => new Promise<Response>(() => {}),
      );
      const handler = handlerWith({ fetchImpl, timeoutMs: 10 });

      const response = await handler.GET(
        new Request("http://localhost/api/images"),
        context(["cars", "slow.webp"]),
      );

      expect(response.status).toBe(504);
      await expect(response.json()).resolves.toEqual({
        error: "La imagen tardó demasiado en responder",
      });
    },
  );

  it("answers 500 for a non-timeout fetch failure even with a timeout configured", async () => {
    const handler = handlerWith({
      timeoutMs: 10,
      fetchImpl: vi.fn<typeof fetch>(async () => {
        throw new Error("ECONNRESET");
      }),
    });

    const response = await handler.GET(
      new Request("http://localhost/api/images"),
      context(["cars", "abc.webp"]),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Error al obtener la imagen",
    });
  });

  it(
    "stops waiting for upstream when the client disconnects",
    { timeout: 2000 },
    async () => {
      const controller = new AbortController();
      const request = new Request("http://localhost/api/images", {
        signal: controller.signal,
      });
      const fetchImpl = vi.fn<typeof fetch>(
        () => new Promise<Response>(() => {}),
      );
      const handler = handlerWith({ fetchImpl });

      const pending = handler.GET(request, context(["cars", "abc.webp"]));
      controller.abort();

      const response = await pending;

      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toEqual({
        error: "Error al obtener la imagen",
      });
    },
  );

  it("normalises trailing slashes in the configured base", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        new Response("x", {
          status: 200,
          headers: { "content-type": "image/png" },
        }),
    );
    const handler = handlerWith({
      fetchImpl,
      sources: { cloudinary: { baseUrl: "https://cdn.example.com/products/" } },
    });

    await handler.GET(
      new Request("http://localhost/api/images"),
      context(["p", "1.webp"]),
    );

    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      "https://cdn.example.com/products/p/1.webp",
    );
  });
});
