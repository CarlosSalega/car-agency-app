# Public Car Query Naming — Phase 1

## Objective

Make public car query intent explicit without changing admin or API behavior.

## Scope

- Add explicitly named public query functions in `src/lib/queries/cars.ts` while preserving existing behavior and cache policy.
- Migrate public consumers only: landing latest cars, public catalog, public detail/static params, and sitemap.
- Do not migrate admin pages, API routes, writes, or cache invalidation in this phase.
- Keep the existing public visibility invariant: `deletedAt: null` and `status in AVAILABLE, BY_APPOINTMENT`.

## Checks

- TypeScript-compatible exports and imports.
- Prettier and ESLint for changed files.
- `git diff --check`.
- Repository search confirms no public consumer still imports an ambiguous old query name.

## Route

Delegated direct writer because this changes the shared query module and multiple public consumers. TDD is disabled for this project; use ordinary functional checks.

## Progress

- [x] Added explicit public query names in `src/lib/queries/cars.ts`.
- [x] Kept compatibility aliases for non-public or external callers.
- [x] Migrated public consumers, including the latest-cars type import.
- [x] Preserved public visibility filters, includes, ordering, pagination, and cache settings.
- [x] Prettier, ESLint (with one pre-existing unused-import warning), and `git diff --check` passed.
- [x] `tsc --noEmit` remains blocked by the existing TypeScript/Prisma configuration issue.

## Tests

- [x] Added public query visibility tests in `src/lib/queries/__tests__/cars.test.ts`.
- [x] Added `prismaSafe` retry/error tests in `src/lib/__tests__/prisma-safe.test.ts`.
- [x] Focused Vitest run passed: 4 test files, 23 tests.
- [x] Prettier and ESLint passed for both new test files.

## Commit evidence

No commit yet. Commit only when explicitly requested.
