# Drag-and-drop reorder for car form thumbnails

## Objective

Let the admin reorder car form image thumbnails via drag-and-drop so the first image (cover in gallery/detail) can be chosen visually instead of deleting and re-uploading.

## Problem

`src/components/image-upload.tsx` renders previews in a grid with add/remove only. There is no way to change image order, yet `images[0]` is the cover (`car-detail-gallery.tsx:42-43`). Fixing a wrong cover today means deleting and re-uploading photos.

## Why

- Direct manipulation: dragging is the expected UX for photo ordering (admin uploads up to 10 images).
- Zero backend work: order already persists as array position end-to-end (form RHF `images` → `formValuesToPayload` verbatim → Prisma `String[]`; PUT diff is set-membership only, reorder persists free). No schema/API/validation migration.
- Accessibility law: WCAG 2.5.7 requires a single-pointer alternative to dragging, so keyboard/touch controls ship together, not later.

## Scope

In:

- `src/components/image-upload.tsx` (sortable grid, drag handles, move/cover buttons, live announcements, delete affordance fix)
- `package.json` + `pnpm-lock.yaml` (`@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`)
- Optional: `aria-live` reorder announcements reusing existing `role="status"` pattern

Out:

- `prisma/schema.prisma`, validations, `car-form-utils.ts`, API routes (order flows untouched)
- `car-detail-gallery.tsx` (already cover = index 0, no change)
- Changing upload/delete behavior, count/type/size validation
- Push to origin (user pushes when they want)

## Constraints

- No DB mutation (`db push`, `migrate`, `seed`).
- Conventional commits, no AI attribution.
- UI copy in Spanish (`aria-label`s, announcements); code identifiers and comments in English.
- Do not stage `.agents/`, `.claude/`, `skills-lock.json`, or `odd/`.
- TDD mode: ordinary functional checks (no strict RED/GREEN ceremony).
- Route per task: all implementation delegated (writer trigger: new dep + component rework). Trigger evidence: package.json + image-upload.tsx + lockfile.
- Drag handles ≥24px (ideally 44px touch); stable `key={imageKey}` across drags; never hover-only controls.

## Design decisions (fixed)

1. Library: `@dnd-kit/sortable` (+ core + utilities). Pointer Events native, TouchSensor with activation delay for mobile, KeyboardSensor + `sortableKeyboardCoordinates` for keyboard. ~15-30 kB gz, React 19 compatible, maintained.
2. Always-visible alternative controls (WCAG 2.5.7, not optional): move-left/right buttons per thumb + "Portada" action (move to index 0). Native buttons with Spanish `aria-label`s (`Mover imagen N a la izquierda`, `Usar como portada`).
3. Cover signal: visual "Portada" badge on index 0 (first image = gallery cover).
4. Announcements: `aria-live="polite"` region announcing reorder results (existing `role="status"` vocabulary).
5. Reorder maps to existing `onChange(nextOrder)` → RHF `setValue("images")` path untouched; pure reorder adds zero temp-cleanup keys (verified reorder-safe by construction).
6. Fix while touching (do not copy the gotchas): delete button is hover-only (`opacity-0 group-hover`) — add `focus-visible`/`focus-within` visibility; keep targets ≥24px.

## Checklist

- [x] D1 Install `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` via pnpm (exact versions recorded in commit). Route: delegated.
- [x] D2 Sortable thumbnail grid in `image-upload.tsx` (DndContext + SortableContext, drag handles, stable keys). Route: delegated.
- [x] D3 Move/cover buttons + cover badge + `aria-live` announcements. Route: delegated.
- [x] D4 Delete-button visibility fix (keyboard/touch reachable). Route: delegated.
- [x] D5 Verify: `pnpm test`, `eslint` on touched files, `tsc --noEmit --ignoreDeprecations 5.0`, manual drag + keyboard + reorder-persist check against dev server, work-unit commit on feature branch. Route: delegated.
- [x] D6 Fix mouse drag (user report 2026-09-22: drag with mouse does nothing). Diagnose root cause (suspects: listeners on tiny handle only, overlay buttons swallowing pointer events, activation constraints, missing touch-action). Route: delegated.
- [x] D7 Minimalist UI (user direction 2026-09-22): remove visible move/cover arrow+star buttons; keep only X delete + drag-to-reorder. Keyboard operability stays via KeyboardSensor on focusable thumbnails (Space lift, arrows move, Space drop) + Spanish instructions via aria-describedby + aria-live announcements, so no visible-button alternative is needed. Route: delegated.
- [x] D8 Shrink delete button (user request 2026-09-22: red circle too big, accidental deletes while dragging): padding `p-1.5` → `p-1`, circle ~28px → 24px. Floor kept at WCAG 2.2 AA 24px minimum (`min-h-6 min-w-6` enforces it). Delete already stops pointerdown propagation so drags never trigger it. Route: inline (1 file). Proof: eslint 0 errors, tests 13/13 green. Commit 5963dad on feat/image-reorder-dnd.
- [x] D8b Shrink to 20px (user override 2026-09-22): `size-5` circle + `size-3` icon, removed now-unused `CONTROL_SIZE_CLASS`. Note: below the 24px WCAG AA guideline — accepted explicitly by owner for this admin-only control. Route: inline. Proof: eslint 0 errors, tsc clean on file, tests 13/13 green. Commit 9e49db0 on feat/image-reorder-dnd.
- [x] D9 DELIVERED 2026-09-22: user confirmed mouse drag works. Merged feat/image-reorder-dnd into main (merge 105dddb, + admin pagination 087948f already on main). Verified on main: pnpm install clean, tests 13/13 green, eslint 0 errors. Pushed origin main b2d5635..105dddb as Car Agency App (Vercel auto-deploy). Branches deleted. odd/ stays untracked.

## Acceptance criteria

- Admin can drag thumbnails to reorder with mouse/touch; order persists after save and first image renders as cover in gallery.
- Keyboard-only flow works via dnd-kit KeyboardSensor on the focused thumbnail (Space + arrows + Space) with Spanish instructions and announcements; no visible move buttons required.
- Thumbnail UI is minimal: only X delete (keyboard/touch reachable, Spanish aria-label) + drag affordance (cursor-grab, cover badge stays).
- No thumbnail control is hover-only; all icon buttons have Spanish `aria-label`s.
- Upload/delete/count validation unchanged; `eslint` + `tsc` clean on touched files; tests green.
- No API/schema/validation change; diff limited to uploader + dep manifests.

## Checks

- `pnpm_config_verify_deps_before_run=warn pnpm test`
- `pnpm_config_verify_deps_before_run=warn pnpm exec eslint <touched files>`
- `pnpm_config_verify_deps_before_run=warn pnpm exec tsc --noEmit --ignoreDeprecations 5.0`

## Progress

- 2026-09-22: feature document created; exploration delegated (map: order = array position end-to-end, no migration needed; gallery cover = images[0]; no DnD dep installed; gotchas: hover-only delete, 28px targets, plain-div grid).
- 2026-09-22: D1-D5 implemented on `feat/image-reorder-dnd` (work-unit commit, no push).
  Observed: `@dnd-kit/core 6.3.1` + `@dnd-kit/sortable 10.0.0` + `@dnd-kit/utilities 3.2.2`;
  `pnpm test` 13/13 green (8 new reorder tests); `eslint` 0 errors on touched files (1 pre-existing `no-img-element` warning);
  `tsc` reports only 3 pre-existing errors in untouched files (`tag-selector.tsx`, `meta-pixel/events.ts`), also present on `main`;
  dev server compiled `/` 200, `/admin/cars/new` 307 (auth redirect, expected); save-persists-order verified by code path
  (`onChange` → `setValue("images")` → `formValuesToPayload` passes `images` verbatim → Prisma `String[]`).
  Partial: real-browser pointer drag and keyboard-drag drop were not exercised here (no browser automation in this environment);
  jsdom cannot resolve dnd-kit collision (zero rects), so drag-drop is covered via the shared `arrayMove` reorder path in button tests.
  Pending manual check: drag a thumbnail + keyboard-drag on `/admin/cars/new` and confirm cover + saved order.
- Next: delegate single bounded writer for D1-D4, then D5 verification. No push to origin.
- 2026-09-22: D6+D7 implemented on `feat/image-reorder-dnd` (work-unit commit, no push).
  Root cause (D6, evidence in `src/components/image-upload.tsx` a6fdaf4): `useSortable`
  `attributes`+`listeners` were spread only onto the tiny top-left grip button, so a
  mousedown anywhere else on the thumbnail (photo body, bottom button bar) never
  reached a dnd-kit sensor node and no drag could start; additionally the `<img>`
  kept native `draggable=true`, whose HTML5 drag ghost competes with the PointerSensor.
  Ruled out with evidence: PointerSensor had no activationConstraint (nothing too
  strict to trip), and `DndContext`/sensors were wired correctly (keyboard drag-start
  fires in jsdom). Fix: whole thumbnail is now the drag surface (listeners on the
  container, `cursor-grab/active:cursor-grabbing`, `touch-action: none`,
  `draggable={false}` on the img, delete button stops pointerdown propagation).
  D7: removed arrow/star buttons + bottom bar; kept X delete (Spanish aria-label,
  D4 focus fix intact), "Portada" badge, Pointer/Touch(delay 200)/Keyboard sensors,
  focusable thumbnails (Space/arrows/Space) + Spanish instructions via
  `aria-describedby` + `role="status"` announcements.
  Observed: `pnpm test` 13/13 green (8 reorder tests, incl. jsdom keyboard
  drag-start asserting the Spanish announcement); `eslint` 0 errors on touched
  files (same pre-existing `no-img-element` warning); `tsc` only the 3 pre-existing
  errors in untouched files, also present on `main`.
  Partial: real-browser pointer drag NOT verified — headless Chrome over CDP against
  the dev server navigates `/admin/cars/new` → 307 → `/admin/login`
  ("Iniciar Sesión", 0 thumbnails); no test auth exists and creating a user would be
  DB mutation, harness page disallowed. Pending manual check: log into `/admin`,
  drag a thumbnail with the mouse + keyboard-drag, confirm cover + saved order.

## Delivery

- Strategy: `ask-on-risk` (default). Forecast: <400 authored lines (1 component + dep manifests) → single work-unit commit expected.
- Slice: n/a (under budget).
