# Landing redesign (artboard 02) — implementation

Implement the approved direction from `design/landing-redesign/02-vidriera.html`: the hero is
split in two (unit full-bleed left, information right) and **everything below it is one
column at full width**. `/catalogo` is the only page of its own.

## Specs

**S1 — The source of truth is the artboard.** `design/landing-redesign/02-vidriera.html`
(owner: "al parecer ya esta bien, comienza a implementarlo por secciones"). Marks, spacing
and copy follow that file; changes from here are deliberate and reported.

**S2 — Square corners on the public surface.** Radius 0 on every public element (no
`rounded-*`), 1px borders to separate, no shadows. The admin panel keeps `--radius: 0.5rem`:
this is the public surface only. Two neutral tokens are added for it: `--ground` (a step
below the page) and `--line-strong` (the border that carries hierarchy).

**S3 — The search lives in the header and is always visible.** `role="search"`,
`name="q"`, submits to `/catalogo`. Inline on desktop; its own full-width row below the
breakpoint on tablet and mobile.

**S4 — Argentine vocabulary and the deal model.** `concesionaria`, `salón`, `parte de pago`,
`valor de toma`, `verificación policial`, `informe de dominio`, `llave por llave`. Never
`peritaje` for the police check, never `showroom`, never "el precio final" as the pitch:
the buyer arrives with a vehicle, a loan or both, and the agency builds the deal.

**S5 — One page plus the catalog.** The landing carries header, hero, latest arrivals, why-us,
payment routes, reviews and contact. `/catalogo` is the paginated catalog. `/autos` (the list)
redirects to `/catalogo` with a 301; the car detail **stays at `/autos/[slug]`**, because those
are the indexed URLs and moving them throws away ranking. `/ventas` keeps its own page because
it carries a form.

**S6 — White-label.** No client identity outside `src/site/`: name, phone, address, hours and
metadata come from `activeSite`. `src/site/__tests__/brand-leak.test.ts` is the gate.

**S7 — Section by section.** Each section is implemented, verified in a real render and
committed on its own, so the owner can review and change direction between sections.

## Tasks

| ID  | Task                                                                         | Specs      | Commit |
| --- | ---------------------------------------------------------------------------- | ---------- | ------ |
| T1  | Tokens, `SiteHeader` with the search, `/catalogo` route, `/autos` 301, links | S2, S3, S5 | C1     |
| T2  | Hero: split, full-bleed media, claim, counters                               | S1, S2     | C2     |
| T3  | Últimos ingresos: full-width rows from the database                          | S1, S5     | C3     |
| T4  | Por qué elegirnos + Formas de pago                                           | S4         | C4     |
| T5  | Reseñas: big quote + author list, still from the published rows              | S1         | C5     |
| T6  | El salón (contact, hours, map) + footer                                      | S1, S4     | C6     |
| T7  | Final pass: renders at 1440/1024/390, a11y, tsc, suite, build                | S2, S6     | C7     |

## Log

- **L1 (user, verbatim):** "quiero que los utilices para rediseñar la landing y paths publicos, la
  principal consigna es que no tenga border radius y que cards y algunos elementos tengan un
  ligero border, luego utiliza los skills para proponer un diseño, tendremos todo en una pagina
  landing, solo /catalogo tendra su propia pagina para el catalogo paginado de autos, los colores
  van a ser los mismos aunque tambien puedes sugerir pequeñas variaciones."
- **L2 (user, verbatim):** "la barra de busqueda debe de estar siempre visible, es mejor agregarla
  al hader/navbar y que se adapte en mobile y tablet. Tambien hay palabras que no corresponden al
  español/castellano de argentina, revisa. La manera de venta actualmente en el rubro automotor es
  dar facilidades … El cliente interesado dice que tiene y quiere y las agencias le arman el negocio"
- **L3 (corrección de diseño):** "no entendiste que la pagina 2 tiene 2 columnas y eso esta mal" —
  el split es del hero, no de la página. Reescrito el artboard y aprobado después.
- **L4 (user, verbatim):** "al parecer ya esta bien, comienza a implementarlo por secciones. Si
  necesitamos cambios mas adelante lo hacemos"
- **L5 (hallazgo):** `src/proxy.ts` tiene una allowlist `PUBLIC_PATHS = ["/", "/autos", "/contacto"]`
  y su `isPublicRoute` sólo acepta el prefijo `/autos/`. Agregar `/catalogo` sin tocar esa lista
  habría mandado el catálogo nuevo al login: entra en T1.
