# Admin Car Query Naming — Phase 1

## Objective
Centralize admin car read queries in `src/lib/queries/cars.ts` with explicit `getAdmin*` names without changing current admin behavior.

## Scope
- Add `getAdminCarsList`, `getAdminCarsCount`, `getAdminCarForEdit`, and `getAdminCarStats`.
- Migrate `src/app/admin/cars/page.tsx`, `src/app/admin/cars/[id]/edit/page.tsx`, and `src/app/admin/page.tsx` to those functions.
- Preserve current pagination, ordering, includes, soft-delete filters, status counts, and the current edit behavior for soft-deleted cars.
- Do not migrate API mutation reads or change authorization/visibility behavior.

## Checks
- Focused Vitest coverage for admin status/delete filters, pagination, includes, stats, and edit lookup.
- Prettier, ESLint, and `git diff --check`.
- `pnpm test` for the focused query tests.

## Route
Delegated direct writer because this changes the shared query module, three admin pages, and tests. TDD is disabled for this project; ordinary functional checks are required.

## Progress
- [x] Added explicit `getAdminCarsList`, `getAdminCarsCount`, `getAdminCarForEdit`, and `getAdminCarStats` functions.
- [x] Migrated the admin list, edit, and dashboard pages away from direct Prisma reads.
- [x] Preserved uncached/dynamic behavior, status counts, soft-delete behavior, includes, ordering, and pagination.
- [x] Added admin query coverage; focused Vitest run passed with 4 files and 27 tests.
- [x] Prettier, ESLint, and `git diff --check` passed. Two pre-existing unused-import warnings remain in `src/app/admin/page.tsx`.

## Pending audit notes
- `GET /api/cars/[id]`: policy is not classified yet. Before changing it, determine whether the route is public, authenticated, or admin-only; whether non-public/deleted cars may be returned; and add visibility/authorization tests.
- `PUT`/`DELETE` in `src/app/api/cars/[id]/route.ts`: keep direct reads in the route for now because they are part of mutation authorization and transaction boundaries. Do not migrate them blindly to `getAdmin*`.
- `DELETE /api/upload`: the direct image-key lookup is an authorization query, not a normal admin read. If revisited, use a narrowly named helper such as `getCarOwnersByImageKey` and preserve the current permission behavior.
- `src/lib/cars/slug.ts`: the direct slug lookup intentionally includes historical soft-deleted cars to avoid reusing slugs. Keep this invariant isolated.
- `getAdminCarStats()` currently preserves the pre-existing `recentLogs` query, but the dashboard does not render those logs. Decide later whether to remove it, use it, or split it into `getAdminDashboardStats()` and `getAdminRecentLogs()`.
- Before revisiting any item, corroborate that the current call structure still exists; do not repeat the full analysis from this note.

## Commit evidence
No commit yet. Commit only when explicitly requested.
