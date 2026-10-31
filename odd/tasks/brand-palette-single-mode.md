# Brand palette: GL AUTOS red/black, single mode

Replace the blue-tinted community theme with a palette derived from `public/logo.png`
and collapse the project to exactly one color mode (no light/dark pair).

Grounding discovery: `car-card.tsx` and `car-grid.tsx` (commits 85a0060, b50e3f4)
already ship a hardcoded dark neutral ramp. It is the de-facto design language and
the source of the tokens below, not a new invention.

## Specs

S1. The palette derives from `public/logo.png`: `#000000`, `#FFFFFF`, `#FE0000`.
Measured from the file: background `#000000` (36659 px), text `#FFFFFF`
(1014 px), accent `#FE0000` (212 px).

S2. "solo tendremos un mode sin white/dark" — exactly one color mode. No `.dark`
block, no `@custom-variant dark`, no `dark:` utilities, no theme toggle.

S3. Every text/background pair meets WCAG AA 4.5:1. Measured on the shipped ramp:
`#f5f5f5` on `#121212` 17.18:1, `#c4c7c8` on `#121212` 11.02:1,
`#a3a3a3` on `#121212` 7.43:1.

S4. `#FE0000` with `#FFFFFF` text is 4.03:1 and fails AA. Therefore
`--primary: #FE0000` pairs with `--primary-foreground: #000000` (5.21:1).
White-on-red must not appear as a button default.

S5. The neutral ramp is tokenized from what car-card/car-grid already ship:
`#121212` page, `#141414` card, `#1c1c1c` popover/sidebar/secondary/muted,
`#242424` accent, `#2a2a2a` hairline border, `#333333` strong border,
`#f5f5f5` / `#c4c7c8` / `#a3a3a3` text steps.

S6. `--secondary` becomes a dark surface (`#1c1c1c`), so `text-secondary` can no
longer mean "accent text". Those call sites move to `text-primary` (brand red,
4.65:1 on `#121212`).

S7. The landing navbar must not be filled with `--primary`: the logo carries a
`#FE0000` accent that would disappear on red.

## Tasks

T1 — globals.css tokens + single mode + `dark:` sweep + `color-scheme` metadata.
S2, S3, S4, S5 | route: inline | done | commit `ba38590`
T2 — Landing surface: navbar, hero, sections, reviews, footer, 404, ventas.
S1, S6, S7 | route: inline | done | commit `c187b52`
T3 — Shared and admin surface: status badges, stats, tables, search, car-card,
car-grid, contact, login/2fa. S3, S5 | route: inline | done | commit `961be3b`

Checks: `tsc --noEmit` clean, `pnpm test` 21 files / 119 tests passed,
`pnpm build` exit 0. Compiled CSS carries `--primary:#fe0000`,
`--background:#121212`, `--subtle-foreground:#c4c7c8`, `color-scheme:dark`, zero
`.dark` rules; the prerendered HTML carries `<meta name="color-scheme"
content="dark">`. Lint: 6 pre-existing `no-explicit-any` errors, unchanged by this
feature (L8).

Adversarial self-verification (no automated test can catch a colour regression, so
the last four checks are structural):

- V1 single mode: 0 `.dark` selectors, 0 `@custom-variant`, 0 `dark:` utilities in
  `src/` once block comments are excluded (the docblock that _describes_ the removal
  is a false positive for a naive grep).
- V2 no light-surface scale class remains: 0 hits for
  `(bg|text|border|…)-(zinc|gray|neutral|…)-<number>`.
- V3 every palette utility resolves: 57 distinct palette utilities used in `src/`,
  all present in the built stylesheet. `@theme inline` inlines the values, so
  `--color-*` never appears in the output; the utilities do. Ten of them are only
  generated under a variant (`hover:bg-sidebar-accent`,
  `focus-visible:ring-success/30`, …), which is why a bare-class grep reports false
  negatives.
- V4 no `text-secondary` / `border-secondary` accent left: 0 hits.
- V5 contrast arithmetic recomputed from the shipped hex, matches L5.
- V6 no invisible text/background pair on a single element. Eleven candidates
  surfaced and all were state-disjoint pairs (`hover:bg-foreground` with
  `bg-card`, `selection:text-primary-foreground` with `bg-background`,
  `group-hover:*`) or opacity-modified fills. The one real quirk,
  `SelectItem`'s `[&_svg:not([class*='text-'])]:text-muted-foreground`, does not
  reach the check icon because that icon carries a `text-` class, so it inherits
  `focus:text-background` (4.65:1 on red) as intended.

Slice note: the three commits land at 284 / 498 / 678 authored lines cumulative.
The boundary past ~400 was crossed at T2; the remaining slice was still committed
to close the feature rather than leaving the branch half-migrated, since no single
commit is visually coherent until all three land.

## Log

L1 (user, verbatim):
"revisa en /public que tenemos logo.png, esos colores son los que va a tener la app,
revisa y evalua los colores para modificar la paleta, solo tendremos un mode sin
white/dark"

L2 (user decision, verbatim selection): "Oscuro único (carbón + rojo)" — dark single
mode, red brand accent.

L3 (evidence): `git status` shows the brand refresh in progress on the user's side:
`public/logo.png` modified, `public/logo-2.png` deleted, `public/whatsapp.svg` added.
`src/data/header.ts:3` and `NavbarClient.tsx:82` still point at the deleted
`/logo-2.png`. Those assets are the user's; this feature only fixes the broken
reference, it does not commit their asset changes.

L4 (deviation, deliberate): `--border` `#2a2a2a` on `#121212` is 1.31:1 and
`--input` `#3d3d3d` is 1.72:1, under the 3:1 of WCAG 1.4.11 for control boundaries.
That is the ramp car-card already ships; raising it to 3:1 needs about `#5a5a5a`,
which destroys the design. The accessible affordance is the focus ring
(`#FE0000` on `#121212`, 4.65:1). Recorded as a known gap, not a silent one.

L5 (discovery): measured contrast of `#FE0000` against the page is 4.65:1, not the
5.21:1 of pure black. It still clears AA for normal text, so red text is allowed on
`--background` and `--card` (4.57:1); it is white text on red (4.03:1) that is
banned, which is why `--primary-foreground` is `#000000` (5.21:1).

L6 (discovery): `--secondary` was doing double duty in this codebase — surface in
`button.tsx`/`badge.tsx`, accent text in the navbar, hero, section headings,
contact and admin dropdown. Turning it into a dark surface made every `text-secondary`
invisible, so all of them moved to `text-primary`. Same for the two `bg-secondary`
accents that were decorative fills (hero slide dot, landing divider pill).

L7 (scope): `two-factor-settings.tsx` keeps a hardcoded `bg-white` container because
it holds a QR code, which needs a light quiet zone to be scannable. Not a palette
miss.

L8 (out of scope, reported): `pnpm lint` fails with 6 pre-existing errors
(`no-explicit-any` in form-field, login-form, models-config, user-form-dialog,
cache-key, cloudinary.provider). Verified identical against `HEAD`; untouched.
