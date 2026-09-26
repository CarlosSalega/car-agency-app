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

- [x] T1 — Preflight and baseline complete: clean tree on a fresh branch,
      `shadcn info` captured, baseline `build` exit 0 / `tsc` exit 0 / 36 tests, and
      `@base-ui/react` 1.8.0 installed alongside Radix.
- [ ] T2 — Delete the dead `avatar` wrapper. Not started.
- [ ] T3 — Migrate `label`. Not started.
- [ ] T4 — Migrate `button`. Not started.
- [ ] T5 — Migrate `badge`, `tabs`. Not started.
- [ ] T6 — Migrate `dialog`, `sheet`. Not started.
- [ ] T7 — Migrate `dropdown-menu`. Not started.
- [ ] T8 — Migrate `select`. Not started.
- [ ] T9 — Remove Radix deps, flip `components.json`. Not started.
- [ ] T10 — Full verification and `.migration/` reports. Not started.

## Verification evidence

Baseline only, captured before any wrapper was touched:

- `pnpm build` exit 0.
- `pnpm exec tsc --noEmit` exit 0.
- `pnpm test` 5 files, 36 tests pass.
- `eslint src` 35 problems (11 errors, 24 warnings), all pre-existing.
- `@base-ui/react` 1.8.0 installed; Radix packages still present, as required
  until the last wrapper is migrated.
- `grep -rn "@radix-ui" src prisma` still reports the nine wrappers, as
  expected at this stage.

No post-migration verification exists yet. It is recorded here as each task
completes.

## Next step

T2 and T3: delete the dead `avatar` wrapper, then migrate `label` to a native
`<label>`. Open a PR once the wrappers are done and verified.
