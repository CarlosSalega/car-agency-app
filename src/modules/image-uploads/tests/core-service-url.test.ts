import { describe, expect, it, vi } from "vitest";

import { ImageError } from "../core/errors";
import { createImageService, resolveProvider } from "../core/service";
import type { ImageProvider } from "../core/types";
import {
  CLOUD_NAME_PLACEHOLDER,
  CLOUDINARY_CLOUD_NAME_PLACEHOLDER,
  createImageUrlResolver,
  DEFAULT_IMAGE_FALLBACK,
  getPublicIdFromUrl,
} from "../core/url";

function fakeProvider(): ImageProvider {
  return {
    upload: vi.fn(async () => ({
      key: "cars/1",
      url: "https://cdn/cars/1.png",
    })),
    delete: vi.fn(async () => ({ success: true })),
    deleteMany: vi.fn(async () => ({ successful: 0, failed: 0 })),
  };
}

describe("createImageService", () => {
  it("delegates every call to the provider and returns its result untouched", async () => {
    const provider = fakeProvider();
    const service = createImageService(provider);
    const file = new File(["x"], "a.png", { type: "image/png" });

    await expect(service.upload(file, { folder: "cars" })).resolves.toEqual({
      key: "cars/1",
      url: "https://cdn/cars/1.png",
    });
    await expect(service.delete("cars/1")).resolves.toEqual({ success: true });
    await expect(service.deleteMany(["a", "b"])).resolves.toEqual({
      successful: 0,
      failed: 0,
    });

    expect(provider.upload).toHaveBeenCalledWith(file, { folder: "cars" });
    expect(provider.delete).toHaveBeenCalledWith("cars/1");
    expect(provider.deleteMany).toHaveBeenCalledWith(["a", "b"]);
  });
});

describe("resolveProvider", () => {
  it("reads the provider name from the environment", () => {
    const cloudinary = fakeProvider();

    expect(
      resolveProvider({
        registry: { cloudinary },
        env: { IMAGE_PROVIDER: "cloudinary" },
        envKey: "IMAGE_PROVIDER",
      }),
    ).toBe(cloudinary);
  });

  it("falls back to the declared default when the variable is unset", () => {
    const cloudinary = fakeProvider();

    expect(
      resolveProvider({
        registry: { cloudinary },
        defaultProvider: "cloudinary",
        env: {},
      }),
    ).toBe(cloudinary);
  });

  it("builds a lazily constructed provider only when it is selected", () => {
    const build = vi.fn(() => fakeProvider());

    expect(build).not.toHaveBeenCalled();
    resolveProvider({
      registry: { cloudinary: build },
      env: {},
      defaultProvider: "cloudinary",
    });
    expect(build).toHaveBeenCalledTimes(1);
  });

  it("throws PROVIDER_UNKNOWN instead of guessing when nothing is configured", () => {
    const call = () =>
      resolveProvider({ registry: { cloudinary: fakeProvider() }, env: {} });

    expect(call).toThrow(ImageError);
    expect(call).toThrow(
      /No image provider configured: set IMAGE_PROVIDER or pass defaultProvider/,
    );
  });

  it("throws PROVIDER_UNKNOWN for an unregistered name instead of silently falling back", () => {
    try {
      resolveProvider({
        registry: { cloudinary: fakeProvider() },
        env: { IMAGE_PROVIDER: "s3" },
        defaultProvider: "cloudinary",
      });
      expect.unreachable("resolveProvider should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ImageError);
      expect((error as ImageError).code).toBe("PROVIDER_UNKNOWN");
      expect((error as ImageError).details).toEqual({
        envKey: "IMAGE_PROVIDER",
        configured: "s3",
        available: ["cloudinary"],
      });
    }
  });

  it("honours a custom environment key", () => {
    const cloudinary = fakeProvider();

    expect(
      resolveProvider({
        registry: { cloudinary },
        env: { MEDIA_DRIVER: "cloudinary" },
        envKey: "MEDIA_DRIVER",
      }),
    ).toBe(cloudinary);
  });
});

describe("createImageUrlResolver", () => {
  const base = `https://res.cloudinary.com/${CLOUD_NAME_PLACEHOLDER}/image/upload`;

  it("substitutes the cloud name and the named transform", () => {
    const resolver = createImageUrlResolver({ base, cloudName: "demo" });

    expect(resolver.resolve("cars/abc", "card")).toBe(
      "https://res.cloudinary.com/demo/image/upload/w_400,h_300,c_fill,f_auto,q_auto,dpr_auto/cars/abc",
    );
    expect(resolver.resolve("cars/abc", "thumbnail")).toBe(
      "https://res.cloudinary.com/demo/image/upload/w_300,h_225,c_fill,f_auto,q_auto,dpr_auto/cars/abc",
    );
  });

  it("uses the first variant when the caller omits one, and honours defaultVariant", () => {
    const resolver = createImageUrlResolver({ base, cloudName: "demo" });

    expect(resolver.resolve("cars/abc")).toContain(
      "/w_300,h_225,c_fill,f_auto,q_auto,dpr_auto/",
    );
    expect(
      createImageUrlResolver({
        base,
        cloudName: "demo",
        defaultVariant: "detail",
      }).resolve("cars/abc"),
    ).toContain("/w_800,h_600,c_fill,f_auto,q_auto,dpr_auto/");
  });

  it("accepts the legacy env-var placeholder for a drop-in migration", () => {
    const legacy = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME_PLACEHOLDER}/image/upload`;

    expect(
      createImageUrlResolver({ base: legacy, cloudName: "demo" }).resolve(
        "cars/abc",
        "thumbnail",
      ),
    ).toBe(
      "https://res.cloudinary.com/demo/image/upload/w_300,h_225,c_fill,f_auto,q_auto,dpr_auto/cars/abc",
    );
  });

  it("strips the stored extension and trailing slashes of the base", () => {
    const resolver = createImageUrlResolver({
      base: `${base}/`,
      cloudName: "demo",
    });

    expect(resolver.resolve("cars/abc.webp", "thumbnail")).toBe(
      "https://res.cloudinary.com/demo/image/upload/w_300,h_225,c_fill,f_auto,q_auto,dpr_auto/cars/abc",
    );
  });

  it("returns the fallback instead of throwing when the input is incomplete", () => {
    const resolver = createImageUrlResolver({ base, cloudName: "demo" });

    expect(resolver.resolve("")).toBe(DEFAULT_IMAGE_FALLBACK);
    expect(
      createImageUrlResolver({ base, cloudName: "demo" }).resolve(
        "a",
        "nope" as never,
      ),
    ).toBe(DEFAULT_IMAGE_FALLBACK);
    expect(
      createImageUrlResolver({ base }).resolve("cars/abc", "thumbnail"),
    ).toBe(DEFAULT_IMAGE_FALLBACK);
    expect(
      createImageUrlResolver({ cloudName: "demo" }).resolve(
        "cars/abc",
        "thumbnail",
      ),
    ).toBe(DEFAULT_IMAGE_FALLBACK);
    expect(
      createImageUrlResolver({
        base: "https://cdn/x",
        fallback: "/none.webp",
      }).resolve(""),
    ).toBe("/none.webp");
  });

  it("works against a complete CDN base that needs no cloud name", () => {
    const untemplated = createImageUrlResolver({
      base: "https://cdn.example.com/products",
    });

    expect(untemplated.resolve("abc", "thumbnail")).toBe(
      "https://cdn.example.com/products/w_300,h_225,c_fill,f_auto,q_auto,dpr_auto/abc",
    );
  });

  it("uses the provided custom variants", () => {
    const resolver = createImageUrlResolver({
      base: "https://cdn.example.com",
      variants: { hero: "w_1600", grid: "w_400" },
      defaultVariant: "grid",
    });

    expect(resolver.resolve("p/1", "hero")).toBe(
      "https://cdn.example.com/w_1600/p/1",
    );
    expect(resolver.resolve("p/1")).toBe("https://cdn.example.com/w_400/p/1");
  });

  it("builds a plain base/key URL when there is no transform layer", () => {
    const resolver = createImageUrlResolver({
      base: "https://cdn.example.com/products",
      variantPlacement: "none",
      stripExtension: false,
    });

    expect(resolver.resolve("abc.webp")).toBe(
      "https://cdn.example.com/products/abc.webp",
    );
    expect(resolver.resolve("abc.webp", "card")).toBe(
      "https://cdn.example.com/products/abc.webp",
    );
  });

  it("builds the marketplace variant a publication ingests", () => {
    const resolver = createImageUrlResolver({ base, cloudName: "demo" });

    expect(resolver.resolve("cars/abc", "marketplace")).toBe(
      "https://res.cloudinary.com/demo/image/upload/w_1200,h_1200,c_limit,f_jpg,q_auto/cars/abc",
    );
  });

  it("keeps the transform-layer default unchanged", () => {
    const resolver = createImageUrlResolver({ base, cloudName: "demo" });

    expect(resolver.resolve("cars/abc", "card")).toBe(
      "https://res.cloudinary.com/demo/image/upload/w_400,h_300,c_fill,f_auto,q_auto,dpr_auto/cars/abc",
    );
  });

  it("substitutes the cloud name even without a transform layer", () => {
    const resolver = createImageUrlResolver({
      base: `https://${CLOUD_NAME_PLACEHOLDER}.cdn.example.com/products`,
      cloudName: "acme",
      variantPlacement: "none",
      stripExtension: false,
    });

    expect(resolver.resolve("abc.webp")).toBe(
      "https://acme.cdn.example.com/products/abc.webp",
    );
    expect(
      createImageUrlResolver({
        base: `https://${CLOUD_NAME_PLACEHOLDER}.cdn.example.com`,
        variantPlacement: "none",
      }).resolve("a"),
    ).toBe(DEFAULT_IMAGE_FALLBACK);
  });
});

describe("getPublicIdFromUrl", () => {
  it("recovers the key, dropping the version segment and the extension", () => {
    expect(
      getPublicIdFromUrl(
        "https://res.cloudinary.com/demo/image/upload/v1712345678/cars/abc.webp",
      ),
    ).toBe("cars/abc");
    expect(
      getPublicIdFromUrl(
        "https://res.cloudinary.com/demo/image/upload/cars/abc.png",
      ),
    ).toBe("cars/abc");
    expect(
      getPublicIdFromUrl(
        "https://res.cloudinary.com/demo/image/upload/cars/abc",
      ),
    ).toBe("cars/abc");
  });

  it("returns the fallback for anything that is not a Cloudinary delivery URL", () => {
    expect(getPublicIdFromUrl("")).toBe("placeholder");
    expect(getPublicIdFromUrl("https://cdn.example.com/cars/abc.png")).toBe(
      "placeholder",
    );
    expect(
      getPublicIdFromUrl("https://res.cloudinary.com/demo/image/upload"),
    ).toBe("placeholder");
    expect(
      getPublicIdFromUrl("https://res.cloudinary.com/demo/image/upload/"),
    ).toBe("placeholder");
    expect(getPublicIdFromUrl("not a url")).toBe("placeholder");
  });

  it("honours a custom fallback and host", () => {
    expect(getPublicIdFromUrl("nope", { fallback: "missing" })).toBe("missing");
    expect(
      getPublicIdFromUrl("https://cdn.example.com/upload/v1/p/1.webp", {
        host: "cdn.example.com",
      }),
    ).toBe("p/1");
  });

  it("takes the whole path as the key when no marker segment is configured", () => {
    const r2Url = "https://cdn.example.com/products/abc.webp";

    expect(
      getPublicIdFromUrl(r2Url, {
        host: "cdn.example.com",
        afterSegment: null,
      }),
    ).toBe("products/abc");
    expect(
      getPublicIdFromUrl(r2Url, {
        host: "cdn.example.com",
        afterSegment: null,
        stripExtension: false,
      }),
    ).toBe("products/abc.webp");
  });

  it("works on a plain bucket key with no directories", () => {
    expect(
      getPublicIdFromUrl("https://cdn.example.com/abc.png", {
        host: "cdn.example.com",
        afterSegment: null,
      }),
    ).toBe("abc");
  });

  it("accepts a marker segment other than upload", () => {
    expect(
      getPublicIdFromUrl(
        "https://res.cloudinary.com/demo/image/fetch/cars/abc.png",
        { afterSegment: "fetch" },
      ),
    ).toBe("cars/abc");
  });

  it("keeps the version segment when version stripping is disabled", () => {
    expect(
      getPublicIdFromUrl(
        "https://res.cloudinary.com/demo/image/upload/v171/cars/abc.webp",
        { stripVersion: false },
      ),
    ).toBe("v171/cars/abc");
  });

  it("still requires the marker segment when one is configured", () => {
    expect(
      getPublicIdFromUrl("https://cdn.example.com/products/abc.webp", {
        host: "cdn.example.com",
      }),
    ).toBe("placeholder");
  });
});
