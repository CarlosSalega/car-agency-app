# project

2026-09-26, whole-project mode, transformation engine on the project's own files. Verdict: all nine Radix-backed wrappers are off Radix, the Radix packages are removed, and the app looks unchanged.

## Strategy

`components.json` declares `style: "new-york"`, a **legacy style**. Per the skill, legacy styles have no `base-new-york` counterpart, so there is no golden pair to replay: the transformation engine was run on the project's own wrappers, keeping their exact classes. The app's visual identity is preserved.

`@base-ui/react` 1.8.0 was installed **alongside** Radix at the start, and the eight `@radix-ui/*` packages were removed only after the last wrapper was migrated.

`asChild` was **removed**, not aliased to `render`, in `button`, `badge` and the trigger/item call sites. An alias would have let un-migrated call sites keep compiling, which hides the migration from the type checker.

## Changed

| Wrapper         | Outcome                                           |
| --------------- | ------------------------------------------------- |
| `avatar`        | **deleted**                                       |
| `label`         | native `<label>`                                  |
| `button`        | `@base-ui/react/button`                           |
| `badge`         | `useRender` + `mergeProps`                        |
| `tabs`          | `Tab` / `Panel`                                   |
| `dialog`        | `Backdrop` / `Popup`                              |
| `sheet`         | `Backdrop` / `Popup`                              |
| `dropdown-menu` | `Menu`, with `Positioner`                         |
| `select`        | `List` / `ScrollUpArrow` / `alignItemWithTrigger` |

One non-wrapper import also moved: `VisuallyHidden` in
`src/components/cars/car-detail/car-detail-gallery.tsx` became an `sr-only` div.
Base UI has no counterpart.

`grep -rn 'from "@radix-ui' src prisma` returns nothing. The eight Radix packages
are removed from `package.json`; only `@base-ui/react` remains.

## Left alone

- **`sonner`** — not a Radix library. The skill's hard rule says never touch it.
  It is still in `src/components/ui/sonner.tsx`, untouched.
- **`components.json` still reads `style: "new-york"`.** Per the skill this is
  **flagged, not fixed**. The style name still resolves to Radix variants for a
  future `shadcn add`, so adding a component now would pull a Radix wrapper back
  in and undo part of this migration. Switching the style to a `base-*` value
  would re-style the entire application, which is a product decision, not a
  migration. This is the one loose end the user should decide on.
- **`components.json` has a stale `tailwind.css` path** (`app/globals.css`) that
  does not match the real file (`src/app/globals.css`). Pre-existing, unrelated
  to the migration, and it would break `shadcn add` independently of the base
  library.
- **The 11 ESLint errors and 24 warnings** repo-wide are unchanged from the
  pre-migration baseline.

## Behavior changes

Flagged, never silently patched.

1. **Base UI's select can be cleared**, so `onValueChange` receives
   `value | null` where Radix always delivered a value. Ten call sites across
   `car-form-fields.tsx`, `enum-select.tsx`, `links-config.tsx`,
   `models-config.tsx` and `search-filters.tsx` were updated to normalize `null`
   at the boundary. This is a genuine widening of what consumers must handle,
   not a rename. It surfaced only because `asChild`-style silent compatibility was
   avoided and the type checker was allowed to fail.
2. **`Select` had to become generic.** Base UI types `Select.Root` generically,
   so a non-generic wrapper handed every `onValueChange` an `unknown`. Making
   the wrapper generic preserved the call-site typing Radix gave for free.
3. **Tabs use manual activation**: arrow keys move focus without selecting.
   `config-tabs.tsx` is a controlled component driven by the `tab` search param,
   so it is not affected in practice.
4. **Menu items no longer use `onSelect`.** Radix's `event.preventDefault()` to
   keep a menu open becomes `onClick` plus `closeOnClick`. Nothing in this project
   used `onSelect`.
5. **Per-interaction dismiss callbacks have no 1:1 prop.** `onEscapeKeyDown`,
   `onPointerDownOutside`, `onFocusOutside` and `onInteractOutside` become
   `onOpenChange`'s `eventDetails.reason` plus `eventDetails.cancel()`. No
   consumer used them.
6. **`loop` moved to `loopFocus` on the menu Root and the default flips** to
   looping.
7. **Positioning props moved to `Positioner`.** In the menu wrapper they had to
   be added to the prop type as well, not just destructured at runtime, because
   the type was `ComponentProps<typeof Menu.Popup>` which does not include
   `align`. Per the skill's "Pick means FORWARD" rule, forgetting the explicit
   forward would have broken positioning with no type error at all.
8. **Enter and exit animations are transition-based.** The
   `animate-in` / `animate-out` keyframe utilities were restated as
   `data-starting-style` / `data-ending-style` transitions, which is how Base UI
   expresses presence. They were deliberately not translated one to one.
9. **`data-[state=...]` became presence attributes** (`data-open`,
   `data-active`, `data-popup-open`), and Base UI's tabs surface disabled state
   through `aria-disabled` rather than the `disabled` attribute, so
   `disabled:opacity-50` on the tab would have been dead code.
10. **Dialog focus callbacks moved.** `onOpenAutoFocus` becomes Popup
    `initialFocus` and `onCloseAutoFocus` becomes Popup `finalFocus`, with
    different signatures. Unused here.
11. **CSS custom properties were renamed** per the reference table:
    `--radix-*-content-transform-origin` to `--transform-origin`,
    `--radix-*-content-available-height` to `--available-height`,
    `--radix-select-trigger-width` to `--anchor-width`,
    `--radix-select-trigger-height` to `--anchor-height`.
12. **Base UI's Portal renders an extra wrapper element**, which can affect
    CSS selectors that assumed Radix's structure.

## Verify by hand

Automatizado no cubre casi nada de esto. Un minuto de clicking:

- Open the admin car form. Every `Select` should open, show its options, and
  apply the choice. Clear a select if the UI allows it and confirm the field
  validates as empty rather than crashing.
- Open the admin user menu and the public mobile menu. Items should highlight on
  keyboard arrow keys, close on click, and the trigger should return focus after
  close.
- Open the image lightbox on a car detail page. It should animate, trap focus,
  close on Escape and on backdrop click, and the dialog title must still be
  announced to a screen reader.
- Open the filters sheet on mobile. It should slide from the top, and the close
  button should work.
- Open a create/edit dialog for brands, models, sellers and link-tree links.
  Check the backdrop fades, the dialog zooms, and the close X works.
- Switch tabs in `/admin/config`. Active tab styling must still apply, which
  depends on the `data-active` rewrite having landed.
- The `success`, `info` and `warning` button variants must still render. They do
  not exist upstream and were preserved by hand.
