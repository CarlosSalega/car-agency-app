# Add an admin sidebar from the dash block

## Objective

Give `/admin` a collapsible sidebar navigation built on the shadcn `sidebar`
block, adapted to this project's Base UI primitives and its own visual identity,
consuming the existing `ADMIN_NAVIGATION` data source.

## Why this is not a copy

`dash` is the shadcn `sidebar` block demo. It is Base UI (`base-sera`, `taupe`),
while this project is now Base UI with a `new-york` look. Two independent
mismatches:

1. **Before the Radix migration this would have been a primitive conflict.**
   Resolved: the project is now on `@base-ui/react`, so the primitives line up.
2. **The look still does not match, and will not.** `dash` is `base-sera` with
   `taupe`; this project is `new-york` with `neutral`. Retargeting onto the
   `base-sera` registry variant would re-style the whole app, which the Radix
   migration deliberately avoided.

So this uses the same approach as the Radix migration: **the block is a
reference for composition, and the implementation is written against this
project's own classes.** The result should look like the rest of the admin, not
like `dash`.

## The dash block is empty

`dash/app/dashboard/page.tsx` is 55 lines: a `SidebarProvider`, a header with a
breadcrumb, and four empty `bg-muted/50` divs. No cards, no charts, no tables, no
data. There is no dashboard content to port. This task is the **shell only**;
the content decision is separate.

## Verified current state

- `src/app/admin/layout.tsx` renders a **fragment**, not a shell: `AdminHeader`
  followed by a `Suspense` boundary. No `<main>` landmark, no flex column, no
  `SidebarProvider`.
- `AdminHeader` is a horizontal `bg-foreground` bar of `h-24` holding the logo,
  `AdminNavigation` and `AdminDropdown`.
- `AdminNavigation` is `hidden md:flex`, so **there is no mobile admin
  navigation at all**; the only mobile access is the dropdown. This is the gap
  the sidebar closes.
- `ADMIN_NAVIGATION` in `src/data/admin-navigation.ts` is a better data source
  than `dash`'s: six items with `icon`, `href`, `roles`, `action: "logout"` and
  Spanish labels. `dash` hardcodes `url: "#"` in four places.
- One item, `logout`, has **no `href`** and carries `action: "logout"`. The
  sidebar must branch on `action`, since `AdminNavItem` makes it explicit.
- `roles: ["ADMIN"]` gates `users` and `config`. Today that is a client-side
  filter only, not a server guard.
- `/admin/login` must stay **outside** the sidebar shell. The layout
  special-cases it via the `x-pathname` header injected by `src/proxy.ts`, and
  `proxy.ts` exempts it from the cookie check.
- `AdminLoadingFallback` hardcodes `min-h-[calc(100vh-6rem)]`, which assumes the
  6rem header. A sidebar changes that assumption.

## Missing CSS tokens, a real pre-existing bug

`src/app/globals.css` maps seven `--color-sidebar-*` tokens in `@theme inline`
but only **five** are defined in `:root`. `--sidebar-accent`,
`--sidebar-accent-foreground` and `--sidebar-ring` are **referenced and never
defined**. They are dangling references today because nothing consumes them.
A sidebar consumes all of them, so they must be defined.

There is also **no `.dark` block at all** (zero matches) and no `next-themes`.
`@custom-variant dark` is declared but dark mode is dead. Out of scope here: no
dark sidebar is added, only the tokens needed for the light theme.

## `components.json` decision

Per the user's decision, `style: "new-york"` **stays**. A visible note is added
to `components.json` recording that this project is on Base UI despite the style
name, so a future `shadcn add` does not silently reintroduce Radix wrappers.

## Scope

In scope: the five missing Base UI primitives, the three missing sidebar tokens,
`sidebar.tsx`, the sidebar navigation components, the admin layout, and the
horizontal navigation being replaced by the sidebar.

Out of scope: dashboard **content**, dark mode, the 11 pre-existing ESLint
errors, publishing the 12 staged vehicles, and any change to the `dash` project.

## Tasks

- [x] T1 — Record the baseline: build, typecheck, tests, and the current admin
      shell structure.
- [x] T2 — Add the missing sidebar CSS tokens.
- [x] T3 — Add the five missing Base UI primitives: `collapsible`, `tooltip`,
      `separator`, `skeleton`, `breadcrumb`.
- [x] T4 — Write `sidebar.tsx` against Base UI, with this project's classes.
- [x] T5 — Write the sidebar navigation components consuming
      `ADMIN_NAVIGATION`, including the `logout` action and `roles` gating.
- [x] T6 — Restructure `src/app/admin/layout.tsx` into
      `SidebarProvider` + `Sidebar` + `SidebarInset`, keeping `/admin/login`
      outside the shell, and remove the now-redundant horizontal navigation.
- [x] T7 — Record the `components.json` Base UI note.
- [x] T8 — Full verification and the manual QA checklist.

## Authorized scope

`src/components/ui`, `src/components/admin`, `src/app/admin`,
`src/app/globals.css`, `components.json`. No schema or data change, no auth
logic change, no content redesign.

## Acceptance criteria

- `pnpm build` exits 0.
- `pnpm exec tsc --noEmit` exits 0 after the build.
- `pnpm test` passes with no reduction in test count.
- `pnpm exec prettier --check .` exits 0.
- No new ESLint errors.
- Every `--color-sidebar-*` token used by the sidebar resolves to a defined
  variable in `:root`.
- The sidebar links to the five real admin routes and offers `Cerrar sesión` as
  an action, not a link.
- `/admin/login` renders with no sidebar.
- The sidebar is reachable on mobile, closing the gap that
  `AdminNavigation`'s `hidden md:flex` left open.

## Applicable checks

```
pnpm build
pnpm exec tsc --noEmit
pnpm test
pnpm exec prettier --check .
pnpm exec eslint src
```

## Route and trigger evidence

One delegated writer for the five independent primitives in T3, since they share
no imports and are a clean parallel batch. `sidebar.tsx`, the navigation
components and the layout restructure were done inline: they are mutually
dependent, share one design decision, and delegating them would have split that
decision across two contexts.

## TDD mode

Not enabled for this project; no TDD instruction was active in this session.
Ordinary functional checks are used. A navigation shell has no behavior worth
test-first here, and the existing suite plus the build is the honest gate.
Keyboard and focus behavior is documented for manual QA instead, because that is
exactly what an automated test would fake.

## Progress

- [x] T1 — Baseline recorded: clean tree on a fresh branch, `build` exit 0,
      `tsc` exit 0, 36 tests, ESLint 35 problems, and the current admin shell
      structure mapped.
- [ ] T2 — Sidebar CSS tokens. Not started.
- [ ] T3 — Five missing Base UI primitives. Not started.
- [ ] T4 — `sidebar.tsx`. Not started.
- [ ] T5 — Navigation components. Not started.
- [ ] T6 — Layout restructure. Not started.
- [ ] T7 — `components.json` note. Not started.
- [ ] T8 — Verification. Not started.

## Verification evidence

Baseline only, captured before any change:

- `pnpm build` exit 0.
- `pnpm exec tsc --noEmit` exit 0.
- `pnpm test` 5 files, 36 tests pass.
- `pnpm exec eslint src` 35 problems (11 errors, 24 warnings), all pre-existing.
- `globals.css` defines only five of the eight `--sidebar-*` tokens;
  `--sidebar-accent`, `--sidebar-accent-foreground` and `--sidebar-ring` are
  mapped in `@theme inline` but never defined.
- `grep -cE "^\.dark" src/app/globals.css` returns 0.
- `src/app/admin/layout.tsx` renders a fragment, not a shell.
- `AdminNavigation` is `hidden md:flex`, so there is no mobile admin navigation.

No post-change verification exists yet. It is recorded here as each task
completes.

## Next step

T2: define the three missing `--sidebar-*` tokens so the sidebar's hover, active
and focus states resolve instead of falling back to unset variables.
