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

## Verified

`tsc` 0 · **54 files / 408 tests** · `pnpm build` 0 · `/autos` answers 308 to `/catalogo` ·
`/catalogo`, `/ventas`, `/contacto` and a car detail answer 200 with the new footer ·
`/catalogo?q=hilux` returns one unit · renders checked at 1440, 1024, 768 and 390.

## Log (continuación)

- **L6 (bugs que sólo aparecieron al mirar el render):**
  1. La foto del hero no llenaba: el contenedor declara `min-height`, así que un
     `h-full` adentro mide 0. Se resolvió con capas absolutas.
  2. El skeleton de `CarImage` (`z-10`) tapaba el caption del hero. Ahí corre con
     `skipSkeleton`, porque en el hero la foto **es** el fondo.
  3. El rótulo de marca quedaba gris sobre una foto clara. Ahora va con su propio
     scrim.
  4. Los horarios se partían por espacios y producían "SÁB 9–12:30" como etiqueta y
     "hs" como valor. Se renderizan como líneas.
  5. `dealerDescription` todavía decía "Concesionario" (y se publica en el JSON-LD):
     el barrido de vocabulario no lo veía porque el test de marca sólo busca nombres.
- **L7 (decisión, mapa):** el artboard dibujaba un mapa; se implementó un **cartel**
  con la dirección y un link a Google Maps. Un iframe de Google carga sus scripts y
  cookies, y el texto de privacidad que lo justificaría sigue pendiente (T0.5).
- **L8 (pendiente real):** `/catalogo` funciona (18 unidades, paginado, `?q=`) pero
  conserva el lenguaje visual anterior: cards con radio, navbar viejo, buscador
  redondeado. Necesita su propio artboard antes de tocarse. Es T8.

- **L9 (header mobile, pedido del owner):** "en mobile debemos de tener logo - espacio - boton de
  busqueda con icono de lupa, el boton de whatsapp y barra de busqueda completa no van, recuerda que
  la resolucion minima debe de ser 320px de ancho". Implementado con `<details>`/`<summary>`: la lupa
  es un summary focusable que abre y cierra con Enter o Space, sin JavaScript, y el formulario se
  despliega en una fila debajo del header. WhatsApp queda sólo en desktop (en mobile ya está el
  botón flotante). Medido con Chrome a 320/360/390/768/1440: en mobile el header tiene **dos** items
  (logo 93px + lupa 42px), alto 59px, y `scrollWidth === viewport` en 320 — sin scroll horizontal.
- **L10 (bug evitado):** `autoFocus` en el input del buscador mobile no puede funcionar — vive dentro
  de un `<details>` cerrado, así que el navegador lo ignora y sólo queda código muerto con riesgo de
  scroll inesperado. Se quitó.

- **L11 (`<details>` → componente cliente, pedido del owner):** "agrega una micro interaccion al
  boton de busqueda y haz que si clickeo en el espacio en blanco del header este cierre la barra de
  busqueda, ahora solo cierra cuando hago click en el boton de busqueda con lupa". Un `<details>`
  nativo no cierra con un click afuera ni con Escape, así que la lupa pasó a
  `site-search.tsx` (cliente, el único del header). Mantiene: abrir/cerrar con click, cierre por
  `pointerdown` fuera del panel y del botón, Escape devuelve el foco al botón, y el campo se enfoca
  al abrir. Micro-interacción: `scale(0.95)` al presionar, 120–150ms ease-out, el borde toma el
  color de marca y la lupa rota a una X; todo con `motion-reduce:` apagado para quien lo pide.
- **L12 (verificación de la interacción, CDP a 320px):** inicial cerrado (`aria-expanded="false"`);
  click en la lupa → abierto, `aria-expanded="true"`, foco en `site-search-mobile-field`; click en el
  espacio en blanco del header → cerrado; Escape → cerrado; `scrollWidth` = 320 en los cuatro
  estados, así que ningún estado introduce scroll horizontal.

- **L13 (logo del header):** "el detalle que falta es que el logo debe de ser el logo-wordmark.png".
  El header usaba texto con tracking; ahora usa la imagen de marca (`activeSite.assets.wordmark`)
  con `next/image`, sin el cuadrado rojo (el wordmark ya trae el monograma). Altura 16px en mobile
  (151px de ancho) y 20px en desktop (188px). Medido: `scrollWidth === viewport` en 320 y 375, header
  de 57px; en 768 y 1440 el logo pasa a 188x20.
