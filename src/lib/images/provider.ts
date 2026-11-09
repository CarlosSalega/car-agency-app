import { resolveProvider } from "@/modules/image-uploads";
import type { ImageProvider } from "@/modules/image-uploads";
import {
  cloudinaryConfigFromEnv,
  createCloudinaryProvider,
} from "@/modules/image-uploads/providers/cloudinary";

import { CLOUDINARY_UPLOAD_DEFAULTS } from "./cloudinary-config";

/**
 * The composition root for image storage.
 *
 * Built **on first use and once per process**, never at import: constructing it
 * reads the credentials and Cloudinary v2 keeps them in process-global
 * configuration (it exposes no instance-scoped client), so a second provider in
 * the same process would rewrite the first one's credentials. Importing this
 * module must stay free of side effects — a route that only deletes an image
 * was previously killed at import by a missing upload credential.
 *
 * `IMAGE_PROVIDER` still selects the provider, defaulting to `cloudinary`. An
 * unknown or empty value throws `PROVIDER_UNKNOWN` instead of silently using
 * Cloudinary: a deployment that asked for another backend must fail loudly.
 *
 * Credentials come from the environment; the folder and tags are this
 * deployment's client data and arrive from `cloudinary-config.ts`, never from
 * the module.
 */
let provider: ImageProvider | undefined;

export function getImageProvider(): ImageProvider {
  if (provider === undefined) {
    provider = resolveProvider({
      registry: {
        cloudinary: () =>
          createCloudinaryProvider(
            cloudinaryConfigFromEnv(process.env, {
              defaults: CLOUDINARY_UPLOAD_DEFAULTS,
            }),
          ),
      },
      defaultProvider: "cloudinary",
      envKey: "IMAGE_PROVIDER",
    });
  }

  return provider;
}

/**
 * A provider handle that is safe to import and to hold across requests.
 *
 * Consumers that need a `provider` *value* (the upload handler's config) take
 * this instead of calling `getImageProvider()` where they are constructed: that
 * call would happen at module load and reintroduce exactly the import-time
 * failure described above. Every method resolves the real provider on use.
 */
export const imageProvider: ImageProvider = {
  upload: (file, options) => getImageProvider().upload(file, options),
  delete: (key) => getImageProvider().delete(key),
  deleteMany: (keys) => getImageProvider().deleteMany(keys),
};
