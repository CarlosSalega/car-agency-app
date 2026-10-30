# Archivo congelado — notas honestas (log 2026-09-22 → 2026-09-28)

> **No editar este archivo.** Es el log cronológico original con sus correcciones
> inline (`[RESUELTO]`, `[CORREGIDO]`, `[NO ES BUG]`), conservado como evidencia de
> qué se midió y cuándo. La lectura vigente está en `odd/honest-notes.md`, que está
> ordenado por estado y revisado el 2026-10-29 sobre `main @ 85a0060`.
>
> Varias afirmaciones de este log ya no describen el código: los conteos de lint,
> el par de tokens `secondary`, el deploy de Vercel, la fuga de `hashedPassword` y
> los guards de `/api/settings`. Si hay conflicto, gana `odd/honest-notes.md`.

---

# Notas honestas — deuda, riesgos y gotchas (revisar después)

Fuente: hallazgos de implementación y writers, sesión 2026-09-22. No son urgentes, pero no perderlas.

## Seguridad / idempotencia

- [2026-09-22] `DELETE /api/cars/[id]`: el early-return idempotente (`deletedAt` → 200) quedó ANTES del check de permisos. Un repetido por no-dueño devuelve 200 en vez de 403. Aceptable por idempotencia, revisar si molesta.
- [2026-09-22] Guards `isDeleting`/`isDeactivating` son solo en memoria (una pestaña). Doble submit cross-tab depende del early-return del backend (ya existe).
- [2026-09-22] En error, el diálogo de autos queda abierto y el de usuarios se cierra. Divergencia previa, se dejó como está.

## UI / diseño

- [2026-09-22] Combo `bg-secondary` + `text-secondary-foreground` (dorado + gris claro) tiene poco contraste. Vive en `Button` secondary, `Badge` secondary y badges viejos. Ya corregido en header CTA, services badges y contacto (texto oscuro), pero el sistema lo sigue ofreciendo.
- [2026-09-22] `min-w-32` en botones de submit de dialogs calza con tokens actuales de botón; si cambian font/padding, retocar.
- [2026-09-22] `SectionHeading` hardcodea `<h2>` y es client (animación) — no reutilizable directo donde se necesita `h1` o server puro (caso /ventas).
- [2026-09-22] Pendiente decisión Sheet vs Dropdown en menú móvil del header (usuario comparando en dev).

## Datos / backend

- [2026-09-22] `LinkTreeLink.createdAt` vuelve string del JSON al crear/editar (crash del sort). Parcheado en 2 capas en `links-config.tsx`, pero el patrón se puede repetir en otros forms que metan `json.*` al estado.
- [2026-09-22] No hay filtro por condición (usado/0km) en `/autos`. Badges de servicios quedaron estáticos a propósito.
- [2026-09-22] `NEXT_PUBLIC_SITE_URL` en Vercel apunta a vercel.app — cambiar a Car Agency Appautomotores.com en dashboard + redeploy (las `NEXT_PUBLIC_*` se hornean en build).

## Lint / tipos (pre-existente, no nuestro)

- [2026-09-22] eslint `no-explicit-any`: `models-config.tsx:176` (`json`), `user-form-dialog.tsx:128` (`payload`), `api/users/[id]/route.ts:106` (`updateData`).
- [2026-09-22] tsc: `tag-selector.tsx` x2 (export `Tag`, módulo `tag-utils`), `meta-pixel/events.ts` x1 (`TrackFunction`).
- [2026-09-22] `Link` importado sin usar en `autos/[slug]/page.tsx` (warning).
- [2026-09-22] Caveat viejo: URLs con `maxYear/minPrice` filtran sin control visible en /autos (chips de filtros propuestos, pendiente).

## Deuda técnica medida — 2026-09-26

Medido con `pnpm exec eslint . -f json` sobre `580a826`. **132 problemas: 11 errores, 121 warnings.** `pnpm lint` falla hoy y por eso no puede ser gate de nada.

### [RESUELTO 2026-09-26] El 70% del ruido era de terceros

| Regla                                      | Cantidad | Dónde                                                                            |
| ------------------------------------------ | -------- | -------------------------------------------------------------------------------- |
| `@typescript-eslint/no-unused-expressions` | 78       | **1 solo archivo**: `.agents/skills/impeccable/scripts/modern-screenshot.umd.js` |
| `@typescript-eslint/no-unused-vars`        | 16 de 34 | `.agents/skills/impeccable/scripts/live-browser.js`                              |

Eran bundles de skills de terceros commiteados en `.agents/`. **Resuelto:** se agregó `.agents/**` al `ignores` de `eslint.config.mjs` con un comentario explicando el porqué. Medido después: **132 → 35 problemas**, 0 remanentes en `.agents/`. Sin tocar una línea de código de aplicación.

### Lo que SÍ es deuda real (35 problemas en `src/`)

- [2026-09-26] **[RESUELTO] ERROR `react-hooks/rules-of-hooks` en `src/app/(landing)/components/Reviews.tsx:186`.** `useScrollAnimation` se llamaba DENTRO del callback de `REVIEWS.map((review, i) => ...)`. Corregido en `8697774`→ commit del writer: se extrajo un componente `ReviewCard` en el mismo archivo, cada review tiene su propia instancia del hook, su propio `IntersectionObserver` y su propio `isVisible`. Errores repo: 11 → 10. La nota original decía:
  `useScrollAnimation` se llamaba DENTRO del callback de `REVIEWS.map((review, i) => ...)`. Eso es N instancias del hook creadas en un bucle dentro del render: viola las reglas de hooks y solo aparenta funcionar porque el largo del array es constante. El fix correcto era extraer un componente `ReviewCard` y llamarlo por review, no reordenar el código para silenciar la regla. **Era el único error del repo que podía cornear un bug real de render.**

- [2026-09-27] **Pendiente deliberado:** `useScrollAnimation<HTMLDivElement>` tipa el ref como `HTMLDivElement` pero se adjunta a un `<article>` (`HTMLElement`). TS no se queja porque las props `ref` de React son bivariantes. Type lie real, a tighten por separado.
- [2026-09-26] **10 errores `@typescript-eslint/no-explicit-any`**, todos en `src/`: `api/users/[id]/route.ts:106`, `components/form/form-field.tsx:10`, `components/login-form.tsx:43`, `components/models-config.tsx:183`, `components/users/user-form-dialog.tsx:128`, `lib/auth/auth-middleware.ts:47` y `:69`, `lib/cache/cache-key.ts:1`, `lib/images/providers/cloudinary.provider.ts:18`, `lib/prisma-safe.ts:21`. Los de `auth-middleware.ts` y `prisma-safe.ts` son los que más importan: son frontera de auth y de acceso a datos.
- [2026-09-26] 7 warnings `@next/next/no-img-element` en 6 archivos — la decisión entre imagen nativa y `next/image` se toma por archivo, no globalmente.
- [2026-09-26] 2 warnings `react-hooks/exhaustive-deps`. Vale revisar: los hooks mal declarados suelen ser la causa raíz del error de `Reviews.tsx`.

### Estado real hoy: 11 errores, 24 warnings — todos en `src/`

### Orden sugerido cuando se ataque

1. ~~Ignorar `.agents/**` en ESLint~~ — **hecho**, 132 → 35.
2. ~~`Reviews.tsx` extraer `ReviewCard`~~ — **hecho**. Ya no queda ningún error con riesgo de render.
3. ~~Los `any` de `auth-middleware.ts:47,69` y `prisma-safe.ts:21`~~ — **hecho**. Errores repo: 10 → 7. Los 7 restantes (todos en `src/components/` y `src/app/api/`) son los siguientes.
   - **Hallazgo grande del mismo trabajo:** `withAuth`, `withAdmin`, `requireAuth` y `requireAdmin` tienen **cero call sites** fuera de su propio archivo. `index.ts` los re-exporta y nadie los importa. Lo que hoy protege `/admin` es `requireAuthSession()` (`session.ts:62`) usada por `admin/page.tsx`, `admin/config/page.tsx` y `admin/users/page.tsx`, más el check de cookie en `src/proxy.ts`. O sea: el módulo que acabamos de tipar está **muerto**. Tiparlo fue correcto (es la forma que debería tener la API) pero **no endureció ninguna ruta de autorización viva**. Una revisión real de autorización tiene que empezar por `requireAuthSession` + `proxy.ts`, no por `auth-middleware.ts`.
   - El helper de error de `prisma-safe.ts` NO puede ser `error instanceof Error`: eso convertiría en "no reintentable" un throw de tipo objeto plano `{ message: "Connection terminated" }`, que el código anterior sí detectaba. Regresión de resiliencia escondida detrás de una mejora de tipos. Quedó duck-typed con type guard.
4. El resto de `any`, los 7 `no-img-element` y los 2 `exhaustive-deps`.

**Estado del gate:** el hook de pre-commit sigue corriendo solo `prettier --check`. Con los 10 `any` que quedan, agregar eslint al hook haría fallar cada commit. Orden: cerrar (3) primero, después agregar eslint al hook.

## Auditoría de autorización — 2026-09-26

Task doc: `odd/tasks/close-live-authorization-holes.md`. Tres work units, tres commits.

### [RESUELTO] W1 — `isActive` re-chequeado en el choke point

- [2026-09-26] `getSession()` (`src/lib/auth/session.ts:40`) ahora devuelve `null` si `!session.user.isActive`, en la misma condición que ya cubría sesión ausente y expirada. Reparó de una sola vez los call sites inline de `getSession()` en 22 archivos. No se borran filas de `Session`: una cuenta desactivada deja de autorizar, pero su fila y su cookie siguen hasta que expire (1h) o se cierre sesión. follow-up abierto.

### [RESUELTO] W2 — `GET /api/cars/[id]` guardado yestrecho

- [2026-09-26] El handler `GET` era el único del archivo sin check de sesión. Ahora usa el mismo guard que `PUT`/`DELETE` (401, `"No autorizado"`). El `where` pasó a `{ id, deletedAt: null }` y `user: true` se reemplazó por un `select` explícito de `id`, `name`, `email`, `role` — sin `hashedPassword`. Códigos 404/500 y mensajes en español sin tocar.

### [RESUELTO] W3 — `DELETE /api/upload` deniega keys sin dueño

- [2026-09-26] Una `key` referenciada por ningún auto ahora devuelve 403 en vez de caer a `ImageService.delete(key)`. La lógica owner-or-ADMIN para keys referenciadas quedó idéntica.

### Sigue ABIERTO (fuera de alcance, deliberado)

- [2026-09-26] **H-2** `lib/queries/cars.ts:163` y `:211-215` — el mismo `user: true` filtrando `hashedPassword` por el payload RSC a un client component. **Abierto.** W2 arregló solo el endpoint, no el payload.
- [2026-09-26] **H-3** Sin rate limiting en login. **Abierto.**
- [2026-09-26] **M-1** `GET /api/settings` sin sesión. **Abierto.**
- [2026-09-26] **M-2** `GET /api/sellers` expone PII de vendedores. **Abierto.**
- [2026-09-26] **M-3** Ownership de autos en admin. **Abierto.**
- [2026-09-26] **M-4** Token de sesión sin hashing. **Abierto.** (Mismo archivo que W1, decisión separada.)
- [2026-09-26] **M-5** `api/images/[...path]` — posible path traversal. **Abierto.**
- [2026-09-26] **M-6** Comentario `ADMIN_NAVIGATION`. **Abierto.**
- [2026-09-26] **L-1** 401 vs 403 inconsistentes. **Abierto.**
- [2026-09-26] **L-2** Headers de seguridad en `proxy.ts`. **Abierto.**

### Verificación de esta tanda

`tsc --noEmit` exit 0. ESLint sin cambio: `errors 7 warnings 24` antes y después. Prettier limpio en los 4 archivos. **Sin cobertura de tests:** este repo no ejercita route handlers, así que la prueba es tsc + ESLint + Prettier + lectura del diff. Los tres comportamientos (criterios 5, 4 y 6) están verificados por lectura, no por ejecución.

## `sslmode` explícito + guard de boot — 2026-09-27

Task doc: `odd/tasks/pin-db-ssl-mode.md`. Tres work units, tres commits (W1 sin commit, ver abajo).

### [RESUELTO] W2 — `findInsecureSslMode` + throw en producción

- [2026-09-27] `src/lib/db/assert-secure-ssl.ts` (nuevo) exporta `findInsecureSslMode(connectionString): string | null`. Función pura: recibe la connection string como argumento, no lee `process` ni toca ningún global, no conecta a nada. `verify-full` es el único valor aceptable; `require`, `prefer`, `verify-ca`, `allow`, `disable`, `sslmode` ausente (`"<missing>"`), casing distinto (`VERIFY-FULL`) y connection string no parseable (`"<unparseable>"`) se rechazan. Usa `new URL(...).searchParams` con `try/catch` para no propagar un `TypeError` inesperado.
- [2026-09-27] La **decisión** de tirar vive en `createPrismaClient()` (`src/lib/db/db.ts`), NO dentro de la función pura, y está condicionada a `process.env.NODE_ENV === "production"`. Razón: un Postgres local sin TLS es un setup de desarrollo legítimo; un guard que lo bloquea enseña a desactivar el guard. Test: `src/lib/db/__tests__/assert-secure-ssl.test.ts`, 8 casos, cubre todos los del criterio de aceptación 6.
- [2026-09-27] Sin tocar: el adapter (`new PrismaPg({ connectionString })`), el ciclo de vida del `PrismaClient`, el cacheo de `globalForPrisma` y el error existente de `"DATABASE_URL is not set"`. No se agregó `NODE_OPTIONS=--no-warnings` ni ninguna supresión de warnings: con `verify-full` el warning de `pg` desaparece solo.

### [RESUELTO] W3 — `@neondatabase/serverless` eliminado

- [2026-09-27] Dependencia quitada de `dependencies` con `pnpm remove` y lockfile refrescado. El repo no la usaba en ningún lado: la base es Prisma Postgres (`pooled.db.prisma.io`), no Neon. Quedaba de una migración anterior y le decía al siguiente lector algo falso.

### [LOCAL-ONLY] W1 — el cambio REAL de `.env` NO está en git

- [2026-09-27] `.env` ahora dice `?sslmode=verify-full` (antes `?sslmode=require`) con un comentario de 3 líneas arriba explicando por qué. **Es un edit local únicamente: `.env` está en `.gitignore` (`.gitignore:9`, patrón `.env*`), así que W1 no aparece en `git status` y no tiene commit. No se hizo `git add -f` ni se movió el valor a un archivo versionado.** El fix no está capturado en el historial: se pierde en cada máquina nueva.
- Motivo real: `pg` v8 trata `require` como alias de `verify-full` (cifra Y verifica el certificado) y avisa; `pg` v9 le devuelve la semántica real de libpq (cifra, **sin** verificar el certificado). El proyecto está seguro hoy y se volvería vulnerable en el próximo bump de dependencia, sin error y sin segundo warning.

### [CORREGIDO 2026-09-27] No hay nada pendiente en Vercel: el proyecto nunca se deployó

- [2026-09-27] **Corrección.** Esta nota antes decía que había que cambiar a mano el `DATABASE_URL` del dashboard de Vercel y que el riesgo de MITM seguía vivo en producción. **Eso era falso.** El proyecto nunca se deployó: existe `vercel.json` con `installCommand` y `buildCommand`, pero **no hay `.vercel/`**, o sea nunca se linkeó a ningún proyecto. No hay dashboard, no hay variable de entorno, no hay producción. El riesgo es **potencial y futuro**, no activo.
- [2026-09-27] El `.env` local ya dice `sslmode=verify-full`, así que el warning de `pg` que originó todo esto ya no aparece en desarrollo. El estado local está correcto y completo.
- [2026-09-27] **El gap real que queda no es "cambiar Vercel": es que NO existe `.env.example`.** Quien haga el primer deploy va a inventar la `DATABASE_URL` desde cero, y el valor al que va a llegar por defecto es `?sslmode=require` — exactamente el string que hoy es seguro por accidente (alias de `pg` v8) y deja de serlo en `pg` v9. Un `.env.example` versionado convierte "recordá ponerlo explícito" en "no hay forma de equivocarse". **Es el siguiente trabajo pendiente de esta tanda.**
- [2026-09-27] El guard de W2 (`findInsecureSslMode` + throw en producción) sí sobrevive al deploy: es lo que va a hacer fallar el build nombrando el modo culpable si alguien escribe `require`. Es la mitad útil de la defensa; el `.env.example` es la otra mitad.

### Verificación de esta tanda

`tsc --noEmit` exit 0. `pnpm test` en verde, 8 tests nuevos en verde. ESLint sin cambio: `errors 7 warnings 24` antes y después. Prettier limpio en los 4 archivos. Sin supresión de warnings, sin `any`, sin `eslint-disable`.

## Guards de autorizacion en la API — 2026-09-28

### [RESUELTO] `GET /api/settings` y `GET /api/settings/[key]` sin ningun guard

- [2026-09-28] Ambos handlers devolvian la tabla `Settings` completa —y un registro
  individual— **sin sesion y sin chequeo de rol**. El detalle que lo delata: `getSession`
  ya estaba importado en los dos archivos y lo usaban `POST`/`PUT`/`DELETE`, pero no
  `GET`. Asimetria de guard, no decision de diseno.
- Se les aplico el mismo guard que sus hermanos en el mismo archivo:
  `if (!session || session.user.role !== "ADMIN")` -> 401 `"No autorizado"`.
- **Verificacion: por lectura del diff, typecheck y lint. NO por ejecucion.** Este repo no
  tiene ningun test de route handler (`find src -name "*.test.*" -path "*api*"` no
  devuelve nada). El guard es correcto por construccion y coincide con los otros
  metodos del archivo, pero nadie lo ejecuto.

### [DEUDA] La API de `/api/settings` es huerfana y nadie la consume

- [2026-09-28] `grep -rn "api/settings" src/` fuera de los propios route files **no
  devuelve nada**. La pagina `/admin/config` consulta Prisma directo
  (`admin/config/page.tsx:30-45`), no la API. El modelo `Settings` es un
  `key`/`value` generico de strings y no tiene consumidor en la app.
- Es decir: hay una superficie CRUD completa y autenticada para una tabla que la
  aplicacion no usa. El guard nuevo la cierra, pero **la pregunta de fondo es si esta
  tabla debe existir**. Si el CMS/CRM/ERP la va a usar, es el lugar natural para
  configuracion editable; si no, es codigo muerto con base de datos.
- **No se decidio.** Requiere vision de producto.

### [DEUDA] `withAuth`, `withAdmin`, `requireAdmin` y `AuthError` son codigo muerto

- [2026-09-28] `src/lib/auth/auth-middleware.ts` (~100 lineas) no tiene **ningun** import
  fuera de si mismo. Las rutas inlinean el chequeo de rol una por una. El modulo se
  reexporta desde `src/lib/auth/index.ts:1`, asi que viaja en el bundle sin usarse.
- **Por que importa mas alla del dead code:** dos Regulatory efectos. (1) El proximo
  dev que necesite proteger una ruta va a usar `withAdmin` creyendo que es el patron
  del repo, sin saber que ninguna ruta lo usa. (2) El patron real —inline, repetido en
  14 archivos— es el que no tiene tests, asi que cada copia es una oportunidad de
  divergir.
- Dos salidas: conectar las rutas al wrapper, o borrar el modulo. **No se decidio.**
  Con la expansion prevista a CMS/CRM/ERP y nuevos roles, la capa de autorizacion va a
  cambiar de forma: conviene resolverlo cuando la politica de roles este definida, no
  antes.

### [NO ES BUG — decision de producto] `sellerId` asignable por cualquier COLLABORATOR

- [2026-09-28] `POST /api/cars` valida `sellerId` solo por existencia e `isActive`, y
  `PUT /api/cars/[id]` deja que un owner no-ADMIN reescriba el `sellerId` (`:205`). Se
  documento como posible escalada de privilegios.
- **El usuario decidio que es intencional**: un COLLABORATOR puede asignarle cualquier
  vendedor a cualquier auto, porque el proyecto va a expandirse a un CMS/CRM/ERP con
  roles de Vendedores. La asignacion libre es el andamiaje de ese rol futuro.
- Lo mismo aplica a `admin/layout.tsx`, que no chequea rol: `ADMIN_NAVIGATION` no
  declara `roles` para `panel` ni para `vehiculos`, y ambos son de acceso libre por
  diseno. **Poner un guard de rol en el layout habria sido una regresion funcional.**

### Leccion de esta tanda

Un permiso que parece amplio puede ser el andamiaje de un rol que todavia no existe.
Antes de cerrar un permiso como bug, hay que preguntar por la direccion del producto:
el codigo solo dice que hace, no por que.
