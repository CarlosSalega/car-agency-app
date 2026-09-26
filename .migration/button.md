# button

2026-09-26, transformation engine on the project's own file (legacy `new-york` style has no base counterpart). Verdict: migrated off Radix, classes unchanged.

## Changed

- `src/components/ui/button.tsx` rewired from its Radix primitive to `@base-ui/react`.
  `asChild` is replaced by `render`, not aliased, so un-migrated call sites
  cannot keep compiling.
- Presence attributes and CSS custom properties renamed per the reference
  tables; enter/exit animations restated as `data-starting-style` /
  `data-ending-style` transitions rather than translated one to one.
- `grep -n "radix-ui|@radix-ui|IconPlaceholder" src/components/ui/button.tsx` is
  clean apart from the migration note in the file header.

## Left alone

- `sonner` and the other non-Radix wrappers, per the skill's hard rule.

## Behavior changes

See `.migration/project.md` for the full list. The item most likely to matter
for this component is recorded there under the component's own heading.

## Verify by hand

Open the admin UI and exercise this component with mouse and keyboard. See the
checklist at the end of `.migration/project.md`.
