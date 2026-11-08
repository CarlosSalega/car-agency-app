import { createImageProxyHandler } from "image-uploads/next";
import type { NextRequest } from "next/server";

import { CACHE_REVALIDATE } from "@/lib/cache";

/**
 * `/api/images/[...path]` — serves an image from the configured origin so the
 * browser sees one host and the CDN caches one URL shape.
 *
 * The proxy is the module's handler: it builds the upstream URL from a named
 * source, forwards the body with the same cache headers this route has always
 * sent, and adds the guard rails the old inline version lacked (a sandboxing
 * CSP, an upstream timeout, and aborting the fetch when the client goes away).
 */

type ImageRouteContext = { params: Promise<{ path: string[] }> };

const PROVIDER = process.env.IMAGE_PROVIDER ?? "cloudinary";

const S3_BASE_URL = process.env.S3_PUBLIC_BASE_URL;

const { GET: proxy } = createImageProxyHandler<ImageRouteContext>({
  provider: PROVIDER,

  /**
   * `s3` is only registered when a base URL exists, which is the same
   * condition the old route enforced with its explicit "not configured" check:
   * an `s3` deployment without `S3_PUBLIC_BASE_URL` still fails, now as an
   * upstream failure instead of a bespoke 500.
   */
  sources: {
    cloudinary: {
      baseUrl: `https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
    },
    ...(S3_BASE_URL === undefined ? {} : { s3: { baseUrl: S3_BASE_URL } }),
  },

  getPath: async (_request, context) => (await context.params).path ?? [],

  cacheSeconds: CACHE_REVALIDATE.IMAGES,

  // The Next.js fetch cache: the upstream read is revalidated on the same
  // window as the response cache, exactly as before.
  revalidateSeconds: CACHE_REVALIDATE.IMAGES,
});

export async function GET(request: NextRequest, context: ImageRouteContext) {
  return proxy(request, context);
}
