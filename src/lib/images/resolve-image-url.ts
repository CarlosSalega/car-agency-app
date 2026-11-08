import { createImageUrlResolver } from "@/modules/image-uploads";

import { FALLBACK_IMAGE } from "@/lib/constants";

/**
 * The four sizes the app renders. The transform strings themselves are the
 * module's `DEFAULT_VARIANTS` — they were this file's data before the
 * extraction and are byte-identical, so every URL this app has ever emitted
 * stays valid.
 */
export type ImageVariant = "thumbnail" | "card" | "detail" | "fullscreen";

/**
 * The resolver is built once, from configuration that is constant for the
 * deployment: `NEXT_PUBLIC_*` variables are inlined at build time, so reading
 * them here is the same as reading them per call.
 *
 * `base` still carries the legacy `${NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}`
 * placeholder — the module accepts it, so `.env` needs no change.
 */
const images = createImageUrlResolver({
  base: process.env.NEXT_PUBLIC_IMAGE_CDN,
  cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  fallback: FALLBACK_IMAGE,
  // The app has always defaulted to `card`; the module would pick the first
  // variant (`thumbnail`) instead.
  defaultVariant: "card",
});

export function resolveImageUrl(key: string, variant: ImageVariant = "card") {
  return images.resolve(key, variant);
}
