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
T4 — Regenerate `public/favicon.ico` and `public/apple-touch-icon.png` from the new
mark. S1 | route: inline | done | commit `5c1ccf6`
T5 — Transparent logo variants: the black field and the collapse deformation.
S1, S7 | route: inline | done | commit `b00d35b`
T6 — Replace "FyF Automotores" copy with GL Autos. S1 | done | commit `1f6210f`
T7 — Real business data: address, phone, hours, Instagram, positioning, and the
GL Autos name in titles/SEO. S1 | done | commit `(T7)`

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

L9 (follow-up request, verbatim): "regenera el favicon y apple-touch-icon con la
nueva marca". The shipped icons were still the previous brand (the FyF Automotores
Tesla-style mark), not GL Autos.

L10 (method): the icons are derived from `public/logo.png` itself, not re-set in a
look-alike typeface, so the glyphs are the real brand letterforms. That source is
43x18 px for the "GL" (the whole PNG is 204x192), which is too coarse to magnify
cleanly: upscaling it reproduces the pixel staircase as ~3px steps at 180px.
Blurring after magnification melts the counter of the G, so the smoothing is
applied at source resolution (Gaussian radius 0.7 px) before interpolating, with a
smoothstep threshold. 16px uses the G monogram: the full lockup at 12px wide is
two 5px letters that merge into one red blob.

L11 (pitfall): `Image.save(..., format="ICO", sizes=[...])` resizes the base frame
for every entry, so per-size compositions were silently discarded and the 16px
monogram came out as a downscaled 64px lockup. The fix is `append_images`, which
Pillow matches by exact size.

L12 (limits, reported): the ICO frame is that 43x18 source, so the 180px icon is a
2.8x magnification. If the original SVG or HD logo exists, regenerating from it is
a one-command change; this is the ceiling of the current asset.

L13 (user report, verbatim): "si sidebar de admin es mas claro, entonces el logo se
nota mucho que es una imagen porque tiene color mas oscuro. Tambien revisa que al
momento de dar collapse al sidebar este deforma el logo, para este caso podemos
agregarle un icono o solo las letras GL."

L14 (measurements that explain it): the artwork inside `logo.png` is 179x19 and the
canvas is 204x192, so 87.5% of the file is empty black. In the sidebar the
`size-16` box drew that wordmark at 57x8.5px, inside a black square on a `#1c1c1c`
surface: the rectangle and the unreadable size were the same defect.

L15 (second defect, real bug): `SIDEBAR_WIDTH_ICON` is 3rem (48px) and
`SidebarHeader` carries `p-2`, so the collapsed rail leaves 32px. The logo is a
flex item with `size-16` and default `flex-shrink: 1`, which shrinks the main-axis
size only: 64px wide became 16px wide while the height stayed 64px. A 16x64 sliver,
not a scaled logo. Fixed with `shrink-0` + `w-auto`, and by collapsing the header
padding to `p-0` so the monogram actually fits.

L16 (third defect, not reported by the user): the same baked black field was in the
public navbar and the footer.

L17 (user decision, verbatim selection): "Wordmark expandido + "GL" al colapsar".

L18 (constraint found while sizing): the wordmark is a 9.4:1 lockup (179x19). In the
224px the 16rem sidebar leaves after its own padding, the ceiling is ~23px tall, so
`h-7` would have asked for 264px. It renders at `h-5` (188px wide), which is also
1.05x of native, so it stays crisp. The rail monogram is `w-8` (32x14) inside 48px.

L19 (open question, not changed): the footer and the hero still read "FyF
Automotores". That may be the legal name behind the GL Autos trade name, so it is
the user's call, not a silent rename.

Checks: the two assets are derived by keying the black field out and
unpremultiplying, so the antialiased edges carry alpha without a dark fringe; the
six `group-data-[collapsible=icon]` utilities used are all present in the compiled
stylesheet; both PNGs are served (1889b / 645b, `image/png`) and the landing HTML
references the wordmark through `next/image` with a 1x/2x srcset; `tsc` clean,
119/119 tests, `pnpm build` exit 0. Geometry is computed, and the two rail states
were rasterised and inspected, not checked in a browser.

L20 (user request, verbatim): "cambia todo lo que diga FyF Automotores por GL Autos".

L21 (discovery): the wordmark text was written as
`F<span className="normal-case">y</span>F Automotores` in four places, which is why
a grep for "fyf" never found it.

L22 (discovery — botched rename): the repo also carries `@Car Agency Appautomotores`,
`tiktok.com/@Car Agency Appautomotores` and `facebook.com/people/Car Agency App/...`.
Confirmed with `od` that the bytes really contain the space: an automated rename
replaced the token `fyf` with "Car Agency App" and mangled three values into
strings that are not valid URLs. `SITE_CONFIG.name` and every page title carried
the same replacement, so the site name was "Car Agency App" in the tab, og and
title.

L23 (user decision, verbatim): "Sí, "Car Agency App" → "GL Autos" en títulos y
SEO", excluding testimonials. `Reviews.tsx` keeps its two quotes verbatim: a
customer review is not editable copy.

L24 (real business data, dictated by the user): Instagram
`https://www.instagram.com/gl.autos.sf/`, WhatsApp `5493425777646`, address
`General López 3543`, hours Monday to Friday 08:30-12:30 and 16:00-20:00, Saturday
09:00-12:30, positioning "Concesionario multimarcas de usados seleccionados y 0km",
province Santa Fe.

L25 (bug found by that data): `WhatsAppFloatButton` interpolated the env value
directly, producing `wa.me/+5493425777646`, while `/ventas` already normalised with
`replace(/\D/g, "")`. Both now strip non-digits.

L26 (blocking, needs consent): the live `/contacto` reads `linkTreeLink` rows, and
the DB still holds the previous phone and the `autos.usados.santafe` Instagram, so
the page now shows the new Instagram in the footer and the old one in the link list.
`pnpm db:seed` is NOT the fix: `resetDatabase()` wipes visit, log, car, seller,
model, brand, linkTreeLink, settings, session, account, verification and user. It
needs a targeted UPDATE of three rows.

L27 (still unknown, not invented): the X/Twitter handle, the TikTok and Facebook
URLs, the email (`info@caragency.com` in the seed is a botched domain), and whether
the `maps.app.goo.gl` short link in the `ubicacion` row points at the new address.

Checks: `tsc` clean, 119/119 tests, `pnpm build` exit 0. Rendered HTML verified:
`"telephone":"+5493425777646"`, `"streetAddress":"General López 3543"`, the three
`openingHoursSpecification` entries, the footer address/hours/phone/Instagram, the
new site name in `<title>` and `og:site_name`, `wa.me/5493425777646` with no `+`, and
zero occurrences of `5281841` on the home page. The local `.env` placeholders were
filled with the real phone and Instagram (that file is untracked).
