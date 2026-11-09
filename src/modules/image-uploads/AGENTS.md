# AGENTS.md — image-uploads

Rules for an AI agent working **inside** this module. Read this before touching the sources.

Deep reasoning (hexagonal mapping, feature-based placement, antipatterns, portability matrix):
`docs/architecture.md`. Human usage and the migration table: `README.md`.

This folder is not a package: no `package.json`, no build step, no lockfile. It is used from inside the
host project, so every command runs from the host project's root with a path filter.

Verify any change with:

```bash
pnpm exec vitest run src/modules/image-uploads/tests   # 153 passed + 2 skipped
pnpm exec tsc --noEmit
```

## What this is

A framework-agnostic image upload pipeline extracted from `car-agency-app`: a `ImageProvider` port,
pure guard policies, and thin HTTP adapters. It owns the **order** of the security-relevant steps and
the **normalized failure codes**. The consuming application owns identity, ownership and copy.

```
authenticate → validate file → authorize delete → provider
    (401)         (400/413)         (403)          (injected)
```

## Non-negotiable invariants

Violating any of these is a defect, even if the tests pass.

1. **No module-level configuration read.** Never call `process.env`, `cloudinary.config()` or any
   global at import time. Everything arrives as a factory parameter. Import must stay side-effect
   free.
2. **No client or tenant data inside this folder.** No site name, dealership, folder, brand or feature
   name. `folder` and `tags` come from `defaults` or `uploadOptions`, supplied by the deployment.
   This was the original code's defect: `cloudinary-config.ts` imported `@/site/active`.
3. **`core/` and `guards/` never touch transport.** No `Request`, `Response`, `Headers`,
   `FormData`, no framework import. They are pure functions and must stay testable without a server.
   `new URL` is allowed (Web standard, present in Node too).
4. **`next/` uses Web standards only.** `Response.json`, `Headers`, `FormData`. **Never add a
   `next/server` import**, despite the folder name — see the naming note below.
5. **Delete fails closed.** Omitting `authorizeDelete` must deny, never allow. Do not add a
   permissive default "for convenience".
6. **Size is checked twice, and type before size.** A declared `content-length` above
   `maxBytes + multipartOverheadBytes` is rejected with 413 _before_ the body is parsed; the
   post-parse check stays authoritative. Within validation, type is checked before size, so an
   oversized non-image is `INVALID_TYPE`, not `TOO_LARGE`.
7. **A rejection touches nothing.** No refused request may reach `provider.upload` or
   `provider.delete`. Tests assert this explicitly; keep them doing so.
8. **`ImageProvider.delete` reports, never throws.** Return `{ success: false, error }`. A batch
   delete of twenty assets must delete nineteen and say so.
9. **Failures carry a code, not a sentence.** Throw/propagate `ImageError` with an `ImageErrorCode`.
   Adapters map code → status (`statusForImageError`) and code → localized string
   (`createMessageResolver`). Never build user-facing copy inside `core/` or `providers/`.
10. **The provider is a composition-root singleton.** Cloudinary v2 keeps credentials in
    process-global configuration (it exposes no `Cloudinary` instance class — verified), so
    `createCloudinaryProvider` is called **once per process**, in the consuming app's composition
    root, not per feature and not per request.
11. **Both message catalogs stay complete.** `ES_MESSAGES` is the default and is byte-for-byte
    identical to `car-agency-app`'s copy — migrating that app must not change one API response. Any
    new `ImageErrorCode` requires an entry in `ES_MESSAGES` **and** `EN_MESSAGES`; a test compares
    the key sets.
12. **Do not widen `ImageProvider` with provider-specific features** (`getSignedUrl`,
    `createUploadWidget`, account statistics). Those belong in that provider's own file and its own
    entry point.
13. **Never weaken the guards to make a test pass.** Fix the code or the caller.
14. **The public surface is `index.ts` plus the folders `core/`, `guards/`, `next/`, `providers/`,
    `adapters/`.** There is no `exports` map to edit — the files are the surface. Adding an entry point
    means adding a file, plus a row in the entry-point table in `README.md`.
15. **SVG is blocked by default, in two layers.** `DEFAULT_BLOCKED_MIME_TYPES` contains
    `image/svg+xml`, and a blocked type is evaluated _before_ the allow-prefix/allow-list check, so it
    can never be accepted; a deployment opts back in with an explicit `blockedMimeTypes: []`. The
    proxy's sandboxing `contentSecurityPolicy` is the second layer, because an SVG served from our own
    origin is stored XSS. Do not remove either one as a "cleanup".
16. **Batch deletes stay bounded.** They go through `mapWithConcurrency`. Never reintroduce an
    unbounded `Promise.all`/`allSettled` over keys: a batch of 10.000 would fire 10.000 simultaneous
    provider calls and hit a rate limit.
17. **Nothing inside this folder imports from the host application.** No `@/…`, no `@generated/…`, no
    relative path that climbs out of the folder. The only bare specifiers allowed are `cloudinary` and
    `node:*`. `tests/boundaries.test.ts` walks every `.ts` file here and fails naming the offending file
    and specifier. This is the invariant an in-tree module breaks first, and it is exactly what broke
    here before: `cloudinary-config.ts` imported `@/site/active`.

## Dependency direction

```
features/*  ──imports──▶  image-uploads          (port, adapters, policies)
    │                          ▲
    └── implements ────────────┘                getActor, authorizeDelete
```

`image-uploads` must never import from a feature, an app layer, or client configuration. If a change
requires the module to know your domain model, the change belongs in the caller.

## Where this module sits

| Architecture                         | Placement                                                                                                                                                                                      |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Layered (what `car-agency-app` uses) | This folder for the pipeline; `src/lib/images/` is the app's composition root (provider and service); the route composes the handler                                                           |
| **Feature-based / FSD**              | `shared/image-uploads` — a cross-cutting slice, never inside a feature. Each feature composes its own handler with its own `authorizeDelete`; the provider is built once in a composition root |
| Hexagonal                            | Its native shape: `ImageProvider` is an output port, `getActor`/`authorizeDelete` are boundary ports                                                                                           |
| Clean Architecture                   | Interface-adapters + application policy. Never in entities                                                                                                                                     |

Full trees and the three antipatterns: `docs/architecture.md`.

## Portability — do not overstate this

| Entry point                                    | Runtime                  | Notes                                            |
| ---------------------------------------------- | ------------------------ | ------------------------------------------------ |
| `@/modules/image-uploads` (core, guards)       | anywhere                 | pure TypeScript, no globals                      |
| `@/modules/image-uploads/next`                 | any Web-standard runtime | Next, Remix, Hono, Bun, Deno, Workers            |
| `@/modules/image-uploads/adapters/better-auth` | anywhere                 | structural types, no `better-auth` import        |
| `@/modules/image-uploads/providers/cloudinary` | **Node only**            | uses `Buffer` and the SDK's Node `crypto`/`http` |

Known limits, documented rather than hidden:

- `cloudinary` v2 has no instance-scoped credentials, so one account per process.
- `DEFAULT_VARIANTS` are Cloudinary transformation strings. The resolver covers two URL layouts:
  `variantPlacement: "segment"` (default — Cloudinary, Cloudflare Images) and `"none"` for a plain
  bucket (`<base>/<key>`). A query-string layout (`?w=400`) is **not** covered: add a new option for it,
  do not overload `variants`.
- `getPublicIdFromUrl` defaults to `afterSegment: "upload"` and host `res.cloudinary.com`, i.e. the
  Cloudinary layout. For a plain bucket pass `host`, `afterSegment: null` and `stripExtension: false`.
  **Do not make `null` the default**: refusing to guess at an unknown layout is the safe behaviour.
- No rate limiting. If the upload endpoint is public, add it in the adapter or the hosting layer.
- The content-length preflight only helps when the client _declares_ a length. A chunked body without
  it still reaches `formData()` and is caught by the post-parse check, after being buffered. Set a
  request body-size limit on the host as well; this module cannot enforce that by itself.
- A client disconnect on the proxy answers `500 UPSTREAM_FAILED`, the same body as an upstream failure;
  only the logged reason differs. Only a timeout is distinguished, as `504 TIMEOUT`.
- `concurrency` and `timeoutMs` are read once, when the provider or handler is built — not per call.
- **The type checker does not protect the Cloudinary options.** `UploadApiOptions` ends with
  `[futureKey: string]: any`, and `timeout` (byte-timeout for `upload_stream`) and `tags` are not even
  declared in `cloudinary@2.11.0`'s `.d.ts`, though both are honoured at runtime (`lib/uploader.js`
  reads `options.timeout`, `lib/utils/index.js` maps `options.tags`). A typed assignment therefore passes
  with a bogus key. Only the live contract suite (`tests/cloudinary-contract.test.ts`, run with real
  credentials) proves the shape. Keep the emitted
  key-set assertions in `tests/cloudinary-contract.test.ts` current, and do not "fix" the gap by adding
  casts.
- `ES_MESSAGES` being the default is deliberate, not an oversight.

## Naming note

`next/` is a **legacy name**. The code inside is web-standard and portable. Do not "fix" it by
importing Next.js APIs, and do not rename it without keeping the `@/modules/image-uploads/next` entry
point — that would break every consumer.

## Maturity: what is proven and what is not

Assessed once the migration was merged. Read this before assuming the module is finished.

| Area                | State             | Missing                                                                     |
| ------------------- | ----------------- | --------------------------------------------------------------------------- |
| Design and boundary | mature            | —                                                                           |
| Coverage            | strong but uneven | the live contract suite skips by default                                    |
| Operation           | immature          | no CI in the host repository, console logging, no metrics, no rate limiting |
| External contract   | unproven          | exactly one consumer has ever used it                                       |
| Documentation       | above average     | —                                                                           |
| Versioning          | none              | irrelevant while it is copied, not published                                |

The three gaps that matter, in the order worth fixing:

1. **No CI in the host repository.** The suite runs when somebody remembers. Everything proven so far —
   the content-length preflight, the SVG block, the import boundary, the 200 on an orphan delete —
   decays silently from the first day nobody runs it. This module's own repository had CI; that
   repository is archived.
2. **The live contract suite is opt-in.** It passed 6/6 against the real account once and reports as
   `skipped` in the normal run, so a Cloudinary change to an option's shape will not be noticed. Either
   schedule it or make it a documented release step; today it is neither.
3. **One consumer proves nothing about the boundary.** "Copy-pasteable to another project" is a claim
   about a second project, not about this code. Whether `getActor` and `authorizeDelete` are the right
   extension points stays unknown until someone copies it and finds out.

A fourth, smaller one: `tests/boundaries.test.ts` guards the imports into this folder, and nothing
prevents the _interface_ from growing provider-specific methods. Invariant 12 is a convention, not a
check.

Known technical debt, left on purpose:

- A chunked upload with no `content-length` still reaches `formData()` and is buffered. Set a request
  body limit on the host; the module cannot enforce that itself.
- No retry or backoff on transient provider failures.
- The whole file is buffered in memory through `arrayBuffer()`. Fine at the current 15 MB ceiling, wrong
  if that ceiling grows.
- A client disconnect on the proxy answers `500 UPSTREAM_FAILED`; only a timeout is distinguished, as
  `504`.

## Working notes

- `cloudinary` is a dependency of the host project, not of this folder: only code importing
  `providers/cloudinary.ts` needs it installed.
- Tests live in `tests/`, mirroring the entry points by folder, not by file. Every new guard or provider
  branch needs a test that asserts the **status, the exact response body, and that the provider was
  not called** on refusal. `tests/boundaries.test.ts` covers the import-direction rule; keep it green
  rather than relaxing it.
- The folder is copy-pasteable: no `package.json`, no build step, no lockfile, no generated output. If
  a change needs one of those, the change belongs to the host project.
- Provenance: extracted from `car-agency-app`; the ODD record for the extraction lives there at
  `odd/tasks/image-uploads-module.md`.
