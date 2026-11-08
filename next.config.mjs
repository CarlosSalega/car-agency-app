/** @type {import('next').NextConfig} */

const nextConfig = {
  /**
   * `image-uploads` is consumed as TypeScript source: its `exports` map points
   * at `.ts` files and it ships no build output, so Next has to transpile it
   * like first-party code. Without this the import fails to parse.
   */
  transpilePackages: ["image-uploads"],

  /**
   * The catalog moved from `/autos` to `/catalogo`. The list redirects so old
   * links and indexed URLs keep working; the car detail does NOT move, because
   * `/autos/[slug]` is what search engines have indexed and what people share.
   */
  async redirects() {
    return [
      {
        source: "/autos",
        destination: "/catalogo",
        permanent: true,
      },
    ];
  },

  async headers() {
    return [
      // No rule for `/_next/static/:path*`, and that is a measured decision.
      //
      // This config had one for a long time and it never did anything:
      // `headers()` does not apply to `/_next/static`, because Next serves those
      // files from a static handler that bypasses config headers. Measured
      // against `next start` with the old rule in place, a hashed chunk came
      // back as `max-age=3600`, which is the CSS/JS rule below matching it, not
      // this one. The Next.js warning that flagged it was correct.
      //
      // Chunks are content-hashed, so `immutable` would be the right cache for
      // them. It has to come from the host or CDN, not from here.
      {
        source: "/:path*\\.(jpg|jpeg|png|webp|avif|svg|gif|ico|woff|woff2|ttf)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/:path*\\.(css|js)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600",
          },
        ],
      },
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },

  // `eslint: { ignoreDuringBuilds: true }` was removed. Next.js 16 dropped the
  // `eslint` config key and no longer lints during `next build`, so the option
  // had no effect and only produced an "unrecognized key" warning. Linting is
  // enforced by `pnpm lint` and by the Husky `pre-commit` hook instead.
  //
  // `typescript.ignoreBuildErrors` is still supported and is kept deliberately:
  // `next build` does not typecheck in this project, so
  // `pnpm exec tsc --noEmit` is a required separate step.
  typescript: {
    ignoreBuildErrors: true,
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
