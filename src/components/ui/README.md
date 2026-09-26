# UI components

## This project runs on Base UI, not Radix

`components.json` declares `"style": "new-york"`, and the shadcn CLI resolves
that style name to **Radix** wrappers. This project is on
`@base-ui/react` 1.8.0 and has **zero** Radix dependencies. Running
`shadcn add <component>` as-is would pull a Radix wrapper into a Base UI
project and undo the migration.

`new-york` was kept on purpose: it is a legacy style with **no** `base-new-york`
counterpart, so switching to a `base-*` value would re-style the entire
application. That is a product decision, not a config change.

**When you need a new component, do not use `shadcn add`.** Write it here
against `@base-ui/react`, matching the conventions in `button.tsx`:

- `data-slot` on every part
- Base UI presence attributes: `data-open` / `data-closed`, never
  `data-[state=open]`
- Enter and exit via `data-starting-style:` / `data-ending-style:` transitions,
  not `animate-in` / `animate-out`
- `render` for polymorphism, never `asChild`
- `React.ComponentProps<typeof XPrimitive.Y>` for prop types
- Part renames: `Overlay`→`Backdrop`, `Content`→`Popup` (inside `Positioner` for
  anything positioned), tabs `Trigger`→`Tab` and `Content`→`Panel`, select
  `Viewport`→`List`, `position`→`alignItemWithTrigger`
- Keep **this project's** classes. The look is deliberately not the registry's.

Two things Base UI has no counterpart for: `Label` is a native `<label>`, and
`VisuallyHidden` is the `sr-only` class.

The migration reference lives in `.agents/skills/migrate-radix-to-base/`. Read
its `universal-patterns.md` part-rename table and `class-mapping.md` before
rewiring anything.
