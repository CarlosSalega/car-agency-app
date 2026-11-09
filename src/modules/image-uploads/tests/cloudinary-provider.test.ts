import { describe, expect, it, vi } from "vitest";

import { ImageError } from "../core/errors";
import type { Logger } from "../core/types";
import {
  cloudinaryConfigFromEnv,
  createCloudinaryProvider,
  DEFAULT_CLOUDINARY_UPLOAD_DEFAULTS,
  DEFAULT_DELETE_CONCURRENCY,
} from "../providers/cloudinary";
import type {
  CloudinarySdk,
  CloudinaryUploadResponse,
} from "../providers/cloudinary";

interface UploadCall {
  readonly options: Record<string, unknown>;
  readonly chunk: unknown;
}

function fakeSdk(
  respond: (options: Record<string, unknown>) => {
    error?: unknown;
    result?: CloudinaryUploadResponse;
  } = (options) => ({
    result: {
      public_id: `${String(options["folder"] ?? "root")}/asset`,
      secure_url: "https://res.cloudinary.com/demo/image/upload/asset.png",
    },
  }),
) {
  const uploads: UploadCall[] = [];
  const destroyed: string[] = [];

  const sdk: CloudinarySdk = {
    uploader: {
      upload_stream(options, callback) {
        return {
          end(chunk) {
            uploads.push({ options, chunk });

            const { error, result } = respond(options);

            if (error !== undefined) {
              callback(error);
              return;
            }

            callback(null, result);
          },
        };
      },
      async destroy(publicId) {
        destroyed.push(publicId);
        return { result: "ok" };
      },
    },
  };

  return { sdk, uploads, destroyed };
}

function makeFile(content = "bytes", type = "image/png"): File {
  return new File([new TextEncoder().encode(content)], "photo.png", { type });
}

const credentials = { cloudName: "demo", apiKey: "key", apiSecret: "secret" };

function recordingLogger() {
  const calls: {
    level: "warn" | "error";
    message: string;
    context?: Record<string, unknown>;
  }[] = [];
  const logger: Logger = {
    warn(message, context) {
      calls.push({
        level: "warn",
        message,
        ...(context === undefined ? {} : { context }),
      });
    },
    error(message, context) {
      calls.push({
        level: "error",
        message,
        ...(context === undefined ? {} : { context }),
      });
    },
  };

  return { logger, calls };
}

describe("createCloudinaryProvider", () => {
  it("refuses to build without credentials", () => {
    expect(() =>
      createCloudinaryProvider({ cloudName: "", apiKey: "k", apiSecret: "s" }),
    ).toThrow(ImageError);

    try {
      createCloudinaryProvider({ cloudName: "", apiKey: "", apiSecret: "" });
      expect.unreachable("should have thrown");
    } catch (error) {
      expect((error as ImageError).code).toBe("MISCONFIGURED");
      expect((error as ImageError).details).toEqual({
        missing: ["cloudName", "apiKey", "apiSecret"],
      });
    }
  });

  it("uploads through the injected SDK and returns key and url", async () => {
    const { sdk, uploads } = fakeSdk();
    const provider = createCloudinaryProvider({ ...credentials, sdk });
    const file = makeFile();

    await expect(provider.upload(file)).resolves.toEqual({
      key: "root/asset",
      url: "https://res.cloudinary.com/demo/image/upload/asset.png",
    });

    expect(uploads).toHaveLength(1);
    expect(uploads[0]?.chunk).toEqual(Buffer.from("bytes"));
  });

  it("sends the shared upload defaults so derivatives stay identical to the original app", async () => {
    const { sdk, uploads } = fakeSdk();

    await createCloudinaryProvider({ ...credentials, sdk }).upload(makeFile());

    expect(uploads[0]?.options).toEqual({
      resource_type: "image",
      overwrite: false,
      invalidate: true,
      eager: DEFAULT_CLOUDINARY_UPLOAD_DEFAULTS.eager,
    });
  });

  it("sends quality and fetch_format for the stored original only when configured", async () => {
    const configured = fakeSdk();
    const unconfigured = fakeSdk();

    await createCloudinaryProvider({
      ...credentials,
      sdk: configured.sdk,
      defaults: { quality: "auto", fetchFormat: "auto" },
    }).upload(makeFile());
    await createCloudinaryProvider({
      ...credentials,
      sdk: unconfigured.sdk,
    }).upload(makeFile());

    expect(configured.uploads[0]?.options).toMatchObject({
      quality: "auto",
      fetch_format: "auto",
    });
    expect(unconfigured.uploads[0]?.options).not.toHaveProperty("quality");
    expect(unconfigured.uploads[0]?.options).not.toHaveProperty("fetch_format");
  });

  it("omits folder and tags until a deployment supplies them", async () => {
    const { sdk, uploads } = fakeSdk();

    await createCloudinaryProvider({ ...credentials, sdk }).upload(makeFile());

    expect(uploads[0]?.options).not.toHaveProperty("folder");
    expect(uploads[0]?.options).not.toHaveProperty("tags");
  });

  it("takes folder and tags from configuration, and lets one call override them", async () => {
    const { sdk, uploads } = fakeSdk();
    const provider = createCloudinaryProvider({
      ...credentials,
      sdk,
      defaults: { folder: "catalogue", tags: ["acme", "product"] },
    });

    await provider.upload(makeFile());
    await provider.upload(makeFile(), {
      folder: "legacy",
      tags: ["migrated"],
      overwrite: true,
      publicId: "fixed-id",
    });

    expect(uploads[0]?.options).toMatchObject({
      folder: "catalogue",
      tags: ["acme", "product"],
      overwrite: false,
      resource_type: "image",
    });
    expect(uploads[1]?.options).toMatchObject({
      folder: "legacy",
      tags: ["migrated"],
      overwrite: true,
      public_id: "fixed-id",
    });
  });

  it("drops an empty tag list instead of sending it", async () => {
    const { sdk, uploads } = fakeSdk();

    await createCloudinaryProvider({
      ...credentials,
      sdk,
      defaults: { tags: [] },
    }).upload(makeFile());

    expect(uploads[0]?.options).not.toHaveProperty("tags");
  });

  it("wraps a provider failure in UPLOAD_FAILED and logs it", async () => {
    const { sdk } = fakeSdk(() => ({ error: new Error("invalid signature") }));
    const { logger, calls } = recordingLogger();
    const provider = createCloudinaryProvider({
      ...credentials,
      sdk,
      logger,
      defaults: { folder: "catalogue" },
    });

    await expect(provider.upload(makeFile())).rejects.toThrow(ImageError);

    try {
      await provider.upload(makeFile());
      expect.unreachable("should have thrown");
    } catch (error) {
      expect((error as ImageError).code).toBe("UPLOAD_FAILED");
      expect((error as ImageError).details).toEqual({
        folder: "catalogue",
        resourceType: "image",
      });
      expect((error as Error).cause).toBeInstanceOf(Error);
    }

    expect(calls.filter((call) => call.level === "error")).toHaveLength(2);
    expect(calls[0]?.context).toEqual({
      error: "invalid signature",
      folder: "catalogue",
    });
  });

  it("fails the upload when the SDK resolves without a result", async () => {
    const { sdk } = fakeSdk(() => ({ result: undefined }));

    await expect(
      createCloudinaryProvider({ ...credentials, sdk }).upload(makeFile()),
    ).rejects.toMatchObject({
      code: "UPLOAD_FAILED",
    });
  });

  it("reports a missing arrayBuffer as UPLOAD_FAILED", async () => {
    const { sdk } = fakeSdk();
    const provider = createCloudinaryProvider({ ...credentials, sdk });
    const broken = {
      size: 10,
      type: "image/png",
      arrayBuffer: () => Promise.reject(new Error("stream closed")),
    };

    await expect(provider.upload(broken)).rejects.toMatchObject({
      code: "UPLOAD_FAILED",
      message: "Could not read the uploaded file",
    });
  });

  it("treats ok and not found as a successful delete", async () => {
    const destroyed: string[] = [];
    const sdk: CloudinarySdk = {
      uploader: {
        upload_stream: () => ({ end() {} }),
        async destroy(publicId) {
          destroyed.push(publicId);
          return { result: publicId === "gone" ? "not found" : "ok" };
        },
      },
    };
    const provider = createCloudinaryProvider({ ...credentials, sdk });

    await expect(provider.delete("asset")).resolves.toEqual({ success: true });
    await expect(provider.delete("gone")).resolves.toEqual({ success: true });
    expect(destroyed).toEqual(["asset", "gone"]);
  });

  it("surfaces an unexpected delete result as a failure", async () => {
    const sdk: CloudinarySdk = {
      uploader: {
        upload_stream: () => ({ end() {} }),
        async destroy() {
          return { result: "permission denied" };
        },
      },
    };

    await expect(
      createCloudinaryProvider({ ...credentials, sdk }).delete("asset"),
    ).resolves.toEqual({
      success: false,
      error: "permission denied",
    });
  });

  it("never throws from delete: a rejected call becomes a failure result", async () => {
    const { logger, calls } = recordingLogger();
    const sdk: CloudinarySdk = {
      uploader: {
        upload_stream: () => ({ end() {} }),
        destroy: async () => {
          throw new Error("network down");
        },
      },
    };

    await expect(
      createCloudinaryProvider({ ...credentials, sdk, logger }).delete("asset"),
    ).resolves.toEqual({
      success: false,
      error: "Delete failed",
    });
    expect(calls[0]?.context).toEqual({ error: "network down", key: "asset" });
  });

  it("counts batch deletes, with success on not-found", async () => {
    const sdk: CloudinarySdk = {
      uploader: {
        upload_stream: () => ({ end() {} }),
        async destroy(publicId) {
          if (publicId === "boom") throw new Error("nope");
          return { result: publicId === "gone" ? "not found" : "ok" };
        },
      },
    };

    await expect(
      createCloudinaryProvider({ ...credentials, sdk }).deleteMany([
        "a",
        "gone",
        "boom",
      ]),
    ).resolves.toEqual({
      successful: 2,
      failed: 1,
    });
  });

  it("keeps at most three batch deletes in flight when concurrency is three", async () => {
    const keys = Array.from({ length: 20 }, (_, index) => `key-${index}`);
    let inFlight = 0;
    let peak = 0;
    const sdk: CloudinarySdk = {
      uploader: {
        upload_stream: () => ({ end() {} }),
        async destroy(publicId) {
          inFlight += 1;
          peak = Math.max(peak, inFlight);
          await new Promise((resolve) => setTimeout(resolve, 2));
          inFlight -= 1;

          if (publicId === "key-7") throw new Error("nope");

          return { result: publicId === "key-3" ? "not found" : "ok" };
        },
      },
    };

    await expect(
      createCloudinaryProvider({
        ...credentials,
        sdk,
        concurrency: 3,
      }).deleteMany(keys),
    ).resolves.toEqual({
      successful: 19,
      failed: 1,
    });
    expect(peak).toBe(3);
  });

  it("defaults the batch delete concurrency to eight", async () => {
    expect(DEFAULT_DELETE_CONCURRENCY).toBe(8);

    const keys = Array.from({ length: 20 }, (_, index) => `key-${index}`);
    let inFlight = 0;
    let peak = 0;
    const sdk: CloudinarySdk = {
      uploader: {
        upload_stream: () => ({ end() {} }),
        async destroy() {
          inFlight += 1;
          peak = Math.max(peak, inFlight);
          await new Promise((resolve) => setTimeout(resolve, 2));
          inFlight -= 1;
          return { result: "ok" };
        },
      },
    };

    await expect(
      createCloudinaryProvider({ ...credentials, sdk }).deleteMany(keys),
    ).resolves.toEqual({
      successful: 20,
      failed: 0,
    });
    expect(peak).toBe(8);
  });

  it("rejects an already-aborted upload without touching the SDK", async () => {
    const uploadStream = vi.fn(() => ({ end() {} }));
    const sdk: CloudinarySdk = {
      uploader: {
        upload_stream: uploadStream,
        async destroy() {
          return { result: "ok" };
        },
      },
    };
    const controller = new AbortController();
    controller.abort();

    await expect(
      createCloudinaryProvider({ ...credentials, sdk }).upload(makeFile(), {
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ code: "UPLOAD_FAILED" });
    expect(uploadStream).not.toHaveBeenCalled();
  });

  it(
    "destroys the stream and rejects when the signal aborts mid-upload",
    { timeout: 2000 },
    async () => {
      const controller = new AbortController();
      const destroy = vi.fn();
      let ended = false;
      const sdk: CloudinarySdk = {
        uploader: {
          upload_stream: () => ({
            destroy,
            end() {
              ended = true;
            },
          }),
          async destroy() {
            return { result: "ok" };
          },
        },
      };
      const { logger, calls } = recordingLogger();
      const provider = createCloudinaryProvider({
        ...credentials,
        sdk,
        logger,
      });

      const pending = provider.upload(makeFile(), {
        signal: controller.signal,
      });
      await vi.waitFor(() => {
        expect(ended).toBe(true);
      });
      controller.abort();

      await expect(pending).rejects.toMatchObject({ code: "UPLOAD_FAILED" });
      expect(destroy).toHaveBeenCalledTimes(1);
      expect(calls.some((call) => call.level === "error")).toBe(true);
    },
  );

  it("does not touch SDK global configuration when an SDK is injected", async () => {
    const config = vi.fn();
    const { sdk } = fakeSdk();

    createCloudinaryProvider({ ...credentials, sdk });

    expect(config).not.toHaveBeenCalled();
  });
});

describe("cloudinaryConfigFromEnv", () => {
  it("reads the same variable names the original application used", () => {
    const config = cloudinaryConfigFromEnv({
      NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: "demo",
      CLOUDINARY_API_KEY: "key",
      CLOUDINARY_API_SECRET: "secret",
    });

    expect(config).toEqual({
      cloudName: "demo",
      apiKey: "key",
      apiSecret: "secret",
    });
  });

  it("throws MISCONFIGURED listing exactly what is missing", () => {
    try {
      cloudinaryConfigFromEnv({ CLOUDINARY_API_KEY: "key" });
      expect.unreachable("should have thrown");
    } catch (error) {
      expect((error as ImageError).code).toBe("MISCONFIGURED");
      expect((error as ImageError).details).toEqual({
        missing: ["NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_SECRET"],
      });
    }
  });

  it("treats an empty value as missing", () => {
    expect(() =>
      cloudinaryConfigFromEnv({
        NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: "",
        CLOUDINARY_API_KEY: "k",
        CLOUDINARY_API_SECRET: "s",
      }),
    ).toThrow(ImageError);
  });

  it("accepts renamed variables and passes defaults through", () => {
    const config = cloudinaryConfigFromEnv(
      { CLOUD_NAME: "demo", KEY: "key", SECRET: "secret" },
      {
        envKeys: {
          cloudName: "CLOUD_NAME",
          apiKey: "KEY",
          apiSecret: "SECRET",
        },
        defaults: { folder: "products" },
      },
    );

    expect(config).toEqual({
      cloudName: "demo",
      apiKey: "key",
      apiSecret: "secret",
      defaults: { folder: "products" },
    });
  });

  it("reads an empty environment without touching process.env", () => {
    expect(() => cloudinaryConfigFromEnv({})).toThrow(
      /NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME/,
    );
  });
});
