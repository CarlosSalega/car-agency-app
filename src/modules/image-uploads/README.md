# image-uploads

Extracted from `car-agency-app`: the Cloudinary image upload pipeline **and** its guards, rebuilt so a
different project — an ecommerce product catalogue, for instance — can reuse it without inheriting that
app's site config, Prisma models or auth library.

The module owns the order of the security-relevant steps and the normalized failure codes. Your project
owns identity, ownership and copy.

**Reading order.** Humans: this file. AI agents: `AGENTS.md` first (the non-negotiable invariants),
then `docs/architecture.md` (hexagonal mapping, feature-based placement, antipatterns, portability).

```
authenticate  →  validate file  →  authorize delete  →  provider
```

## Using it

This folder is self-contained: `index.ts`, `core/`, `guards/`, `next/`, `providers/`, `adapters/`, `tests/`,
this file, `AGENTS.md`, `docs/architecture.md` and `scripts/remove-comments.mjs`. It has **no
`package.json` on purpose** — it is not published, not installed, and not a workspace package.

To reuse it, copy the directory into another project (for a Next.js app, `src/modules/image-uploads/`)
and import it through that project's own path alias. The tests travel with it, so the copy is verified
where it lands rather than where it came from.

It is consumed as TypeScript source: there is no build step and no `dist/`. The one external package the
code needs is `cloudinary`, and only `providers/cloudinary.ts` imports it.

Everything runs from the host project's root, with a path filter:

```bash
pnpm exec vitest run src/modules/image-uploads/tests                     # 153 passed + 2 skipped (live contract)
pnpm exec vitest run src/modules/image-uploads/tests/boundaries.test.ts  # nothing imports the host app
pnpm exec tsc --noEmit
```

In `car-agency-app` the live suite also has a root script, `pnpm test:contract`.

`tests/boundaries.test.ts` is what keeps a copy honest: every `.ts` file here may import only relative
paths, plus `cloudinary` and `node:*`. Nothing in this folder may import from the host application —
that rule is what an in-tree module is most tempted to break.

### The contract suite

`tests/cloudinary-contract.test.ts` has two halves. The static half runs always and pins the exact option
key set the provider emits. The live half uploads a generated 1×1 PNG to a real account, deletes it,
deletes it again and batch-deletes an unknown key — it is gated on `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`,
`CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET`, and skips cleanly when they are absent.

Run it with credentials present (from the app root):

```bash
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=… CLOUDINARY_API_KEY=… CLOUDINARY_API_SECRET=… \
  pnpm exec vitest run src/modules/image-uploads/tests/cloudinary-contract.test.ts
```

It is the only check that proves the option shape end to end. It uploads into the
`image-uploads-contract/` folder and deletes what it creates in `afterAll`.

## Entry points

| Import                                         | Contains                                                         | Pulls in                            |
| ---------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------- |
| `@/modules/image-uploads`                      | types, errors, messages, validation, guard policies, URL helpers | nothing                             |
| `@/modules/image-uploads/providers/cloudinary` | `createCloudinaryProvider`, `cloudinaryConfigFromEnv`            | the Cloudinary SDK                  |
| `@/modules/image-uploads/next`                 | `createUploadHandler`, `createImageProxyHandler`                 | nothing (`Request`/`Response` only) |
| `@/modules/image-uploads/adapters/better-auth` | `betterAuthActorFromSession`, `createBetterAuthActorResolver`    | nothing (structural)                |

The root entry point deliberately re-exports no provider and no adapter: a page that only renders URLs
never loads the SDK or the auth library. The alias is the host project's (`@/*` → `src/*` here); another
project points its own alias at the copied folder.

## Quick start (Next.js App Router)

```ts
// src/app/api/upload/route.ts
import { createBetterAuthActorResolver } from "@/modules/image-uploads/adapters/better-auth";
import {
  cloudinaryConfigFromEnv,
  createCloudinaryProvider,
} from "@/modules/image-uploads/providers/cloudinary";
import { createUploadHandler } from "@/modules/image-uploads/next";

import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { activeSite } from "@/site/active";

const provider = createCloudinaryProvider(
  cloudinaryConfigFromEnv(process.env, {
    // Client data lives here, not inside the module.
    defaults: {
      folder: "car-agency-app",
      tags: [activeSite.identity.name, "vehicle"],
    },
  }),
);

const { POST, DELETE } = createUploadHandler({
  provider,
  getActor: createBetterAuthActorResolver({ getSession: () => getSession() }),
  validate: { maxBytes: 15 * 1024 * 1024, mimePrefixes: ["image/"] },
  authorizeDelete: async ({ key, actor }) => {
    const cars = await prisma.car.findMany({
      where: { images: { has: key } },
      select: { userId: true },
    });

    if (cars.length === 0) return { allowed: false, reason: "NOT_OWNED" };
    if (actor.role === "ADMIN" || cars.some((car) => car.userId === actor.id))
      return { allowed: true };

    return { allowed: false, reason: "OTHER_OWNER" };
  },
});

export { POST, DELETE };
```

```ts
// src/app/api/images/[...path]/route.ts
import { createImageProxyHandler } from "@/modules/image-uploads/next";
import type { NextRequest } from "next/server";

const { GET: proxy } = createImageProxyHandler<{
  params: Promise<{ path: string[] }>;
}>({
  provider: process.env.IMAGE_PROVIDER ?? "cloudinary",
  sources: {
    cloudinary: {
      baseUrl: `https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
    },
  },
  getPath: async (_request, context) => (await context.params).path ?? [],
  cacheSeconds: 604_800,
  revalidateSeconds: 604_800, // Next.js fetch cache; omit on other runtimes
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return proxy(request, context);
}
```

## The three guards

Each is a pure decision. An adapter composes them; you never reorder them by accident.

| Step             | Function                                                   | Default                                                          | Failure                              |
| ---------------- | ---------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------ |
| Identify         | `evaluateAuthentication(request, getActor)`                | no default — you supply `getActor`                               | `401 UNAUTHENTICATED`                |
| Validate         | `evaluateUploadFile(input, policy)`                        | `mimePrefixes: ["image/"]`, `image/svg+xml` blocked, no size cap | `400 INVALID_TYPE` / `413 TOO_LARGE` |
| Authorize delete | `evaluateDelete({ request, actor, key, authorizeDelete })` | **denies** when omitted                                          | `403 FORBIDDEN`                      |

Design rules worth keeping when you extend it:

- **Type before size.** An oversized PDF is `INVALID_TYPE`, not `TOO_LARGE`.
- **Delete fails closed.** Without `authorizeDelete`, every authenticated delete is refused. There is no
  silent "everyone can delete anything" default.
- **Identity-provider errors are not 401.** If `getActor` throws, the error propagates and the adapter
  answers 500: a session-store outage is a server fault, not a logout.
- **Rejections store nothing.** A refused upload never reaches the provider, and a refused delete leaves
  the asset where it is.

### `reason` selects the copy

Your ownership model maps onto two reasons, and the adapter picks the matching string:

```ts
return { allowed: false, reason: "NOT_OWNED" }; // the asset belongs to no record
return { allowed: false, reason: "OTHER_OWNER" }; // it belongs to someone else
return { allowed: false, message: "Archived" }; // or your own copy, verbatim
```

## Ecommerce example

```ts
const { POST, DELETE } = createUploadHandler({
  provider: createCloudinaryProvider(
    cloudinaryConfigFromEnv(process.env, {
      defaults: { folder: "products", tags: ["catalogue"] },
    }),
  ),
  getActor: async (request) => readStaffSession(request),
  // An exact allow-list: SVG is refused instead of being accepted as "an image".
  validate: {
    maxBytes: 8 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/avif"],
  },
  uploadOptions: ({ actor }) => ({ folder: `tenants/${actor.id}/products` }),
  authorizeDelete: async ({ key, actor }) => {
    const owned = await db.productImage.exists({
      publicId: key,
      tenantId: actor.id,
    });
    return owned
      ? { allowed: true }
      : { allowed: false, reason: "OTHER_OWNER" };
  },
});
```

## Swapping the storage provider

Implement one interface and nothing else changes:

```ts
import type { ImageProvider } from "@/modules/image-uploads";

export const r2Provider: ImageProvider = {
  async upload(file, options) {
    /* → { key, url } */
  },
  async delete(key) {
    /* → { success, error? } */
  }, // never throws
  async deleteMany(keys) {
    /* → { successful, failed } */
  },
};
```

`delete` reporting instead of throwing is deliberate: a batch delete of twenty assets should delete
nineteen and say so, not collapse on the first failure.

To pick a provider from configuration:

```ts
import { resolveProvider } from "@/modules/image-uploads";

const provider = resolveProvider({
  registry: {
    cloudinary: () => createCloudinaryProvider(config),
    r2: () => r2Provider,
  },
  defaultProvider: "cloudinary",
  envKey: "IMAGE_PROVIDER",
});
```

An unknown or missing name throws `PROVIDER_UNKNOWN` rather than falling back — writing files to a bucket
nobody configured is worse than a failed request.

## Tuning and cancellation

```ts
const provider = createCloudinaryProvider({
  ...cloudinaryConfigFromEnv(),
  concurrency: 8, // batch deletes in flight; default 8
  defaults: { timeoutMs: 60_000 }, // SDK request timeout, per upload
});

const { POST } = createUploadHandler({
  provider,
  getActor,
  validate,
  uploadOptions: ({ file }) => ({ signal }),
});
```

- **`UploadOptions.signal`** — an aborted signal destroys the upload stream and rejects with
  `UPLOAD_FAILED`. The handler does not invent a signal: pass one from your runtime (an Express
  `req.on("close")`, a Hono `c.req.raw.signal`) through the `uploadOptions` callback.
- **`concurrency`** — batch deletes run through `mapWithConcurrency`, results in input order, at most
  `concurrency` in flight. Reads once at construction.
- **Proxy `timeoutMs`** — default 10 s, `DEFAULT_IMAGE_PROXY_TIMEOUT_MS`. A timeout answers `504` with the
  `TIMEOUT` message; any other upstream failure stays `500 UPSTREAM_FAILED`. The upstream `fetch` always
  receives a combined signal (timeout + client disconnect), and the handler races the fetch against it, so
  an abort-unaware `fetch` implementation still cannot hang the invocation.

## URL helpers (no SDK, no network)

```ts
import {
  createImageUrlResolver,
  getPublicIdFromUrl,
} from "@/modules/image-uploads";

const images = createImageUrlResolver({
  base: "https://res.cloudinary.com/${CLOUD_NAME}/image/upload",
  cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  fallback: "/placeholder.webp",
});

images.resolve("products/42", "card"); // → …/w_400,h_300,c_fill,f_auto,q_auto,dpr_auto/products/42
getPublicIdFromUrl(
  "https://res.cloudinary.com/demo/image/upload/v171/cars/abc.webp",
); // → "cars/abc"
```

Both placeholders (`${CLOUD_NAME}` and the legacy `${NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}`) are accepted, so
migrating an app that already templated the env var name needs no change to its `.env`.

### Plain bucket (S3, R2, any CDN) — no transform layer

The same helpers cover a bucket whose URLs are just `<base>/<key>`:

```ts
const images = createImageUrlResolver({
  base: "https://cdn.example.com/products",
  variantPlacement: "none", // <base>/<key>, no transform segment
  stripExtension: false, // the object key keeps its extension
});

images.resolve("abc.webp"); // → https://cdn.example.com/products/abc.webp

// Recover the object key a delete call needs, from the stored URL.
getPublicIdFromUrl("https://cdn.example.com/products/abc.webp", {
  host: "cdn.example.com",
  afterSegment: null, // whole path is the key, there is no "upload" marker
  stripExtension: false,
}); // → "products/abc.webp"
```

Every option defaults to the Cloudinary behaviour, so the two layouts coexist in one deployment. An
unknown layout returns the fallback instead of guessing.

## Where this module lives in a feature-based architecture

Short version: `shared/image-uploads`, never inside a feature. Each feature composes its own handler with
its own `authorizeDelete`; the provider is built once in a composition root, because Cloudinary v2 keeps
credentials in process-global configuration. `shared/` must never import from `features/` — that is why
the ownership check is a parameter and not an import.

Full trees, the three antipatterns and the portability matrix: [`docs/architecture.md`](docs/architecture.md).
Agent-facing rules: [`AGENTS.md`](AGENTS.md).

## Migrating `car-agency-app`

| Original                                          | Replacement                                                    |
| ------------------------------------------------- | -------------------------------------------------------------- |
| `src/lib/images/image-provider.interface.ts`      | `ImageProvider` in `@/modules/image-uploads`                   |
| `src/lib/images/image-service.ts`                 | `createImageService` + `resolveProvider`                       |
| `src/lib/images/providers/cloudinary.provider.ts` | `createCloudinaryProvider`                                     |
| `src/lib/images/cloudinary-config.ts`             | `defaults` (`DEFAULT_CLOUDINARY_UPLOAD_DEFAULTS`) + `variants` |
| `src/lib/images/resolve-image-url.ts`             | `createImageUrlResolver`                                       |
| `src/lib/utils.ts` → `getPublicIdFromUrl`         | `getPublicIdFromUrl`                                           |
| `src/app/api/upload/route.ts`                     | `createUploadHandler`                                          |
| `src/app/api/images/[...path]/route.ts`           | `createImageProxyHandler`                                      |
| `src/lib/auth/session.ts` (route usage)           | `createBetterAuthActorResolver`                                |
| `src/lib/auth/auth-middleware.ts`                 | superseded by the guard policies                               |

The Spanish response copy is preserved byte-for-byte in `ES_MESSAGES`, so that migration should not change
a single API response. `EN_MESSAGES` is available for projects that do not ship Spanish.

### Deliberate differences from the original

| Behaviour                      | Original                                                         | This module                                                                                            |
| ------------------------------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Env read                       | `process.env` at module load in the provider and the proxy route | injected explicitly (`cloudinaryConfigFromEnv`, `sources`)                                             |
| Client data in upload options  | `folder`/`tags` hard-coded with the site name                    | `defaults` / `uploadOptions` per project                                                               |
| Upload with no session         | `401`                                                            | `401` (unchanged)                                                                                      |
| Malformed multipart body       | `500`                                                            | `400 NO_FILE`                                                                                          |
| Malformed JSON on delete       | `500`                                                            | `400 MISSING_KEY`                                                                                      |
| Delete ownership               | inlined Prisma query in the route                                | `authorizeDelete` guard, **fails closed** when absent                                                  |
| Empty tag list                 | `tags: []` sent                                                  | omitted                                                                                                |
| CDN base with a trailing slash | double slash in the URL                                          | normalized                                                                                             |
| Oversized body                 | fully buffered in memory, then rejected                          | `content-length` preflight answers 413 without reading it                                              |
| `image/svg+xml` upload         | accepted                                                         | blocked by default (`blockedMimeTypes: []` opts back in)                                               |
| Proxy response headers         | `nosniff` only                                                   | plus a sandboxing CSP, so a directly-navigated SVG cannot run script                                   |
| Batch delete                   | unbounded `allSettled`, every key at once                        | `mapWithConcurrency`, `concurrency` default 8                                                          |
| Cancellation                   | none                                                             | `UploadOptions.signal` aborts an upload; the proxy aborts upstream on timeout and on client disconnect |
| Upstream timeout               | none, a hanging origin holds the invocation                      | `timeoutMs` default 10 s, answered as `504 TIMEOUT`                                                    |

## Verified

`pnpm exec tsc --noEmit` clean; `pnpm exec vitest run src/modules/image-uploads/tests` → 10 files, 153 passed

- 2 skipped (the live contract suite) — 151 of those are this module's own tests, plus the 2 boundary
  tests. Covering:

* the boundary rule: every `.ts` file here imports only relative paths, `cloudinary` or `node:*`
* URL helpers: Cloudinary and plain-bucket layouts, version/extension stripping, missing marker, fallbacks
* oversize preflight (413 without reading the body), SVG rejection in both layers, proxy CSP headers
* bounded concurrency (order preserved, limit never exceeded, bad limit normalised) and cancellation
  (pre-aborted and mid-upload), proxy timeout answered as 504 while other failures stay 500
* validation order, byte-limit boundary (`size === maxBytes` accepted), allow-list vs prefix, case folding
* Cloudinary option building, folder/tag injection, upload/delete/batch-delete failures, missing credentials
* guard policies: fail-closed delete, reason propagation, guard exceptions, provider-error propagation
* HTTP handlers: exact status + body for every rejection, and that refusals never reach the provider
* image proxy: cache headers, content-type fallback, 400/404/500 paths
* better-auth mapping: inactive account, expiry, missing role
