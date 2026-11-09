import { ImageError } from "./errors";
import type {
  DeleteManyResult,
  DeleteResult,
  ImageProvider,
  UploadableFile,
  UploadOptions,
  UploadResult,
} from "./types";

export interface ImageService {
  upload(file: UploadableFile, options?: UploadOptions): Promise<UploadResult>;
  delete(key: string): Promise<DeleteResult>;
  deleteMany(keys: string[]): Promise<DeleteManyResult>;
}

export function createImageService(provider: ImageProvider): ImageService {
  return {
    upload(file, options) {
      return provider.upload(file, options);
    },
    delete(key) {
      return provider.delete(key);
    },
    deleteMany(keys) {
      return provider.deleteMany(keys);
    },
  };
}

export type ProviderEntry = ImageProvider | (() => ImageProvider);

export interface ResolveProviderOptions<Name extends string> {
  readonly registry: Record<Name, ProviderEntry>;

  readonly defaultProvider?: Name;

  readonly envKey?: string;

  readonly env?: Record<string, string | undefined>;
}

export function resolveProvider<Name extends string>(
  options: ResolveProviderOptions<Name>,
): ImageProvider {
  const envKey = options.envKey ?? "IMAGE_PROVIDER";
  const env = options.env ?? readProcessEnv();
  const configured = env[envKey] ?? options.defaultProvider;
  const available = Object.keys(options.registry);

  if (!configured) {
    throw new ImageError("PROVIDER_UNKNOWN", {
      message: `No image provider configured: set ${envKey} or pass defaultProvider`,
      details: { envKey, available },
    });
  }

  const entry = options.registry[configured as Name];

  if (!entry) {
    throw new ImageError("PROVIDER_UNKNOWN", {
      message: `Unknown image provider: ${configured}`,
      details: { envKey, configured, available },
    });
  }

  return typeof entry === "function" ? entry() : entry;
}

function readProcessEnv(): Record<string, string | undefined> {
  return typeof process === "undefined" ? {} : process.env;
}
