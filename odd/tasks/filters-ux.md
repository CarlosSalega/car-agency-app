# Filters UX on /autos

## Objective

Improve the public search filter panel on `/autos` (desktop sidebar and mobile
sheet) so it is easier to scan, honest about what it filters, and gives feedback
when a filter is applied.

## Problem

The current panel is a single column of 8 fields inside a 280px sidebar. It
offers a minimum and a maximum for both year and price — four numeric inputs for
two decisions — and applying filters produces no visual feedback until the
server responds. The empty state tells the user nothing matched but offers no way
out.

## Why

- `progressive-disclosure` (HIG): reveal complex options progressively instead of
  overwhelming users upfront. The minimum controls were redundant with the
  maximum ones for the two decisions that actually matter to a buyer.
- `Essential Text Truncation` (Critical): distinguishing names need complete
  access; clamping them "only to make cards uniform" is a Critical violation. A
  flat two-column grid inside 280px would truncate `Marca`/`Modelo`, which is
  where the label *is* the information.
- `overflow-menu` (MD): when actions exceed available space, use overflow instead
  of cramming.
- `submit-feedback` (High): confirm submission status with loading then
  success/error.
- `empty-states`: a helpful message **and an action** when there is no content.
- `Form Labels` / `input-labels` (High): inputs must have programmatically
  associated labels.
- `Mobile Keyboards`: use `inputmode` so numeric fields raise the numeric keyboard.

## Scope

In:

- `src/app/autos/page.tsx` (sidebar width, `currentYear`, `total`, `emptyAction`)
- `src/components/search-filters.tsx` (title, grid, year range select, remove
  minimum price, pending feedback, labels)
- `src/components/mobile-filters-sheet.tsx` (`currentYear` prop, `sr-only` title)
- `src/components/cars/car-grid.tsx` (result count, empty-state action)

Out:

- The query layer: `minYear` / `maxYear` / `minPrice` / `maxPrice` stay intact in
  `src/lib/queries/cars.ts` and in `buildFilters` (`page.tsx`). Keeping them
  honors existing shared URLs; only the UI surface shrinks.
- Pagination page size (already set to 12 in `419d205`).
- The sticky removal (already committed in `f6a18af`).
- Committing the project-local skills (`.agents/`, `.claude/`, `skills-lock.json`).

## Constraints

- No DB mutation (no `db push`, no `migrate`, no `seed`).
- Conventional commits, no AI attribution.
- UI copy in Spanish (project convention); code identifiers and comments in English.
- Do not stage `.agents/`, `.claude/`, `skills-lock.json`, or `odd/`.
- No push.

## Design decisions (fixed — do not re-invent)

1. Visible title: `Filtros de búsqueda`. The mobile `SheetTitle` (`sr-only`) must
   match it so the screen reader reads what the user sees.
2. Sidebar: `lg:grid-cols-[280px_1fr]` -> `lg:grid-cols-[320px_1fr]`.
3. Layout: `Marca` and `Modelo` full width; `Tipo | Año` and
   `Combustible | Transmisión` in two-column rows; `Entrega hasta` full width;
   apply button full width.
4. `Año` becomes a Select of ranges (one control, no invalid min>max state).
   Ranges are computed from `currentYear`, which the server page passes down as a
   prop (a client-side `new Date()` could hydrate-mismatch across a New Year
   boundary):
   - `Todas` -> no `minYear` / `maxYear`
   - `${currentYear} o más nuevo` -> `minYear = currentYear`
   - `${currentYear - 4} – ${currentYear - 1}` -> `minYear = currentYear - 4`, `maxYear = currentYear - 1`
   - `${currentYear - 9} – ${currentYear - 5}` -> `minYear = currentYear - 9`, `maxYear = currentYear - 5`
   - `Antes de ${currentYear - 9}` -> `maxYear = currentYear - 10`
   The Select's initial value is derived by matching the URL `minYear`/`maxYear`
   against those ranges; unmatched legacy params fall back to `Todas`.
5. Remove only the price **minimum** input. Keep `Entrega hasta (ARS)` as a single
   numeric `Input` with `inputMode="numeric"`.
6. Apply feedback: `useTransition` around `router.push`; the button is `disabled`
   while pending and its label becomes `Aplicando…`.
7. `total` is rendered as `N vehículos encontrados` / `1 vehículo encontrado` in a
   `role="status" aria-live="polite"` paragraph, only when there is at least one
   result.
8. Empty state keeps its message and gains a `Limpiar filtros` action linking to
   `/autos`.
9. Every label is associated: `htmlFor` on `Label` plus a matching `id` on the
   control (`filter-brand`, `filter-model`, `filter-type`, `filter-year`,
   `filter-fuel`, `filter-transmission`, `filter-maxPrice`).

## Checklist

- [x] F1 `page.tsx`: sidebar to 320px, compute `currentYear`, pass `currentYear`
  to `SearchFilters` and `MobileFiltersSheet`, pass `total` and `emptyAction` to
  `CarGrid`.
- [x] F2 `search-filters.tsx`: title, `currentYear` prop, year range Select,
  remove year min/max state and the price minimum input, two-column rows for the
  four short fields, `inputMode="numeric"`, label/id associations.
- [x] F3 `search-filters.tsx`: `useTransition` pending state on the apply button.
- [x] F4 `car-grid.tsx`: optional `total` prop rendering the live result count,
  optional `emptyAction` prop rendering the escape link.
- [x] F5 `mobile-filters-sheet.tsx`: `currentYear` prop forwarded, `sr-only` title
  synced.
- [x] F6 Verify: `vitest`, `eslint` on touched files, `tsc --noEmit`, and SSR
  checks against the running dev server.
- [x] F7 Commit (`6aba437`).
- [x] F8 Mirror this document to Engram.

### Corrections applied by the orchestrator after the writer returned

Both were introduced by the delegated writer and fixed before the commit:

1. The price `Input` had lost `type="number"` (only `inputMode="numeric"` was
   kept). Without a semantic numeric type the browser accepts arbitrary text, so
   `maxPrice=abc` reached `buildWhere` as `NaN` (`NaN != null` is true) and became
   `price.lte = NaN`. `type="number"` restored alongside `inputMode="numeric"`.
2. The seven literal `filter-*` ids were duplicated in the DOM: `SearchFilters` is
   mounted twice on mobile (the `hidden lg:block` desktop sidebar plus the open
   sheet, which Radix only mounts while open). Duplicate ids break label binding
   and are invalid HTML. Replaced with `useId()`-scoped ids, unique per instance.

## Acceptance criteria

- `/autos` renders 12 cars, the sidebar is 320px wide, and no filter element is
  `position: sticky`.
- The panel shows exactly one year control (a Select of ranges) and exactly one
  price control (`Entrega hasta`). No numeric input remains for a minimum.
- Applying filters disables the button and shows `Aplicando…` until navigation
  settles.
- With results present the page shows `N vehículos encontrados`; with no matches
  it shows the message plus a working `Limpiar filtros` link to `/autos`.
- Selecting a year range and applying produces the matching `minYear`/`maxYear`
  (or `maxYear` alone) in the URL and filters the listing accordingly.
- `eslint` and `tsc --noEmit` are clean on the touched files; existing tests pass.
- No reference to a price minimum control remains in the filter UI.

## Checks

- `pnpm_config_verify_deps_before_run=warn pnpm test`
- `pnpm_config_verify_deps_before_run=warn pnpm exec eslint <touched files>`
- `pnpm_config_verify_deps_before_run=warn pnpm exec tsc --noEmit`

## Progress

- 2026-09-18: feature document created; implementation delegated to a single writer.
- 2026-09-18: F1-F5 applied by the delegated writer; two writer defects corrected by
  the orchestrator (see above). Verification evidence (all re-run by the orchestrator):
  - `pnpm exec eslint <4 touched files>` -> exit 0.
  - `pnpm exec tsc --noEmit --ignoreDeprecations 5.0` -> 0 errors in the 4 touched
    files; 5 pre-existing errors elsewhere (`.next/types/app/admin/*`,
    `form/tag-selector.tsx`, `meta-pixel/events.ts`). Plain `tsc --noEmit` cannot run
    at all in this repo: `tsconfig.json` has `"ignoreDeprecations": "6.0"` while the
    installed TypeScript is 5.9.3 (TS5103). Pre-existing, outside this scope.
  - `pnpm test` -> 1 file, 5 tests passed.
  - SSR: title present, `Entrega Mínima` = 0, `minPrice` in the form = 0,
    `type="number"` = 1, sidebar `320px` present, `24 vehículos encontrados`,
    empty-state `Limpiar filtros` present, `minYear=2022&maxYear=2025` -> `1 vehículo
    encontrado` (singular form correct).
  - Field ids: 7 unique per instance, each with a matching `for`; no duplicates.
  - Native risk assessment (`gentle-ai review assess`, RDD off): medium, 4 changed
    paths, 327 changed lines.
- 2026-09-18: commit created (local only, not pushed): `6aba437 feat(filters):
  restructure autos filter panel with feedback and result count`.

## Follow-up change — year as two controlled inputs (user override)

The owner rejected the year range Select. The rule, verbatim: the year must always
be an input, never a Select; a controlled one, minimum 4 digits and no more than 4
digits, year between 1950 and 2035. Asked which bound it should filter, the owner
chose both, so the UI goes back to two inputs: `Año desde` (`minYear`) and
`Año hasta` (`maxYear`).

Reason for reopening: the range Select was the orchestrator's recommendation, not
the owner's rule. The owner's rule is "the year is always an input". This also
removes the bucket problem described in the finding below — there are no buckets
left to balance.

- [x] F9 Remove the year range Select: drop `buildYearRanges`,
  `resolveYearRangeValue` and the now-unused `currentYear` prop from
  `SearchFilters`, `MobileFiltersSheet` and `page.tsx`.
- [x] F10 Add two controlled year inputs (`Año desde` / `Año hasta`): digits only,
  `maxLength` 4, `inputMode="numeric"`, valid only when exactly 4 digits and within
  1950-2035, `aria-invalid` on a completed invalid value or an inverted range,
  plus persistent helper text and an inline error wired through `aria-describedby`.
- [x] F11 Apply the same controlled digit-only pattern to `Entrega hasta`. This
  supersedes the earlier `type="number"` correction: stripping non-digits removes
  the `NaN` path outright.
- [x] F12 Verify (eslint, tsc, tests, SSR + headless) and commit (`68fe314`).

Decisions taken while implementing:

- Validity is evaluated on blur, not on every keystroke, so typing `2` -> `20` ->
  `201` -> `2015` never flashes an error. `maxLength` plus digit stripping already
  enforces "no more than 4 digits" structurally.
- An inverted range (both valid, `desde` greater than `hasta`) applies no year
  filter and shows an inline error, instead of silently returning zero cars.
- `Transmisión`, `Combustible` and `Tipo` share one two-column grid, so
  `Transmisión` sits at half width; the long-label fields stay full width.
- A URL that already carries an inverted range still reaches the query layer and
  returns zero results, but the panel now explains why and the empty state offers
  `Limpiar filtros`. Guarding it in `buildWhere` would change the URL contract and
  is deliberately out of scope.

Verification evidence (all re-run by the orchestrator):

- `pnpm exec eslint` on the three touched files -> exit 0.
- `pnpm exec tsc --noEmit --ignoreDeprecations 5.0` -> 0 errors in the touched files.
- `pnpm test` -> 1 file, 5 tests passed.
- SSR: helper text present; `inputMode="numeric"` x3; `maxLength="4"` x2 and
  `maxLength="9"` x1; `type="number"` gone; labels `Desde` / `Hasta` present.
- Filter behaviour via URL: no filter -> 24; `minYear=2015` -> 16;
  `minYear=2015&maxYear=2020` -> 11; `maxYear=2016` -> 13; `maxPrice=15000000` -> 23.
- Inverted range URL renders the inline error text.
- Headless render at 1365px: sidebar intact, both year inputs and the helper line
  visible, grid unaffected.
- Native risk assessment (RDD off): medium, 3 changed paths, 203 changed lines.

## Revision — single year input (owner correction, supersedes F10)

The owner rejected the two-input version as poor UX: one single controlled input,
valid year range 1935-2035, and the field filters *from* that year (the owner's
explicit choice). F10 above is superseded; the two-input, inverted-range logic is
gone.

- [x] F13 Replace the year pair with a single `Año` input (`minYear` only):
  digits only, `maxLength` 4, `inputMode="numeric"`, valid only when 4 digits and
  within 1935-2035, `aria-invalid` on blur, helper text stating both the direction
  and the valid range. Drop `cn` (no longer used here) and all `maxYear` UI state.
- [x] F14 Verify and commit (`402dba4`).
- [x] F15 Remove the year helper text entirely (owner decision). The `<p>` and its
  `aria-describedby` binding are gone, so the field is announced by its label
  alone. Verified: no `year-help` idref, no helper copy in SSR, eslint / tsc /
  vitest green. Commit `64b2c28`.

Deliberate decision to record, so it is not "helpfully" restored later: the helper
existed to state (a) that the field filters *from* the typed year and (b) the valid
1935-2035 range. The owner chose to lose both signals rather than carry two lines
of `text-xs` in a 320px sidebar. The range is still enforced in code
(`isValidYear`); it is simply no longer advertised. A text input ignores the native
`min`/`max` attributes, so there is no attribute-level way to surface it.

Verification evidence:

- `pnpm exec eslint src/components/search-filters.tsx` -> exit 0.
- `pnpm exec tsc --noEmit --ignoreDeprecations 5.0` -> 0 errors in the file.
- `pnpm test` -> 1 file, 5 tests passed.
- No residual references to `maxYear`, `yearRangeInverted` or `cn(` in the file.
- SSR: one year input (`-year`), `maxLength="4"` x1, `inputMode="numeric"` x2
  (year + price), helper `Entre 1935 y 2035`.
- Filter: no filter -> 24; `minYear=2015` -> 16; `minYear=1935` -> 24;
  `minYear=2035` -> 0.
- Headless 1365px: single full-width year input, sidebar intact.

### Known caveat carried forward

`minYear`, `maxYear` and `minPrice` remain supported by `buildFilters` and
`buildWhere` for URL back-compat, but the form no longer produces or displays
`maxYear` or `minPrice`. The site is live, so a pre-existing or bookmarked URL
carrying either still filters the listing with no visible control; the only escape
is `Limpiar`. Recommendation: leave the URL contract intact for now, and if it
causes confusion, surface unmatched URL filters as chips above the grid.

## Mobile sheet containment (owner report)

The owner reported that the mobile sheet stretched to the viewport width on tablet
and that its gray parent (the sheet container) was not rounded.

- [x] F16 Contain the panel: replace `h-dvh` with
  `mx-auto max-h-[90dvh] w-full max-w-md`, so it is content-height, capped, and
  centered. Measured live via CDP at 860 / 768 / 375: panel 448px centered at 860
  and 768, and 375px (full width) at 375, so phones are untouched. Commit `ee238d1`.
- [x] F17 Reserve space above the title for the close button. **Reverted by the owner**
  (commit `5674563`). Re-measured after the revert: the close button and `Limpiar` have
  **0 overlap** anyway, because the white card's own `p-6` padding already pushes the
  title row down to y 72 while the close button ends at y 56. The earlier claim that
  this space was load-bearing was an inference, never measured on the original state —
  the 256px2 collision existed only in the intermediate `SheetHeader p-0` state. The
  revert loses nothing and makes the panel 32px shorter.
- [x] F18 Round the sheet container (`rounded-lg`) so it frames the filter card
  instead of showing square corners behind it. Commit `f426eec`.

Note on the close button: it is a child of the sheet container (the gray parent). After
the revert it occupies y 16-56 and the white card starts at y 48, so its bottom 8px
straddles the card's top edge, but it has 0 overlap with the `Limpiar` control (which
starts at y 72).

Measurement technique worth reusing: Chrome headless driven over CDP
(`Emulation.setDeviceMetricsOverride` + `Network.setCacheDisabled` +
`Runtime.evaluate` for `getBoundingClientRect` + `Page.captureScreenshot`), closed with
`Browser.close`. `Network.setCacheDisabled` is required — the dev server patches its CSS
chunk in place and a cached copy silently reports stale geometry.

## Sheet header restructure (owner direction)

The owner specified the header layout and the close button's appearance: the clear
action goes below the title, the close button takes the slot the clear button used to
occupy, and it must be a bare icon.

- [x] F19 `SearchFilters` gains an optional `headerAction` slot rendered on the title
  row's right side; `Limpiar` moves to its own row below the title. The desktop sidebar
  gets the same header because the component is shared — reviewed, and it reads better
  there too.
- [x] F20 The sheet hides the built-in absolute `SheetClose` (`[&>button]:hidden`) and
  supplies its own close button through `headerAction`, so the X lands exactly in the
  title row instead of floating over the card. `SheetHeader` padding dropped to `p-0`
  now that nothing has to clear an absolutely positioned button.
- [x] F21 The close button is `variant="ghost"` + `rounded-none`: no border, no gray
  `bg-background`, no circle. Hit area stays 36x36 (above the WCAG 2.2 AA 24px minimum).

Measured effect on height: content went from 688 to 708px because `Limpiar` gained its
own row. At 860x900 there is still no internal scroll; at 860x669 it scrolls, which the
owner accepted ("dejarlo como está"). Commits `5adf2d7` and `f8f3d65`.

### Historical record — the retired year buckets (superseded)

Measured against the live listing (24 cars) while the range Select was shipped:

| Bucket as shipped  | Cars |
| ------------------ | ---- |
| `2026 o más nuevo` | 1    |
| `2022 – 2025`      | 1    |
| `2017 – 2021`      | 9    |
| `Antes de 2017`    | 13   |

Cumulative probe (`minYear=Y`): 2021+ -> 5, 2019+ -> 7, 2017+ -> 11, 2015+ -> 16,
2013+ -> 23. The lot is an older used-car inventory (median around 2015-2016), so
two of the four buckets returned a single car each. The Select and its buckets were
then removed outright (F13), so no rebalancing is pending.

Not attempted: `minYear`/`maxYear`/`minPrice`/`maxPrice` remain supported by
`buildFilters` and `buildWhere` for URL back-compat. A shared link carrying
`minPrice` or `maxYear` still filters results while no control shows it;
`handleFilter` drops both when another filter is applied.
