import { v2 as cloudinary } from "cloudinary";

import { ImageError, describeError } from "../core/errors";
import { mapWithConcurrency } from "../core/concurrency";
import { silentLogger } from "../core/types";
import type {
  DeleteManyResult,
  DeleteResult,
  ImageProvider,
  Logger,
  UploadableFile,
  UploadOptions,
  UploadResult,
} from "../core/types";

export interface CloudinaryCredentials {
  readonly cloudName: string;
  readonly apiKey: string;
  readonly apiSecret: string;
}

export interface CloudinaryUploadDefaults {
  readonly folder?: string;

  readonly tags?: readonly string[];
  readonly resourceType?: "image" | "video" | "raw";

  readonly eager?: readonly Readonly<Record<string, unknown>>[];
  readonly overwrite?: boolean;
  readonly invalidate?: boolean;

  readonly quality?: string;
  readonly fetchFormat?: string;

  readonly timeoutMs?: number;
}

export interface CloudinaryUploadResponse {
  readonly public_id: string;
  readonly secure_url: string;
}

export interface CloudinaryUploadStream {
  end(chunk?: unknown): void;
  destroy?(): void;
}

export interface CloudinarySdk {
  readonly uploader: {
    upload_stream(
      options: Record<string, unknown>,
      callback: (error: unknown, result?: CloudinaryUploadResponse) => void,
    ): CloudinaryUploadStream;
    destroy(
      publicId: string,
      options?: Record<string, unknown>,
    ): Promise<{ readonly result: string }>;
  };
}

export interface CloudinaryProviderConfig extends CloudinaryCredentials {
  readonly defaults?: CloudinaryUploadDefaults;
  readonly logger?: Logger;

  readonly concurrency?: number;

  readonly sdk?: CloudinarySdk;
}

export const DEFAULT_CLOUDINARY_UPLOAD_DEFAULTS: CloudinaryUploadDefaults = {
  resourceType: "image",
  overwrite: false,
  invalidate: true,
  eager: [
    {
      width: 400,
      height: 300,
      crop: "fill",
      gravity: "auto",
      quality: "auto",
      fetch_format: "auto",
      flags: ["progressive"],
    },
  ],
};

export const DEFAULT_DELETE_CONCURRENCY = 8;

export function buildCloudinaryUploadOptions(
  defaults: CloudinaryUploadDefaults,
  overrides?: UploadOptions,
): Record<string, unknown> {
  const options: Record<string, unknown> = {
    resource_type: defaults.resourceType ?? "image",
    overwrite: overrides?.overwrite ?? defaults.overwrite ?? false,
    invalidate: defaults.invalidate ?? true,
  };

  const folder = overrides?.folder ?? defaults.folder;
  if (folder !== undefined) options["folder"] = folder;

  const tags = overrides?.tags ?? defaults.tags;
  if (tags !== undefined && tags.length > 0) options["tags"] = [...tags];

  if (defaults.eager !== undefined) options["eager"] = defaults.eager;
  if (defaults.quality !== undefined) options["quality"] = defaults.quality;
  if (defaults.fetchFormat !== undefined)
    options["fetch_format"] = defaults.fetchFormat;
  if (defaults.timeoutMs !== undefined) options["timeout"] = defaults.timeoutMs;
  if (overrides?.publicId !== undefined)
    options["public_id"] = overrides.publicId;

  return options;
}

export const CLOUDINARY_ENV_KEYS = {
  cloudName: "NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME",
  apiKey: "CLOUDINARY_API_KEY",
  apiSecret: "CLOUDINARY_API_SECRET",
} as const;

export function createCloudinaryProvider(
  config: CloudinaryProviderConfig,
): ImageProvider {
  assertCredentials(config);

  const sdk = config.sdk ?? (cloudinary as unknown as CloudinarySdk);
  const logger = config.logger ?? silentLogger;
  const defaults: CloudinaryUploadDefaults = {
    ...DEFAULT_CLOUDINARY_UPLOAD_DEFAULTS,
    ...config.defaults,
  };
  const deleteConcurrency = config.concurrency ?? DEFAULT_DELETE_CONCURRENCY;

  if (config.sdk === undefined) {
    (
      cloudinary as unknown as {
        config(options: Record<string, unknown>): unknown;
      }
    ).config({
      cloud_name: config.cloudName,
      api_key: config.apiKey,
      api_secret: config.apiSecret,
      secure: true,
    });
  }

  async function upload(
    file: UploadableFile,
    overrides?: UploadOptions,
  ): Promise<UploadResult> {
    const signal = overrides?.signal;

    if (signal?.aborted === true) {
      logger.error("Cloudinary upload aborted", { folder: overrides?.folder });
      throw new ImageError("UPLOAD_FAILED", { message: "Upload aborted" });
    }

    let buffer: Buffer;

    try {
      buffer = Buffer.from(await file.arrayBuffer());
    } catch (error) {
      logger.error("Could not read the incoming file", {
        error: describeError(error),
      });
      throw new ImageError("UPLOAD_FAILED", {
        message: "Could not read the uploaded file",
        cause: error,
      });
    }

    const uploadOptions = buildCloudinaryUploadOptions(defaults, overrides);
    const abortListeners: Array<() => void> = [];

    try {
      const response = await new Promise<CloudinaryUploadResponse>(
        (resolve, reject) => {
          const stream = sdk.uploader.upload_stream(
            uploadOptions,
            (error, result) => {
              if (error) {
                reject(error);
                return;
              }

              if (!result) {
                reject(new Error("Cloudinary returned an empty response"));
                return;
              }

              resolve(result);
            },
          );

          if (signal !== undefined) {
            const onAbort = (): void => {
              stream.destroy?.();
              reject(
                new ImageError("UPLOAD_FAILED", { message: "Upload aborted" }),
              );
            };

            abortListeners.push(onAbort);
            signal.addEventListener("abort", onAbort, { once: true });

            if (signal.aborted) {
              onAbort();
              return;
            }
          }

          stream.end(buffer);
        },
      );

      return { key: response.public_id, url: response.secure_url };
    } catch (error) {
      logger.error("Cloudinary upload failed", {
        error: describeError(error),
        folder: uploadOptions["folder"],
      });

      throw new ImageError("UPLOAD_FAILED", {
        message: "Cloudinary upload failed",
        details: {
          folder: uploadOptions["folder"],
          resourceType: uploadOptions["resource_type"],
        },
        cause: error,
      });
    } finally {
      for (const listener of abortListeners) {
        signal?.removeEventListener("abort", listener);
      }
    }
  }

  async function remove(key: string): Promise<DeleteResult> {
    try {
      const result = await sdk.uploader.destroy(key);

      if (result.result === "ok" || result.result === "not found") {
        return { success: true };
      }

      return { success: false, error: result.result };
    } catch (error) {
      logger.error("Cloudinary delete failed", {
        error: describeError(error),
        key,
      });
      return { success: false, error: "Delete failed" };
    }
  }

  async function removeMany(keys: string[]): Promise<DeleteManyResult> {
    const results = await mapWithConcurrency(keys, deleteConcurrency, (key) =>
      remove(key),
    );

    const successful = results.filter((result) => result.success).length;

    return { successful, failed: keys.length - successful };
  }

  return { upload, delete: remove, deleteMany: removeMany };
}

export function cloudinaryConfigFromEnv(
  env: Record<string, string | undefined> = typeof process === "undefined"
    ? {}
    : process.env,
  options: Omit<CloudinaryProviderConfig, keyof CloudinaryCredentials> & {
    readonly envKeys?: Partial<
      Record<keyof typeof CLOUDINARY_ENV_KEYS, string>
    >;
  } = {},
): CloudinaryProviderConfig {
  const keys = { ...CLOUDINARY_ENV_KEYS, ...options.envKeys };
  const cloudName = env[keys.cloudName];
  const apiKey = env[keys.apiKey];
  const apiSecret = env[keys.apiSecret];

  const missing: string[] = [];

  if (cloudName === undefined || cloudName === "") missing.push(keys.cloudName);
  if (apiKey === undefined || apiKey === "") missing.push(keys.apiKey);
  if (apiSecret === undefined || apiSecret === "") missing.push(keys.apiSecret);

  if (missing.length > 0) {
    throw new ImageError("MISCONFIGURED", {
      message: `Cloudinary is not configured: missing ${missing.join(", ")}`,
      details: { missing },
    });
  }

  return {
    cloudName: cloudName as string,
    apiKey: apiKey as string,
    apiSecret: apiSecret as string,
    ...(options.defaults === undefined ? {} : { defaults: options.defaults }),
    ...(options.logger === undefined ? {} : { logger: options.logger }),
    ...(options.sdk === undefined ? {} : { sdk: options.sdk }),
  };
}

function assertCredentials(config: CloudinaryCredentials): void {
  const missing: string[] = [];

  if (!config.cloudName) missing.push("cloudName");
  if (!config.apiKey) missing.push("apiKey");
  if (!config.apiSecret) missing.push("apiSecret");

  if (missing.length > 0) {
    throw new ImageError("MISCONFIGURED", {
      message: `Cloudinary provider is missing ${missing.join(", ")}`,
      details: { missing },
    });
  }
}
