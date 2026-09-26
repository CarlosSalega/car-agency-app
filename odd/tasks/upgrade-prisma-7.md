# Upgrade Prisma ORM 6 to 7

## Objective

Move the project from Prisma 6.17.1 to Prisma 7, adopting the Rust-free
`prisma-client` generator with a mandatory output directory and a `pg` driver
adapter, without changing data, schema shape, or query behavior.

## Problem

The project is pinned to Prisma 6.17.1. Prisma 7 changes the client generation
model: the generated client no longer lives in `node_modules`, the generator
requires an explicit `output`, and the client is instantiated through a driver
adapter rather than reading the datasource URL itself.

## Verified surface in this repository

Established by reading the code and the official upgrade guide, not assumed:

- `prisma/schema.prisma` uses `provider = "prisma-client-js"` with **no
  `output`**, which is invalid in Prisma 7.
- `src/lib/db/db.ts` instantiates `new PrismaClient()` with no adapter and
  caches it on `globalThis` outside production.
- `datasource db` uses `url = env("DATABASE_URL")`.
- **31 files** under `src/` and `prisma/` import from `@prisma/client`. Most
  import generated _types_ (`Role`, `CarType`, `Currency`, `FuelType`,
  `Transmission`, `CarStatus`, `LinkTreeCategory`, the `Prisma` namespace) and a
  minority use enums as runtime values.
- There is **no `prisma.config.ts`**. Prisma 7 introduces it as the place where
  the CLI reads the datasource URL from.
- `.env` defines `DATABASE_URL` but **not** `DIRECT_URL`. The upgrade guide's
  example points the config at `DIRECT_URL`; this project has no separate
  direct/pooled pair, so the config must read `DATABASE_URL` instead.
- The project does not use `prisma.$use` middleware, which Prisma 7 removes.

## Destructive-seed risk

`prisma/seed.ts` performs a full destructive reset. It must **not** be run as
part of this upgrade. Verification uses read-only queries against the existing
test database. Any destructive run requires separate, explicit authorization.

## Scope

In scope: Prisma and adapter dependencies, `prisma/schema.prisma`,
`prisma.config.ts`, `src/lib/db/db.ts`, and the import path in every file that
references the generated client.

Out of scope: schema changes, data changes, query logic changes, Next.js, the UI
layer, and running the seed.

## Tasks

- [x] T1 — Record the baseline: build, typecheck, tests, plus a read-only
      database query to prove the client connects before the change.
- [x] T2 — Install `prisma@7`, `@prisma/adapter-pg` and `pg`; remove the
      `@prisma/client` runtime import dependency where it is no longer needed.
- [x] T3 — Switch the generator to `prisma-client` with a required `output`,
      and add `prisma.config.ts` so the CLI resolves the datasource URL.
- [x] T4 — Instantiate the client through `PrismaPg` in `src/lib/db/db.ts`,
      preserving the existing `globalThis` development cache.
- [x] T5 — Repoint every `@prisma/client` import at the generated output.
- [x] T6 — Verify: generate, build, typecheck, tests, and a read-only query.

## Authorized scope

Data layer and its imports only. No schema or data mutation, no destructive
seed, no UI change.

## Acceptance criteria

- `prisma generate` succeeds and writes the client to the declared `output`.
- `prisma validate` and `prisma format` pass.
- `pnpm build` exits 0.
- `pnpm exec tsc --noEmit` exits 0 after the build.
- `pnpm test` passes with no reduction in test count.
- A read-only query against the test database returns data, proving the
  adapter-based client connects.
- `pnpm exec prettier --check .` exits 0.
- No new ESLint errors.

## Applicable checks

```
pnpm exec prisma validate
pnpm exec prisma generate
pnpm build
pnpm exec tsc --noEmit
pnpm test
pnpm exec prettier --check .
```

Read-only connectivity check: count rows through the new client without
mutating anything.

## Route and trigger evidence

Direct inline. The change is mechanical and fully determined by the official
guide, but it touches more than two files, so the import repointing was handled
as one scripted pass followed by verification rather than file by file, to keep
the 31 edits consistent. No unresolved design decision remained after the
output-location and alias strategy were settled against the real generated
output.

## TDD mode

Not enabled for this project; no TDD instruction was active in this session.
Ordinary functional checks are used. A data-layer migration has no new
behavior to test-first; the existing suite plus a real read-only query is the
honest gate.

## Progress

T1 through T6 complete. Verification below.

## Verification evidence

- Baseline before the change: `build` exit 0, `tsc --noEmit` exit 0, `test` 5
  files / 36 tests, and a read-only `prisma.car.count()` returned rows from the
  test database, proving the pre-migration client connected.
- `prisma` 6.17.1 to 7.x, plus `@prisma/adapter-pg` and `pg`.
- Generator switched to `prisma-client` with `output = "../src/generated/prisma"`.
  The generated output is committed-ignored, not committed.
- `prisma.config.ts` added, reading `DATABASE_URL` via `env()` because this
  project has no `DIRECT_URL`. The config is TypeScript and needs the
  `prisma/config` import.
- `src/lib/db/db.ts` now builds a `PrismaPg` adapter from `DATABASE_URL` and
  passes it to `PrismaClient`, keeping the `globalThis` development cache so
  hot reloads do not exhaust connections.
- All 31 imports repointed from `@prisma/client` to the generated client.
  Verified afterwards that zero references to the old path remain.
- `prisma validate` and `prisma generate` both succeed.
- `pnpm build` exit 0, `pnpm exec tsc --noEmit` after build exit 0, `pnpm test`
  5 files / 36 tests pass, `prettier --check .` exit 0, ESLint unchanged at 35
  problems (11 errors, 24 warnings), all pre-existing.
- Post-migration read-only `prisma.car.count()` returned a non-zero count from
  the test database, proving the adapter-based client connects and reads.

## Next step

Open a PR. Merging is the user's decision. The destructive seed has **not** been
run and still requires explicit authorization separately.
