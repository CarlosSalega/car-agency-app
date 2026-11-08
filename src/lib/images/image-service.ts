import { createImageService } from "image-uploads";

import { imageProvider } from "./provider";

/**
 * The upload/delete/deleteMany façade the app's importers and routes call.
 *
 * The implementation is the module's service over the shared provider, so the
 * public surface is unchanged while the pipeline (size/type guards, bounded
 * batch deletes, errors carrying codes) belongs to `image-uploads`.
 *
 * `imageProvider` is a lazy handle, not a built instance: each of the three
 * methods reaches `getImageProvider()` when it runs, so importing this file
 * (any route that deletes an image) never reads Cloudinary credentials.
 */
export const ImageService = createImageService(imageProvider);
