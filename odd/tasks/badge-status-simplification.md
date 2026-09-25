# Badge status simplification

## Objective

Drive the car status badge (listing card + car detail) purely from `CarStatus`,
and remove the optional `showBadge` toggle plus its database column.

## Problem

The first implementation added a `showBadge` boolean column, a `Switch` in the
car form, and a conditional helper so the badge could be hidden per car. The
owner decided the simpler model is enough: the badge always reflects the car
status, and the admin changes it only through the existing status `Select`.

## Why

- One single control for the admin instead of two coordinated ones (status
  select + badge switch).
- Removes a column, a UI control, a validation field, a payload field, and the
  conditional rendering logic.
- `Con cita previa` already lives in the status `Select`, so the badge follows
  it for free.

## Scope

In:

- `prisma/schema.prisma` (drop `showBadge`)
- `prisma/migrations/20260918120000_by_appointment_show_badge/` (final state)
- `src/lib/validations/car.ts`, `src/types/car-form.ts`,
  `src/lib/utils/car-form-utils.ts`
- `src/app/api/cars/route.ts`, `src/app/api/cars/[id]/route.ts`
- `src/components/status-badges.tsx`
- `src/components/cars/car-card.tsx`
- `src/components/cars/car-detail/car-detail-info.tsx`
- `src/components/cars/car-detail/car-detail-specs.tsx`
- `src/components/cars/car-form/car-form-fields.tsx`
- `src/components/ui/switch.tsx` (delete, only consumer is the form)

Out:

- Dropping the `showBadge` column in Neon prod (separate authorization).
- The `Precio` -> `Entrega Mínima` rename (unrelated, rides in the same working
  tree; decided at commit time).
- Admin status counters and the public listing that already include
  `BY_APPOINTMENT`.

## Constraints

- No DB mutation (no `db push`, no `migrate`, no `seed`) without explicit
  authorization.
- Conventional commits, no AI attribution.
- UI copy in Spanish (project convention).

## Checklist

- [x] B1 Remove `showBadge` from `prisma/schema.prisma` and run `prisma generate`.
- [x] B2 Remove `showBadge` from validation, types, `car-form-utils`, and both API routes.
- [x] B3 Delete `src/components/ui/switch.tsx` and remove the switch block plus its import from `car-form-fields.tsx`.
- [x] B4 Rework `status-badges.tsx`: replace `getVisibleCarBadge({status, showBadge})` with `getCarBadge(status)` that always returns the badge for the status from `carStatusMap`; remove the duplicated `carOverlayBadgeMap`.
- [x] B5 Update `car-card.tsx`, `car-detail-info.tsx`, `car-detail-specs.tsx` to use `getCarBadge` (card keeps uppercase presentation).
- [x] B6 Bring the migration folder to its final state (enum addition only) and rename it to `20260918120000_by_appointment_status`.
- [x] B7 Verify: `vitest`, `eslint` on touched files, `prisma generate`.
- [x] B8 Commit.

## Acceptance criteria

- No reference to `showBadge`, `getVisibleCarBadge`, or `Switch` remains in `src/` or `prisma/`.
- Card and detail show the status badge from `CarStatus`: `Disponible` (green)
  for `AVAILABLE`, `Con cita previa` (orange) for `BY_APPOINTMENT`, and the
  matching badge for the remaining statuses.
- Existing tests stay green.

## Checks

- `pnpm_config_verify_deps_before_run=warn pnpm test`
- `pnpm_config_verify_deps_before_run=warn pnpm exec eslint <touched files>`
- `pnpm_config_verify_deps_before_run=warn pnpm exec prisma generate`

## Progress

- 2026-09-18: feature document created, implementation delegated.
- 2026-09-18: B1-B6 applied by delegated writer. Verification evidence:
  - `pnpm exec prisma generate` -> Generated Prisma Client (v6.17.1).
  - `pnpm test` -> 1 file, 5 tests passed (re-run by the orchestrator).
  - `eslint` on the 10 touched files -> exit 0.
  - `rg "showBadge|getVisibleCarBadge|carOverlayBadgeMap|ui/switch" src prisma` -> zero matches.
  - Native risk assessment (`gentle-ai review assess`): medium, 14 changed paths, 228 changed lines.
  - Independent read-only verification: verified, no blockers.
- 2026-09-18: commits created (local only, not pushed):
  - `41a60b1 refactor(ui): rename Precio to Entrega Mínima`
  - `cac9bc0 feat(cars): drive the car badge from the car status`
- The `odd/` feature document stays untracked/local on purpose.
- Open caveats (not part of this task): `prisma/migrations/migration_lock.toml` is absent
  (tooling only, the project uses `db push`); the enum migration is not idempotent; the
  `showBadge` column remains physically in Neon prod and dropping it needs separate
  authorization. Not pushed to `main` yet.
