# Architecture

Why this module has the shape it has, and how to place it in a project. The rules an agent must obey
are in `../AGENTS.md`; this document is the reasoning behind them.

## 1. It is a ports-and-adapters artifact

The module was not designed around HTTP; it was designed around one port. Everything else is a detail
that can be replaced.

| Hexagonal concept                        | In this module                                                     |
| ---------------------------------------- | ------------------------------------------------------------------ |
| Output port — what the application needs | `ImageProvider` (`core/types.ts`)                                  |
| Output adapter                           | `createCloudinaryProvider` (`providers/cloudinary.ts`)             |
| Input (driving) adapter                  | `createUploadHandler`, `createImageProxyHandler` (`next/`)         |
| Boundary port — implemented by the app   | `getActor`, `authorizeDelete` (`guards/types.ts`)                  |
| Application policy                       | `evaluateAuthentication` / `evaluateUploadFile` / `evaluateDelete` |
| Value object                             | `Actor { id, role }`                                               |
| Technical error taxonomy                 | `ImageError` + `IMAGE_ERROR_STATUS`                                |

Dependency inversion runs both ways: the module does not know who the user is, and it does not know who
owns what. Both arrive as functions. That is the whole reason a product catalogue and a car listing can
share it.

`core/` and `guards/` contain no `Request`, no `Response`, no `Headers`, no `FormData`. The only
Web API they touch is `new URL`. They are testable with plain objects, which is why the guard behaviour
can be pinned precisely instead of through a fake server.

## 2. Placement in a feature-based architecture

The rule, stated once: **this module is cross-cutting infrastructure, not a feature.** It belongs to
`shared/`, and the composition belongs to the feature.

```
src/
├── modules/
│   └── image-uploads/              ← this module: self-contained, imports nothing from the app
├── shared/
│   └── config/images.ts            ← composition root: the provider, built once
├── features/
│   ├── products/
│   │   ├── api/upload-route.ts     ← composes a handler with product ownership
│   │   ├── model/product-image.ts  ← domain invariants: how many photos, ordering, required
│   │   └── ui/image-upload.tsx
│   └── avatars/
│       └── api/upload-route.ts     ← same factory, different ownership
└── app/                            ← Next routes; they only re-export
    └── api/products/images/route.ts
```

`modules/` rather than `shared/` is a naming choice: the folder is a portable artifact with its own
boundary test, not a bag of utilities. What matters is that it is cross-cutting and that nothing inside
it imports the app.

```ts
// src/shared/config/images.ts — one instance per process
import {
  cloudinaryConfigFromEnv,
  createCloudinaryProvider,
} from "@/modules/image-uploads/providers/cloudinary";
import { activeSite } from "@/site/active";

export const provider = createCloudinaryProvider(
  cloudinaryConfigFromEnv(process.env, {
    defaults: { folder: "catalogue", tags: [activeSite.identity.name] },
  }),
);
```

```ts
// src/features/products/api/upload-route.ts — one composition per feature
import { createUploadHandler } from "@/modules/image-uploads/next";
import { provider } from "@/shared/config/images";
import { getSession } from "@/lib/auth/session";
import { db } from "@/shared/db";

export const { POST, DELETE } = createUploadHandler({
  provider,
  getActor: async () => {
    const session = await getSession();
    return session ? { id: session.user.id, role: session.user.role } : null;
  },
  validate: {
    maxBytes: 8 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  },
  authorizeDelete: async ({ key, actor }) => {
    const owned = await db.productImage.exists({
      publicId: key,
      tenantId: actor.id,
    });
    if (owned) return { allowed: true };

    const taken = await db.productImage.exists({ publicId: key });
    return taken
      ? { allowed: false, reason: "OTHER_OWNER" }
      : { allowed: false, reason: "NOT_OWNED" };
  },
});
```

Why the composition cannot live inside the module folder: `authorizeDelete` closes over the feature's
ownership model. Building the handler there would make it depend on every feature — the exact inversion
that the original code committed when `cloudinary-config.ts` imported `@/site/active`.

In Feature-Sliced Design terms: `shared` may not import from `features`. This module respects that as
long as the handler is built in the feature; the module only ships the factory.

### The one singleton

`createCloudinaryProvider` is called once, in the composition root. Cloudinary v2 stores credentials in
process-global configuration — it exposes no instance class (`require("cloudinary").Cloudinary` is
`undefined`, verified against 2.11.0). Building a provider per feature would call `cloudinary.config()`
repeatedly over the same global. It would not break, but it hides a real constraint, and it makes
"two accounts in one process" look supported when it is not.

Note the asymmetry this creates, and keep it: **provider = singleton, handlers = per feature, provider
calls = per request.**

## 3. Placement in the other styles

| Style                            | Where it goes                                                                                                                                                             |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Layered (`car-agency-app` today) | `src/modules/image-uploads/` holds the pipeline; `src/lib/images/` is the app's composition root (provider and service); `src/app/api/upload/route.ts` composes a handler |
| Hexagonal                        | Native: ports in `core/`, adapters per provider, boundary ports wired at the edge                                                                                         |
| Clean Architecture               | Interface-adapters + application policy; never in entities, never in use cases                                                                                            |
| MVC                              | A controller per route, composed from `createUploadHandler`                                                                                                               |

## 4. What this module is not

- **Not a domain module.** It holds no business invariants. "A product needs at least one photo",
  "maximum eight images", "the first image is the cover" — those belong to the feature model.
- **Not a feature.** No UI, no use cases, no state, no persistence.
- **Not your application policy.** It is technical policy about storage access. Access control on
  business objects stays where the business objects live.

## 5. Three antipatterns, with the original as evidence

1. **Placing it inside a feature.** `features/products/lib/upload/` gets copied the day `avatars`
   arrives. That is exactly the duplication this extraction removed (the original had the same handler
   logic reachable from two route shapes).
2. **Letting the module import the ownership model.** `src/modules/image-uploads/` importing
   `@/features/products/model` dissolves the boundary. The port exists to prevent it, and
   `tests/boundaries.test.ts` now fails the build's test run if it happens. Historical proof:
   `cloudinary-config.ts` read `activeSite.identity.name` inside an infrastructure module.
3. **One monolithic handler branching on entity type.** `app/api/upload/route.ts` with
   `if (type === "product") … else if (type === "avatar") …` returns to the starting point with extra
   steps. One handler per feature, all over the same factory.

A fourth, subtler one: **inventing a permissive default for a guard**. That is why `authorizeDelete`
fails closed and `validate` has no silent allow-all mode.

## 6. Portability: what is actually agnostic

Verified by grep over the module sources, not assumed.

| Concern                                  | Status                                                                                                                                                 |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Imports of the host application          | none — `tests/boundaries.test.ts` fails on any `@/…`, `@generated/…` or escaping relative path. The only bare specifiers are `cloudinary` and `node:*` |
| Framework imports (`next`, `express`, …) | none — the only occurrences of "next" are comments and the folder name                                                                                 |
| Database / ORM                           | none — no Prisma, no `Car`                                                                                                                             |
| Client or site configuration             | none — no `@/site`, no brand data                                                                                                                      |
| Auth library                             | none — `adapters/better-auth.ts` is structural typing only                                                                                             |
| Transport in `core/` + `guards/`         | none — pure functions                                                                                                                                  |
| Import-time environment read             | none — the two `process` references are guarded by `typeof process === "undefined"` and always injectable                                              |
| `next/`                                  | Web `Request`/`Response`/`Headers`/`FormData` — portable to any Web-standard runtime                                                                   |
| `providers/cloudinary.ts`                | Node only — `Buffer` plus the SDK's Node dependencies                                                                                                  |

Defaults with a Cloudinary accent, all overridable:

- `DEFAULT_VARIANTS` are Cloudinary transformation strings. `createImageUrlResolver` supports two
  layouts: `variantPlacement: "segment"` (default) for `<base>/<transform>/<key>`, and `"none"` for a
  plain bucket `<base>/<key>`. With `"none"`, `variants` and `defaultVariant` are ignored. A
  query-string layout (`?w=400`) is not supported.
- `getPublicIdFromUrl` defaults to the Cloudinary layout (`afterSegment: "upload"`, host
  `res.cloudinary.com`, extension stripped). A plain bucket passes `host`, `afterSegment: null` and
  `stripExtension: false` — for S3/R2 the object key keeps its extension and is what a delete needs.
  The Cloudinary defaults are intentional: an unknown layout returns the fallback instead of guessing.
- `ES_MESSAGES` is the default catalog, because byte-compatible migration of the origin app was a
  requirement. Pass `messages: { catalog: EN_MESSAGES }` for any other language.

Two naming traps, deliberately left documented instead of silently renamed:

- `next/` is a legacy name for a portable Web adapter. The `@/modules/image-uploads/next` entry point is
  what consumers import; a rename must keep it.
- `image-uploads` (plural) is the folder name. The host project's alias decides what it is called at the
  import site (`@/modules/image-uploads` here).

## 7. Room to grow without breaking the boundary

- **Another storage backend**: implement `ImageProvider`, register it in `resolveProvider`. No change to
  guards, handlers or core. For the URL helpers, configure `variantPlacement` / `afterSegment` instead
  of writing a parallel implementation.
- **Signed direct-to-storage uploads**: a second adapters package. Do not widen `ImageProvider` — add a
  dedicated port. The guard policies remain reusable, since authentication and authorization do not
  care how the bytes travel.
- **Edge runtime**: the handler and proxy are already portable; the Cloudinary provider is not. The
  replacement is a fetch-based signed upload, which is a new provider, not a patched one.

## 8. Provenance

Extracted from `car-agency-app`, where the upload path, its guards and its URL helpers had grown inside
route handlers and a site-coupled configuration file. The ODD record for that extraction — specs, tasks,
decisions and deliberate behaviour differences — lives there at `odd/tasks/image-uploads-module.md`.
The migration table is in `../README.md`.
