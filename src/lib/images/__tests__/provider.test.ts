import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The provider is the composition root, and importing it must be inert.
 *
 * Before this test, `provider.ts` built the Cloudinary provider at module load:
 * any route that transitively imported it — including every route that merely
 * deletes an image — threw `ImageError(MISCONFIGURED)` while the module graph
 * was being evaluated, instead of failing the one request that needs storage.
 *
 * `getImageProvider()` therefore builds on first call, and the tests below pin
 * both halves: the import stays silent, the first call still throws loudly.
 *
 * The memoised instance lives in module state, so each test re-imports the
 * module after `vi.resetModules()` and restores `process.env` afterwards.
 */

const CLOUDINARY_CREDENTIAL_KEYS = [
  "NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
] as const;

const ENV_KEYS = [...CLOUDINARY_CREDENTIAL_KEYS, "IMAGE_PROVIDER"] as const;

let savedEnv: Record<string, string | undefined> = {};

function removeCredentials(): void {
  for (const key of CLOUDINARY_CREDENTIAL_KEYS) delete process.env[key];
}

function setCredentials(): void {
  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = "test-cloud";
  process.env.CLOUDINARY_API_KEY = "test-key";
  process.env.CLOUDINARY_API_SECRET = "test-secret";
}

function captureError(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }

  return undefined;
}

describe("getImageProvider", () => {
  beforeEach(() => {
    savedEnv = {};
    for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
    vi.resetModules();
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = savedEnv[key];

      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }

    vi.resetModules();
  });

  it("imports without throwing when the Cloudinary credentials are missing", async () => {
    removeCredentials();
    delete process.env.IMAGE_PROVIDER;

    await expect(import("../provider")).resolves.toBeDefined();
  });

  it("throws MISCONFIGURED on the first call when the Cloudinary credentials are missing", async () => {
    removeCredentials();
    delete process.env.IMAGE_PROVIDER;

    const { getImageProvider } = await import("../provider");

    expect(captureError(getImageProvider)).toMatchObject({
      name: "ImageError",
      code: "MISCONFIGURED",
    });
  });

  it("throws PROVIDER_UNKNOWN for an unknown or empty IMAGE_PROVIDER", async () => {
    for (const configured of ["s3", ""]) {
      setCredentials();
      process.env.IMAGE_PROVIDER = configured;
      vi.resetModules();

      const { getImageProvider } = await import("../provider");

      expect(captureError(getImageProvider)).toMatchObject({
        name: "ImageError",
        code: "PROVIDER_UNKNOWN",
      });
    }
  });

  it("builds the provider once and reuses it", async () => {
    setCredentials();
    delete process.env.IMAGE_PROVIDER;

    const { getImageProvider } = await import("../provider");

    const first = getImageProvider();
    expect(first).toBeDefined();
    expect(getImageProvider()).toBe(first);
  });
});
