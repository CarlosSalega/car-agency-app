# White-label seam, Phase 0: brand identity out of the product

The product is single tenant but **resold**: one deployment per dealership. Phase 0 moves
every piece of client identity into `src/site/<client>/` with **no visual change**, so the
next deployment is a copy with a different client folder instead of a search-and-replace.
Composition of the landing (which sections, in what order) and the `SITE_SLUG` switch are
Phase 1 and are explicitly **not** here.

## Specs

**S1 — Single tenant, no `tenantId`.** The client is configuration, not data: no column, no
request-scoped context, no host-based branching. Identity lives in the repository so it is
versioned, reviewable and deployed with the code.

**S2 — No client identity outside `src/site/`.** The client's name, phone number, street
address, domain and social handle may appear only under `src/site/`. Enforced by
`src/site/__tests__/brand-leak.test.ts`, which excludes test files (a fixture may name
anyone) and runs a positive control against the seam so a broken glob cannot pass as a clean
sweep.

**S3 — Brand tokens are per-client, from CSS.** `--brand` and `--brand-foreground` move from
`src/app/globals.css` to `src/site/<client>/theme.css`. The product imports
`src/site/theme.css`, a stable path that resolves to the active client's tokens, so
`src/app/layout.tsx` never names a client. `globals.css` keeps the neutral ramp and the
`@theme inline` mapping, so `.bg-brand`, `.text-brand` and `.border-brand` keep working.

**S4 — Page copy and structured data are per-client.** The four static public pages take
their title, description, canonical and social images from `buildPageMetadata(activeSite,
page, canonical)`. The landing's `AutoDealer` JSON-LD derives name, telephone, address, geo,
map and opening hours from `activeSite.identity`. No literal in a page.

**S5 — Deployment overrides keep their precedence.** `NEXT_PUBLIC_SITE_URL`,
`NEXT_PUBLIC_WHATSAPP_PHONE`, `NEXT_PUBLIC_INSTAGRAM_URL` and `NEXT_PUBLIC_MAPS_URL` still win
over the identity (`env ?? identity`), resolved once in `src/site/compose.ts` instead of in
three components. An empty value counts as absent. The `tel:` link is built from the
published number, not from the override: a tracking number in a link that sits next to the
printed number is a mismatch a customer notices.

**S6 — Zero visual change.** The rendered HTML of `/`, `/autos`, `/autos/hyundai-santa-fe`,
`/contacto` and `/ventas` is byte-compared against a capture taken on the base commit before
the change. Same markup, same metadata, same JSON-LD.

**S7 — Composition stays put.** The landing route still decides the order of its sections.
Moving that into `src/site/<client>/landing.tsx` is Phase 1, because it only pays off once
there is a second site to compose differently.

**S8 — The switch is not here.** `SITE_SLUG` and the fail-closed build check are Phase 1.
Today `src/site/active.ts` is a constant, and it is the only file Phase 1 has to change.

## Tasks

| ID  | Task                                                                   | Specs      | Route  | Commit |
| --- | ---------------------------------------------------------------------- | ---------- | ------ | ------ |
| T1  | `src/site/`: contract, deployment resolution, compose, glautos package | S1, S3, S5 | inline | C1     |
| T2  | Migrate consumers: layout, 4 pages, JSON-LD, data files, footer, hero  | S2, S4     | inline | C1     |
| T3  | Brand-leak sweep with a positive control                               | S2         | inline | C1     |
| T4  | Package consistency tests (CSS vs TS theme, tel/wa derivation, copy)   | S3, S5     | inline | C1     |
| T5  | Docs (`AGENTS.md`, roadmap) and the before/after HTML comparison       | S6         | inline | C1     |

## Log

- **L1 (user, verbatim):** "tambien ten en cuenta que al ser un producto single tenant
  tambien va a ser revendible a otros clientes, con lo cual la landing y paginas publicas
  deben de cambiar a otros diseños segun el cliente"
- **L2 (user, verbatim):** "procede con la Fase 0"
- **L3 (medición previa):** la marca vivía en **cuatro capas**: tokens en `globals.css`,
  `SITE_CONFIG` en `src/data/metadata.ts`, literales en 9 archivos de pantalla y env sueltas.
  "GL Autos" aparecía en 13 archivos, el teléfono en 8, la dirección en 3.
- **L4 (decisiones de forma):** el layout importa `src/site/theme.css` (ruta estable) y no
  `src/site/glautos/theme.css`: un import de CSS no puede ser dinámico, así que la
  indirección es lo único que impide que el producto nombre al cliente. Se verificó con el
  sweep: el path del import contaba como fuga.
- **L5 (dependencia permitida):** `src/lib/images/cloudinary-config.ts` importa
  `@/site/active` para la etiqueta de Cloudinary. Es la única dirección
  producto → site y es deliberada: una integración puede usar **etiquetas** del cliente y
  no puede ramificar su comportamiento según cuál sea.
- **L6 (verificación):** `tsc` 0 · **47 archivos / 362 tests** · `pnpm build` 0. El sweep
  baja de **13 archivos con "GL Autos" a 0** fuera de `src/site/`.
- **L7 (comparación HTML antes/después, build + start sobre la base real):** se capturaron
  `/`, `/autos`, una ficha real (`/autos/volkswagen-taos-highline-14-tsi-2025-0`),
  `/contacto` y `/ventas` en el commit base y después del cambio. Resultado: **markup,
  títulos, canónicas y JSON-LD idénticos**, con tres excepciones explícitas:
  1. Los hashes de los chunks de CSS/JS, que cambian por definición.
  2. `© <!-- -->2026<!-- --> GL Autos.` → `© 2026 GL Autos.` en el footer: **mismo texto
     renderizado**, un marcador de comentario menos de React. No se persigue la identidad
     byte a byte en los separadores que emite React.
  3. **Cambio intencional**: `og:title`, `og:description`, `og:url` y sus pares de Twitter
     en `/autos`, `/contacto` y `/ventas` ahora llevan el copy de **esa página** en vez de
     heredar el del sitio. Antes el `<title>` de la página y su `og:title` decían cosas
     distintas; el seam no puede reproducir esa contradicción porque el copy de la página
     sale de un solo lugar. Es la única diferencia de comportamiento del cambio.
- **L8 (dos cambios revertidos tras la comparación):** el `dayOfWeek` de un día pasó de
  string a array (`"Saturday"` → `["Saturday"]`) y `buildSiteMetadata` agregó un
  `alternates.canonical: "/"` que el layout nunca declaró (le habría puesto canónica a la
  404). Los dos se detectaron **solo** por el diff del HTML, no por `tsc` ni por los tests,
  y los dos se revirtieron.
