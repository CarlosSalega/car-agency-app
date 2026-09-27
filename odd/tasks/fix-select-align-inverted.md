# Fix the inverted `alignItemWithTrigger` mapping in the Select wrapper

## Objective

Make every `Select` in the project show all of its options when opened, and
restore the popup appearance the project had before the Radix to Base UI
migration.

## The symptom

Every `Select` in the admin opens a popup that shows the first option and then
a large empty white area. The remaining options are clipped and unreachable.
Reported against `Orden` in the "Editar enlace (Contacto)" dialog, which has
five options (1–5) and shows only "1".

Affects all 13 `SelectContent` usages across 7 files, because no consumer passes
`position` and the broken default applies everywhere:

- `src/components/search-filters.tsx` — 11
- `src/components/linktree/links-config.tsx` — 7
- `src/components/cars/car-form/car-form-fields.tsx` — 7
- `src/components/users/user-form-dialog.tsx` — 5
- `src/components/models-config.tsx` — 3
- `src/components/form/enum-select.tsx` — 3

## Root cause: the mapping is inverted

`src/components/ui/select.tsx` line 91:

```tsx
const alignItemWithTrigger = position === "popper";
```

Per the migration reference
(`.agents/skills/migrate-radix-to-base/form-controls.md:70`):

| `position`       | Base UI `alignItemWithTrigger` |
| ---------------- | ------------------------------ |
| `"popper"`       | `false`                        |
| `"item-aligned"` | `true`                         |

Radix's `position` enum and Base UI's `alignItemWithTrigger` boolean are not
name-for-name equivalents, and the wrapper mapped them by matching the word
"align" rather than by the behaviour each mode actually produces. It is
inverted in both directions.

The wrapper's own doc comment repeats the mistake, which is why it survived
review: `"popper" becomes true and "item-aligned" becomes false`. A confident,
specific, and wrong comment is worse than no comment.

### Why the inversion produces exactly the reported layout

With `alignItemWithTrigger` incorrectly `true`, three things compound:

1. Base UI treats the mode as "the selected item should occupy the trigger's
   slot". It stretches the positioner and sets `popupElement.style.height =
'100%'` (`SelectPopup.js:264,270`), so the popup fills the available space.
2. Base UI's `List` then applies its own inline styles for this mode —
   `max-height: 100%; overflow-y: auto`
   (`node_modules/@base-ui/react/select/popup/utils.js`, `LIST_FUNCTIONAL_STYLES`).
3. The wrapper's `List` class also applies `h-(--anchor-height)`
   (`select.tsx`, inside the `alignItemWithTrigger &&` branch). That variable is
   published by the positioner and holds the **trigger's** height, 40px, from
   `data-[size=default]:h-10`.

So the popup is stretched tall while the list inside it is pinned to 40px. One
option is visible, the rest are clipped, and the leftover popup height renders
as empty white space. That is the screenshot, exactly.

It also disables the positioning props: `side` and `sideOffset` only apply when
`alignItemWithTrigger` is off, so the corrected mapping restores them too.

## The fix

One boolean, plus the comment that encoded the error:

```tsx
const alignItemWithTrigger = position === "item-aligned";
```

`align="start"` is already passed explicitly and must stay: Base UI defaults to
`"center"`, Radix to `"start"`, and the wrapper correctly preserves the Radix
behaviour.

`h-(--anchor-height)` on the `List` stays as written. With the mapping corrected
it only applies in genuine item-aligned mode, which no consumer uses. Deleting
it as "dead code" would remove the shadcn-intended behaviour for anyone who
later passes `position="item-aligned"`.

## Regression guard

The bug was an inverted boolean with a confident comment. A comment is not a
guard, so extract the mapping into an exported pure function and pin both
directions in a test. Inverting it again should fail a test, not a user's
screen.

Note for the future: a jsdom test asserting "all options are in the DOM" would
NOT catch this. The options are always rendered; the defect is CSS clipping, and
jsdom has no layout engine. The guard has to target the mapping, not the
symptom.

## Scope

Authorized:

- `src/components/ui/select.tsx` — the mapping, its comment, and the exported
  pure function.
- `src/components/ui/__tests__/select.test.tsx` — new test.
- This document and `odd/honest-notes.md`.

Not authorized:

- Any change to the 13 call sites. They are all correct and none pass `position`.
- Removing `h-(--anchor-height)`.
- The `align="start"` default, which is already correct.
- The same `alignItemWithTrigger` question in other components — it only exists
  on Select.
- Visual restyling of the popup.

## Acceptance criteria

1. `position="popper"` resolves to `alignItemWithTrigger === false`.
2. `position="item-aligned"` resolves to `true`.
3. The test passes and fails if the mapping is inverted again.
4. `pnpm exec tsc --noEmit` exits 0.
5. `pnpm test` stays green.
6. ESLint error count stays at 7, warnings at 24.
7. Prettier clean.

## Checks

| Check | Command                       | Result  |
| ----- | ----------------------------- | ------- |
| T1    | New test, both directions     | pending |
| T2    | `pnpm exec tsc --noEmit`      | pending |
| T3    | `pnpm test`                   | pending |
| T4    | ESLint 7 errors / 24 warnings | pending |
| T5    | `prettier --check`            | pending |

| T6 | Visual confirmation in a browser | pass — reported by the user |

**Honest limitation:** the popup geometry is CSS-driven and jsdom has no layout
engine, so T1–T5 prove the mapping, not the pixels. T6 is the one that proves
the symptom is actually gone, and the user ran it: the dropdown now behaves as
expected. Without T6 this fix would have been "verified" on paper only.

## Route

Direct inline. One line of behaviour plus a test, in files already read, with
no unresolved design decision.

## Tasks

- [x] **F1** — extract the mapping as a pure function and invert it correctly.
- [x] **F2** — correct the doc comment.
- [x] **F3** — add the regression test.
- [x] **F4** — verify and commit.

## Progress

The change is one boolean, one corrected comment, and one new test file. 53
insertions, 3 deletions.

## Root cause worth remembering

Radix's `position` enum and Base UI's `alignItemWithTrigger` boolean are not
name-for-name equivalents, and the migration mapped them by matching the word
"align" instead of by the behaviour each mode produces. The result was inverted
in both directions and shipped with a doc comment that stated the wrong mapping
with total confidence.

The generalisable lesson: during a library migration, a comment that explains a
non-obvious mapping is a liability, because the mapping is exactly the thing
that is easiest to get wrong and the comment is what makes it survive review.
Extract the mapping into a named function and test both directions. A confident
comment is not a guard.

## Next step

Closed. The user confirmed T6: the dropdown behaves as expected.

Not re-verified by the orchestrator and therefore not claimed: the other 12
`SelectContent` usages. They share the one fixed code path and no consumer
passes `position`, so the same correction reaches all of them, but that is
inference, not observation.
