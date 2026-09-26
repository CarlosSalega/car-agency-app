# Migrate shadcn UI from Radix to Base UI

## Objective

Move the shadcn wrappers in `src/components/ui` from Radix UI to `@base-ui/react`,
keeping the project's own visual identity, and remove the Radix dependencies
once the last wrapper is migrated.

## Why the look must not change

`components.json` declares `style: "new-york"`, which is a **legacy style** with
no `base-new-york` counterpart. Retargeting the wrappers onto a `base-*` registry
variant would restyle the entire application.

So this migration **rewires primitives and keeps the existing classes**. The app
looks identical before and after. Adopting the `base-sera` look of the `dash`
project is a separate, visual decision and is explicitly out of scope here.

## Strategy

Per `.agents/skills/migrate-radix-to-base/SKILL.md`:

- `@base-ui/react` is installed **alongside** Radix. Radix packages are removed
  only after the last wrapper is migrated.
- One commit per component, in dependency order, leaves and shared wrappers
  first.
- Each wrapper keeps its public export names, so most consumer imports do not
  change. The call sites that do change are the `asChild` ones.
- Behavior deltas are **flagged in the report, never silently patched**.

## Verified surface

Measured with a resolver over real imports, not grep:

| Wrapper         | Consumers | Note                                                                                 |
| --------------- | --------- | ------------------------------------------------------------------------------------ |
| `avatar`        | **0**     | **Dead code.** The only `Avatar` in the project is a local function in `Reviews.tsx` |
| `tabs`          | 1         |                                                                                      |
| `sheet`         | 2         | Built on the dialog anatomy                                                          |
| `dropdown-menu` | 2         | Canonical menu mapping                                                               |
| `badge`         | 5         |                                                                                      |
| `select`        | 6         | `position` becomes `alignItemWithTrigger`                                            |
| `dialog`        | 7         | `Overlay` becomes `Backdrop`, `Content` becomes `Popup`                              |
| `label`         | 10        | **No Base UI counterpart**; becomes a native `<label>`                               |
| `button`        | 21        | Must become the real `@base-ui/react/button` primitive                               |

54 wrapper imports in total, and **25 `asChild` call sites across 16 files**.

`button.tsx` carries project-specific variants (`success`, `info`, `warning`)
that do not exist upstream. Those must survive the migration.

## Hard rules from the skill

- Never touch non-Radix libraries or their wrappers. `sonner` is present in this
  project and is explicitly off limits.
- `button.tsx` uses the real `@base-ui/react/button` primitive, never a
  hand-rolled `useRender` wrapper.
- `Label` has no Base UI counterpart: it becomes a native `<label>`.
- `VisuallyHidden` becomes `sr-only`.
- Positioner props must be **declared, destructured and forwarded** in every
  overlay wrapper. No type error catches a forgotten forward; positioning breaks
  silently.
- Behavior deltas are reported, not patched.

## Scope

In scope: the nine Radix-backed wrappers, their call sites, the Radix
dependencies once unused, and `.migration/` reports.

Out of scope: changing the visual style, the `dash` sidebar, the 11 pre-existing
ESLint errors, and any non-Radix dependency.

## Tasks

- [x] T1 — Preflight and baseline: clean tree, branch, `shadcn info`, baseline
      build/typecheck/tests, install `@base-ui/react` alongside Radix.
- [x] T2 — Delete the dead `avatar` wrapper instead of migrating it.
- [x] T3 — Migrate `label` to a native `<label>`.
- [x] T4 — Migrate `button` to `@base-ui/react/button`, preserving the
      project-specific variants, and repoint its `asChild` call sites.
- [x] T5 — Migrate `badge`, `tabs`.
- [x] T6 — Migrate `dialog` and `sheet` with the Backdrop/Popup anatomy.
- [x] T7 — Migrate `dropdown-menu` with the menu mapping.
- [x] T8 — Migrate `select` with `List` and `alignItemWithTrigger`.
- [x] T9 — Remove the Radix dependencies and flip `components.json`.
- [x] T10 — Full verification and the `.migration/` reports.

## Authorized scope

`src/components/ui`, consumer call sites, `package.json`, `components.json`, and
`.migration/`. No visual redesign and no schema or data change.

## Acceptance criteria

- No `@radix-ui` import remains anywhere in the project.
- The Radix packages are removed from `package.json`.
- `pnpm build` exits 0.
- `pnpm exec tsc --noEmit` exits 0 after the build.
- `pnpm test` passes with no reduction in test count.
- `pnpm exec prettier --check .` exits 0.
- The `success`, `info` and `warning` button variants still work.
- No new ESLint errors.
- `.migration/project.md` plus one report per migrated component exist.

## Applicable checks

```
pnpm build
pnpm exec tsc --noEmit
pnpm test
pnpm exec prettier --check .
pnpm exec eslint src
grep -rn "@radix-ui" src prisma
```

## Route and trigger evidence

Direct inline for the wrapper rewrites, which are mechanical once the mapping
tables are applied and are the exact case the skill's transformation engine
describes. One delegated exploration pass established the consumer counts, the
dead `avatar` wrapper and the `asChild` distribution, because that needed more
than four files to establish and would have inflated this context.

## TDD mode

Not enabled for this project; no TDD instruction was active in this session.
Ordinary functional checks are used. A primitive swap has no new behavior to
test-first; the existing suite plus the build is the gate, and behavior deltas
are documented for manual QA.

## Progress

- [x] T1 — Preflight and baseline: clean tree on a fresh branch, `shadcn info`
      captured, baseline `build` exit 0 / `tsc` exit 0 / 36 tests, and
      `@base-ui/react` 1.8.0 installed alongside Radix.
- [x] T2 — Deleted the dead `avatar` wrapper. It had zero importers; the only
      `Avatar` in the project is a local function in `Reviews.tsx`.
- [x] T3 — `label` migrated to a native `<label>`.
- [x] T4 — `button` migrated to `@base-ui/react/button`, with the
      project-specific variants preserved and 6 `asChild` call sites rewritten.
- [x] T5 — `badge` migrated to `useRender` + `mergeProps`; `tabs` migrated with
      `Tab` / `Panel` and the `data-active` and `aria-disabled` class rewrites.
- [x] T6 — `dialog` and `sheet` migrated with `Backdrop` / `Popup` and
      transition-based enter/exit animations. 5 `asChild` call sites rewritten.
- [x] T7 — `dropdown-menu` migrated to `Menu` with a `Positioner`, including the
      prop-type change needed for `align`. 5 `asChild` call sites rewritten.
- [x] T8 — `select` migrated with `List`, `ScrollUpArrow` and
      `alignItemWithTrigger`. 10 call sites updated for the new `| null` value.
- [x] T9 — The eight `@radix-ui/*` packages removed. `VisuallyHidden` in
      `car-detail-gallery.tsx` replaced with `sr-only`.
- [x] T10 — Full verification and the `.migration/` reports.

## Verification evidence

Baseline before any change: `build` exit 0, `tsc` exit 0, 36 tests, ESLint 35
problems (11 errors, 24 warnings).

After the migration:

- `grep -rn 'from "@radix-ui' src prisma` returns nothing.
- `node -e` over `package.json` confirms no `radix` dependency remains; only
  `@base-ui/react` 1.8.0.
- `pnpm build` exit 0.
- `pnpm exec tsc --noEmit` after the build exit 0.
- `pnpm test` 5 files, 36 tests pass — same as the baseline.
- `pnpm exec prettier --check .` exit 0.
- `pnpm exec eslint src` 35 problems (11 errors, 24 warnings) — **unchanged from
  the pre-migration baseline**.

The pre-commit hook installed in PR #3 fired during this work and blocked a
commit on formatting, which is the first time it has been exercised.

`components.json` still reads `style: "new-york"`. Per the skill this is flagged,
not fixed: a future `shadcn add` would resolve to Radix variants again, and
switching to a `base-*` style would re-style the whole app. That decision belongs
to the user. See `.migration/project.md`.

## Next step

Open a PR. Merging is the user's decision. The destructive seed still requires
separate authorization and was not run.
