# Payment methods on car detail + form

## Objective

Show "Formas de pago" (Contado, BNA+, Crédito prendario) on each car's ficha técnica, between Características (specs grid) and Descripción, editable per car from the car form.

## Problem

Buyers can't see which payment methods each car accepts. The info lives outside the listing (asked by WhatsApp), so the ficha is incomplete.

## Why

- Single source of truth per car: admin sets it once in the form, buyers see it in the ficha.
- Multi-select matches reality: a car can accept Contado + Crédito prendario at once.
- At least one required avoids ficha with empty payment section.

## Scope

In:
- `prisma/schema.prisma` (new `PaymentMethod` enum + `paymentMethods` array on `Car`)
- `src/lib/validations/car.ts` (array validation, min 1)
- `src/types/car-form.ts`, `src/lib/utils/car-form-utils.ts` (payload + defaults + mapping)
- `src/components/cars/car-form/car-form-fields.tsx` (checkbox group, labels associated)
- `src/lib/constants/enum-options.ts` (labels: Contado, BNA+, Crédito prendario)
- `src/app/api/cars/route.ts`, `src/app/api/cars/[id]/route.ts` (persist lists)
- `src/components/cars/car-detail/car-detail-specs.tsx` (new section between grid and Descripción)

Out:
- `car-detail-info.tsx` (unused duplicate, not wired to page) — only touch if it becomes live.
- Changing URL contracts, filters, or search by payment method.
- Dropping `showBadge` column in Neon prod (separate authorization, unrelated).
- `prisma/migrations/` history discipline — project uses `db push`.

## Constraints

- No DB mutation (`db push`, `migrate`, `seed`) without explicit user authorization — schema edit is code-only until authorized to push.
- Conventional commits, no AI attribution.
- UI copy in Spanish; code identifiers and comments in English.
- Do not stage `.agents/`, `.claude/`, `skills-lock.json`, or `odd/`.
- TDD mode: unknown/no explicit config found → ordinary functional checks (vitest + eslint + tsc), no invented RED/GREEN ceremony.
- Route per task: all implementation tasks delegated (writer trigger: 2+ non-trivial files). Trigger evidence: 7+ files across schema/validation/form/API/detail.

## Design decisions (fixed)

1. Model: Prisma native enum array — `enum PaymentMethod { CONTADO, BNA_MAS, CREDITO_PRENDARIO }` + `paymentMethods PaymentMethod[] @default([])`. Follows existing native-enum + `images String[]` precedent.
2. Validation: `z.nativeEnum(PaymentMethod).array().min(1)` — multiple allowed, at least one required (user decision 2026-09-21).
3. Labels: `CONTADO → Contado`, `BNA_MAS → BNA+`, `CREDITO_PRENDARIO → Crédito prendario`.
4. Form: checkbox group (most a11y-correct for multi), `aria-invalid` + `aria-describedby` error pattern, labels associated.
5. Detail: new "Formas de pago" block after specs grid (`grid-cols-2 md:grid-cols-3`) and before Descripción conditional, chips/badges list. Hidden when empty (shouldn't happen once required, but guards legacy cars).
6. Legacy cars with `[]` show no section until edited.

## Checklist

- [x] T1 `schema.prisma`: add `PaymentMethod` enum + `paymentMethods` field. Route: delegated. Proof: `prisma generate` OK, client exposes `PaymentMethod`.
- [x] T2 validation/types/utils: `carSchema`, `CarPayload`, `carToFormValues`/`formValuesToPayload`/`getDefaultFormValues`, `enum-options.ts` labels. Route: delegated. Proof: temp vitest (6/6 green, then deleted) — accepts 1+/multiple, rejects []/unknown, labels cover all 3 members, defaults [].
- [x] T3 `car-form-fields.tsx`: checkbox group for paymentMethods with validation feedback. Route: delegated. Proof: eslint clean after removing `aria-invalid` from `role="group"` (kept on inputs).
- [x] T4 API routes: add `paymentMethods` to POST create + PUT update explicit field lists. Route: delegated. Proof: tsc clean on both routes.
- [x] T5 `car-detail-specs.tsx`: "Formas de pago" section between grid and Descripción. Route: delegated. Proof: tsc clean; `getCarBySlug` uses include (no select) so field flows to the component.
- [x] T6 Verify: `prisma generate`, `pnpm test`, `eslint` on touched files, `tsc --noEmit --ignoreDeprecations 5.0`, SSR check of detail page, work-unit commit. Route: delegated (writer runs verification). Proof: generate OK; test 5/5 green; eslint 0 errors 0 warnings on touched files; tsc shows only 2 pre-existing errors in untouched files (`tag-selector.tsx` references nonexistent `Tag` model + missing `@/lib/tag-utils`, `meta-pixel/events.ts` typing) — verified pre-existing via `git show HEAD:... | grep -c "model Tag"` = 0 and `git diff --name-only` excludes them; SSR data path verified (`getCarBySlug` include → full `car` prop); commit `feat(cars): add payment methods per car` on `feat/payment-methods`.
- [x] T7 Default Contado + Crédito: backfill DB rows with empty `paymentMethods` → `[CONTADO, CREDITO_PRENDARIO]` (only that column, user-authorized 2026-09-21, scope: empties only); pre-check both in new-car form defaults. Route: delegated. Proof: `getDefaultFormValues` now returns `[CONTADO, CREDITO_PRENDARIO]` (commit b726d4a on `fix/payment-methods-default`); backfill via `updateMany` with `isEmpty` filter only — before 156 empty / 156 total, updated 156, after 0 empty; `carToFormValues` mapping untouched; `pnpm test` 5/5 green, eslint clean on touched file, tsc clean on touched file (only 2 pre-existing errors in untouched tag-selector/meta-pixel).
- [x] T8 Payment badges legibility (user report 2026-09-22 with screenshot): `variant="secondary"` looked washed out. Changed to `variant="outline" + border-primary text-primary` in `car-detail-specs.tsx`. Route: inline (1 mechanical file). Proof: eslint clean. Commit 02c25e2 merged ff into main.
- [x] T9 Ficha dividers (user proposal 2026-09-22, orchestrator agreed): `border-t border-border pt-6` before Formas de pago and Descripción, matching the price block divider pattern. Route: inline (1 file, 2 lines). Proof: eslint clean. Commit 31780ad merged ff into main. Follow-up spacing report turned out to be stale dev CSS (hard reload fixed it, no code change).

## Acceptance criteria

- Ficha shows "Formas de pago" between Características grid and Descripción with the selected methods as chips.
- Car form edits payment methods per car, allows multiple, blocks submit with zero selected and shows inline error.
- POST creates and PUT updates persist `paymentMethods`; detail reflects the saved values after revalidation.
- `eslint` and `tsc` clean on touched files; existing tests green.
- No reference to payment methods remains hardcoded outside `enum-options.ts` + schema/enum.

## Checks

- `pnpm_config_verify_deps_before_run=warn pnpm exec prisma generate`
- `pnpm_config_verify_deps_before_run=warn pnpm test`
- `pnpm_config_verify_deps_before_run=warn pnpm exec eslint <touched files>`
- `pnpm_config_verify_deps_before_run=warn pnpm exec tsc --noEmit --ignoreDeprecations 5.0`

## Progress

- 2026-09-21: feature document created; exploration delegated (map returned: detail live file is car-detail-specs, form pattern is EnumSelect single + TagSelector multi precedent, workflow is db push). User decision: múltiple con al menos una obligatoria.
- 2026-09-21: T1-T6 implemented by single bounded writer on branch feat/payment-methods, commit a22dfa3 feat(cars): add payment methods per car (9 files, +170/-60). Verification: prisma generate OK, pnpm test 5/5 green, eslint 0/0 on touched files, tsc clean on touched files (2 pre-existing clusters in untouched tag-selector/meta-pixel). DB push NOT run — needs explicit authorization.
- 2026-09-21: runtime Prisma error confirmed (Car.paymentMethods missing in DB). User authorized db push with current .env, then ruled: prod has data, add-only, no drops. Plain push was correctly blocked (wanted to DROP showBadge with 156 non-null values). Fix: re-added showBadge Boolean @default(false) to schema only (code still ignores it), purely additive push exit 0, generate OK, paymentMethods exists (ARRAY), showBadge intact (156 non-null). Commit d703389 on feat/payment-methods. Next: restart dev server (Turbopack) so the ficha loads.
- 2026-09-21: DELIVERED. Verified all correct, merged feat/payment-methods into main (fast-forward e3b49ab..d703389, 9 files). Tests 5/5 green on main. No push to origin (user pushes when they want). Branch feat/payment-methods kept.
- 2026-09-21: PUSHED. User asked to commit/merge/push as Car Agency App for Vercel auto-deploy. Found one uncommitted change (status-badges: RESERVED orange→yellow, not from agents). Committed b2d5635 style(badges) and pushed origin main (e3b49ab..b2d5635, 3 commits). Local == remote. odd/ stays untracked on purpose.

## Delivery

- Strategy: `ask-on-risk` (default). Forecast: <400 authored lines (7 files, small diffs) → single work-unit commit expected.
- Slice: n/a (under budget).
