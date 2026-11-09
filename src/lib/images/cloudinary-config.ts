import {
  DEFAULT_CLOUDINARY_UPLOAD_DEFAULTS,
  buildCloudinaryUploadOptions,
} from "@/modules/image-uploads/providers/cloudinary";
import type { CloudinaryUploadDefaults } from "@/modules/image-uploads/providers/cloudinary";

import { activeSite } from "@/site/active";

/**
 * The two client-identifying upload settings, and the only place they live.
 *
 * `image-uploads` must stay deployment-agnostic, so `folder` and `tags` are
 * injected from here: the module never reads a site name, and the next
 * dealership's copy of this repository changes them in `src/site/`, not in the
 * dependency.
 *
 * The dealership name is the tag an operator filters by in the Cloudinary
 * console, so it is client data. This is the one direction where the product
 * reads the active site: an integration may use its labels, and must not
 * branch its behaviour on which client it is.
 */
export const CLOUDINARY_UPLOAD_DEFAULTS = {
  folder: "car-agency-app",
  tags: [activeSite.identity.name, "vehicle"],
  // The app's image policy, not the module's: Cloudinary stores the original
  // size-optimised and in the format the browser asked for. Dropping either key
  // changes what is stored, so they stay here rather than becoming a dependency
  // default that another consumer would inherit.
  quality: "auto",
  fetchFormat: "auto",
} satisfies CloudinaryUploadDefaults;

/**
 * The option set every upload in this app sends.
 *
 * Derived from the module's builder so the security- and storage-relevant keys
 * (`resource_type`, `overwrite`, `invalidate`, `folder`, `tags`, `eager`,
 * `quality`, `fetch_format`) stay the module's decision.
 *
 * The module's defaults go in first and this deployment's on top, so the
 * effective object is the one this app has always sent — `prisma/seed` spreads
 * it verbatim.
 */
export const CLOUDINARY_UPLOAD_OPTIONS = buildCloudinaryUploadOptions({
  ...DEFAULT_CLOUDINARY_UPLOAD_DEFAULTS,
  ...CLOUDINARY_UPLOAD_DEFAULTS,
});
