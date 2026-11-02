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

- **L14 (header a 1024, reportado por el owner):** a partir de 1024 el nav entraba (`lg`) y ya no
  cabía: el campo quedaba en ~60px con el placeholder cortado. El nav pasa a `xl` (1280) y el
  buscador baja su techo de 400 a 360. Medido con Chrome: 1024/1180 → sin nav, campo de 283px,
  `scrollWidth` 1009/1165; 1280/1366/1440 → nav de 438px, campo 283px, `scrollWidth` 1265/1351/1425.
  En todos los anchos el header mide 63px y no hay scroll horizontal.

- **L15 (hero a 1024, reportado por el owner):** "esta dividido en 2 columnas verticales lo cual hace
  que quede mal, imagen muy grande y demasiado espacio en la columna derecha donde esta el texto". El
  split pasa a `xl` (1280), el mismo corte que el nav: entre 1024 y 1279 el hero se apila. Medido:
  1024 → una columna de 1009px, foto 1009×448 y panel 1009×500; 1280 → dos columnas de 632px, foto y
  panel de 633×738. Sin scroll horizontal en ningún ancho.

- **L16 (CTA del hero y del salón, reportado por el owner):** "no puede pasar que los cta tengan
  diferentes tamaños de ancho, menos en mobile que ocupen todo el ancho, el padding x de su contenedor
  les da el respiro". Los pares de CTA pasan a `grid gap-3 sm:grid-cols-2` con `w-full`: en mobile
  cada uno toma el ancho del contenedor (264px a 320, 334px a 390) y desde `sm` las dos columnas son
  `1fr`, así que miden exacto igual. **`flex-1` no servía**: reparte el sobrante pero respeta el
  `min-content` de cada hijo y dejaba 2px de diferencia a 768 y 1440.
- **L17 (caption de la foto):** a 320 el dato cortaba "0 / KM" en dos líneas. Ahora se apila: nombre
  arriba, año/kilómetros y precio abajo, cada fragmento con `whitespace-nowrap`. La línea de teléfono
  del hero también evita partir el número.

- **L18 (la foto del equipo como hero):** el owner dejó `public/hero` —un JPEG de 1440×1920 y
  897 KB sin extensión— y preguntó si genera confianza. Sí: cinco personas abrazadas delante del
  salón real, con el cartel de la dirección y el de "VENDEMOS TU USADO", prueba que el lugar existe y
  que atiende una familia. Implementado con tres recaudos: (1) convertido a `public/hero.webp`
  (430 KB) porque la LCP no puede ser un JPEG de 900 KB; (2) declarado como asset del cliente
  (`SiteAssets.hero`), no como contenido de la base; (3) `object-position: 50% 42%` para que el
  recorte deje las caras y el cartel del salón dentro del panel en todos los anchos. El hero deja de
  mostrar la última unidad: el precio se compara en la sección de ingresos, no en la portada.

- **L19 (`/catalogo`, primer paso):** "en /catalogo utiliza el mismo header de la landing y los bordes
  redondeados cambialos a recto". Hecho: `NavbarServer` → `SiteHeader` (y se fue el `pt-24`, que
  compensaba al navbar `fixed`), y `rounded-*` → `rounded-none` en card, badge de estado, chip de
  precio, estado vacío, paginación, buscador del catálogo, filtros de escritorio y hoja de filtros
  mobile. `Badge` es compartido con el panel, así que ahí el `rounded-none` va por `className` en la
  página y el componente queda igual para el admin. Sin sombras en las dos cajas que toqué
  (buscador y filtros): eran `shadow-sm` y `shadow-lg/30`, y el sistema nuevo no usa sombra.
  **Lo que queda de T8**: el layout del catálogo sigue siendo barra lateral de filtros + grilla;
  no hay artboard para eso todavía.

- **L20 (`/catalogo`, segunda pasada):** "quedó una barra de busqueda antigua que dice 'busca tu proximo
  auto' eliminala, tambien en el paginado los botones quedaron redondeados". Eliminado el
  `SearchComponent` de la página —y con él el componente y `src/data/hero.ts`, que sólo él importaba:
  quedaban como código muerto con el copy viejo adentro—. El paginado seguía redondeado porque los
  botones son el `Button` compartido, cuya base trae `rounded-md`; mi cambio anterior estaba en
  `car-grid` y no en el botón. Ahora el catálogo pasa un override descendiente
  (`[&_a]:rounded-none`) al `Pagination`, así el panel conserva su radio. El filtrado no se pierde:
  el buscador del header llega como `?q=` y la página lo mapea a `filters.search`.

- **L21 (la ficha entra a la superficie pública):** "ahora elimina los bordes redondeados de
  /autos/[slug]" y "tampoco tiene el mismo header publico de la landing". `NavbarServer` →
  `SiteHeader` (y `py-32` → `pt-8 pb-16`, que compensaba al navbar `fixed`), y esquinas rectas en:
  galería (imagen y miniaturas), `Card` de especificaciones (además `shadow-none`: el sistema público
  no usa sombra y esa Card se sostenía sólo con `shadow-xl/20` porque tenía `border-0`), y los tres
  `Badge` de estado. Los `input`/`button`/`a` del formulario y del botón de WhatsApp son primitivas
  compartidas con el panel, así que se apagan por selector descendiente en el contenedor de la ruta,
  no editando los componentes.

- **L22 (`/ventas` y `/contacto` fuera):** "quedan eliminados en este diseño, borralos". Borradas las dos
  rutas y todo lo que sólo ellas usaban: `components/contact-section.tsx`, y el navbar viejo completo
  (`NavbarClient` + `NavbarServer`), porque `public-query-error` pasó a `SiteHeader` y quedaron sin
  consumidores. Fuera también del sitemap, de la allowlist de `proxy.ts`, del footer (el link
  "Vendé tu auto") y del paquete de sitio (`SitePageKey` queda en `home | catalog`). **Las URLs viejas
  ahora responden 404: no agregué redirects porque no se pidieron**, pero conviene decidirlo (Google y
  los links ya compartidos apuntan ahí).
- **L23 (flechas de la galería):** "tiene flechas siempre visibles, haz que aparezcan solo cuando se
  hace hover sobre la imagen principal". El contenedor de la imagen principal es `group` y las flechas
  llevan `md:opacity-0 md:group-hover:opacity-100`, con `focus-visible:opacity-100` para teclado. En
  mobile quedan **siempre visibles**: ahí no existe hover y esconderlas las haría inalcanzables.

- **L24 (lightbox de la galería):** "al hacer click sobre la imagen principal abre un lightbox y en esta
  vista tenemos los mismos botones flecha pero con borde redondeado, verifica que en esta vista no haya
  nada más redondeado". Causa: el lightbox se renderiza en un **portal**, así que el selector
  descendiente del contenedor de la ruta no lo alcanza; los cuatro `Button` (cerrar, flechas del
  lightbox, flechas de la imagen) heredaban `rounded-md` de la base compartida. Ahora llevan
  `rounded-none` explícito. Auditoría del resto de la vista: `DialogContent` ya tenía `rounded-none!`,
  las miniaturas `rounded-none`, `CarImage` sin radio, y el botón de cierre por defecto del `Dialog`
  está oculto. **Regla**: un portal no hereda los selectores del contenedor de la página.

- **L25 (flechas en mobile + cambios del owner en footer y hero):** "en mobile las flechas de la galeria
  no deben de aparecer ya que tapan la vista" (captura a 320: las dos flechas blancas sobre el auto).
  Las flechas de la **imagen principal** pasan a `hidden md:flex`: en mobile se navega con las
  miniaturas de abajo, que ya están ahí. Las del **lightbox** siguen visibles: en mobile no hay tira de
  miniaturas (está `hidden sm:flex`) y el swipe no está implementado —los handlers táctiles son de
  zoom y paneo— así que esconderlas dejaría al visitante sin forma de cambiar de foto.
  El owner había editado `Footer.tsx` (quitó el cuadrado rojo, bajó la descripción a `text-xs`, partió
  el copyright en dos líneas) y `Hero.tsx` (quitó el rótulo de marca sobre la foto). Se conservan esos
  cambios; se corrigió el typo "reservadoss" y se dejó anotado que el `text-sm` agregado a la línea
  roja del hero no tiene efecto (el elemento no tiene texto y su tamaño lo fijan `h-px w-7`).

- **L26 (copy del hero y del recorrido):** "ahora tenemos una frase que termina 'con el negocio se arma
  aca' hay que buscar la manera de que las personas vean por qué deben de elegirlos a ellos y que el
  cliente sienta que está haciendo un negocio". El problema era **de sujeto**: la frase hablaba de lo
  que hace la agencia. Cambios:
  - H1: "Vos traés lo que tenés. **Te llevás un buen negocio.**" — se conserva la primera mitad
    aprobada y el sujeto pasa a ser el cliente con el resultado que se lleva. "Buen negocio" es la
    expresión rioplatense exacta para salir ganando en una operación, y no es un superlativo
    incomprobable ("el mejor").
  - Lede: tres hechos verificables en vez de una promesa — tasación en el día, precio publicado,
    verificación y transferencia incluidas.
  - CTA secundario: "Coordinar una visita" → **"Tasar mi usado"**, y ya no es un ancla: abre WhatsApp
    con el mensaje precargado (`whatsapp.hrefWith`). Arranca la operación; la visita sigue ofrecida en
    la sección del salón.
  - Por qué: reordenado para que el negocio vaya primero (tasación → financiación → papeles) y el
    título pasa a "Por qué te conviene hacerlo acá".
  - Ingresos: "El precio es de lista: el saldo se arma con parte de pago" → "Publicamos el precio de
    lista: después se descuenta tu parte de pago".
  - Formas de pago: "Armamos el negocio" → "Vemos cómo se paga".
    **Lo que deliberadamente no se usó**: superlativos ("los mejores precios"), números sin fuente
    ("+1000 clientes") y "precio final" (que el owner ya había señalado como irreal).
