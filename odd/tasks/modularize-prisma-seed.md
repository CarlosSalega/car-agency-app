# Modularize Prisma seed and image loading

## Objective

Refactor the destructive test seed into a modular bootstrap pipeline that can later be extended for real-data imports, while loading vehicle images from `public/autos` through Cloudinary.

## Problem

`prisma/seed.ts` currently owns configuration, filesystem matching, Cloudinary uploads, destructive reset, all entity creation, and reporting. This makes the seed difficult to test and impossible to reuse cleanly when real data loading is introduced.

## Scope

- Keep the current destructive reset behavior for test databases.
- Extract seed data into typed modules with deterministic vehicle keys and slugs.
- Add an explicit vehicle/image manifest while retaining filename matching as a fallback.
- Separate Prisma repositories, image indexing/matching, Cloudinary access, and orchestration.
- Add validation and summary reporting for unmatched images and upload failures.
- Add focused tests for manifest validation and image matching.
- Do not implement production backup, upsert mode, queues, or real-data import yet.

## Constraints

- Existing app behavior and database schema remain unchanged unless a seed-only requirement is found.
- No credentials may be printed.
- Cloudinary remains the current image provider.
- The workspace has no Git metadata, so commits cannot be created here.

## Tasks

- [x] Extract configuration and shared seed types.
- [x] Extract users, sellers, link-tree, cars, brands, models, and image manifest data.
- [x] Add repositories for seed persistence.
- [x] Extract local image indexing, matching, and Cloudinary services.
- [x] Make `prisma/seed.ts` a thin destructive orchestrator with validation and summary output.
- [x] Add focused unit tests.
- [x] Bound the pre-reset Cloudinary ping and bulk-create deduplicated brands/models.
- [x] Run formatting, lint, and Vitest checks.

## Acceptance criteria

- `prisma/seed.ts` contains orchestration only.
- Seed entities use deterministic identifiers where applicable.
- Every expected image mapping is explicit; unmatched files are reported.
- Cloudinary upload failures and placeholder usage are visible in the summary.
- The test command passes.
- The lint command passes for the changed Prisma files; the repository-wide lint command remains blocked by pre-existing errors in `src/`.
- No seed or upload is run during validation.

## Progress

- 2026-09-25: Implemented modular seed data, repositories, image manifest/indexing/Cloudinary services, and a thin destructive orchestrator.
- 2026-09-25: Added focused manifest tests; `pnpm test` passed (30 tests), targeted Prisma ESLint and Prettier checks passed, and TypeScript reached unrelated pre-existing errors after bypassing the repository's invalid `ignoreDeprecations` setting.
- 2026-09-25: Executed the authorized test flow. Added `dotenv/config`, declared `dotenv`, aligned Prisma datasource env vars with the project `.env` (`DATABASE_URL`), and regenerated Prisma Client.
- 2026-09-25: `pnpm db:push` completed successfully against the test database. The first seed attempt timed out after partial brand/model population; a retry reset the database and failed before car creation because Cloudinary returned HTTP 401 `Invalid cloud_name`.
- 2026-09-25: After correcting the Cloudinary cloud name, added a 10-second preflight ping before the destructive reset and replaced sequential brand/model upserts with bulk creation. Seed completed successfully: 1 user, 22 brands, 223 models, 1 seller, 5 links, 6 cars, 1 log, 0 visits. Nine vehicle images uploaded; 53 local image files remain unmatched because the current test manifest has no vehicle entries for them; 4 cars use the placeholder; 0 upload failures.
- 2026-09-25: Verified persisted Cloudinary public IDs for Peugeot 208 (4) and Toyota Corolla (5), with `car-agency-app/placeholder` for Renault Clio, Peugeot 207, Fiat Palio, and Ford Focus.
- 2026-09-25: Bounded the pre-reset `cloudinary.api.ping()` check to 10 seconds with the existing timeout helper. Replaced per-record brand/model upserts with two Prisma `createMany` calls over deduplicated inputs, using client-generated UUIDs to preserve the existing deterministic name-key maps and `createdById` relationship.
- 2026-09-25: Targeted verification passed: Prettier check matched both changed seed modules; ESLint with `--no-ignore` completed with no output/errors; focused Vitest passed 1 file and 3 tests. Vitest emitted Node `DEP0205` for deprecated `module.register()`. No new test was added because the changed repository/database and Cloudinary timeout paths require external operation mocks or integration setup that would be disproportionate for this focused fix. The seed, `db push`, and Cloudinary operations were not run.
