# Notas honestas — deuda, riesgos y gotchas

Estado por **estado**, no por antigüedad. Última revisión: **2026-10-29**, sobre
`main @ 85a0060`. La revisión previa completa era del 2026-09-27/28.

El log cronológico original (2026-09-22 → 2026-09-28), con sus correcciones inline,
quedó congelado en `odd/honest-notes-archive.md`. **Si algo no está acá, no está
abierto** — el archivo existe justamente para no reabrir por olvido lo ya cerrado.

Cada ítem lleva evidencia `path:line`. Lo marcado _(lectura)_ se validó leyendo el
código, no ejecutándolo. Lo marcado **_[sin verificar]_** no se miró en esta pasada.

## Abierto

### Seguridad y autorización

- **`DELETE /api/cars/[id]`: el early-return idempotente va ANTES del chequeo de
  permisos.** `src/app/api/cars/[id]/route.ts:75-83`: `if (car.deletedAt) return 200`
  y el check de dueño recién en `:79`. Un segundo DELETE del mismo auto hecho por
  alguien que no es dueño devuelve `200 {success:true}` en vez de `403`. Confirma que
  el id existió, no filtra nada más. **Severidad: baja.** Fix: mover el check de
  dueño arriba del `if (car.deletedAt)`. _(lectura)_
- **`auth-middleware.ts` es código muerto con tests verdes.**
  `src/lib/auth/auth-middleware.ts` (~100 líneas: `requireAuth`, `requireAdmin`,
  `withAuth`, `withAdmin`, `AuthError`) no tiene un solo import fuera de sí mismo
  salvo el barrel `src/lib/auth/index.ts:4`. Y
  `src/lib/auth/__tests__/auth-middleware.test.ts` lo testea entero: **verde que
  sugiere cobertura de la frontera de auth cuando ninguna ruta usa ese módulo.** Lo
  que protege `/admin` hoy es `requireAuthSession()` (`src/lib/auth/session.ts`) más
  el check de cookie en `src/proxy.ts`. **Severidad: media (engaño estructural, no
  agujero).** Dos salidas: conectar las rutas al wrapper o borrar módulo + tests. No
  decidir antes de definir la política de roles del CRM/ERP. _(lectura)_
- **`GET /api/sellers` sin sesión, sin rol y sin `select`.**
  `src/app/api/sellers/route.ts:7-13`: `prisma.seller.findMany()` devuelve el registro
  completo del vendedor, incluida su PII. **Severidad: media.** _(lectura)_
- **`api/images/[...path]`: path traversal.** `src/app/api/images/[...path]/route.ts:22-38`
  concatena los segmentos a `CLOUDINARY_BASE_URL` o `S3_PUBLIC_BASE_URL` sin normalizar
  ni rechazar `..`. **Severidad: media** — depende del origen: Cloudinary no resuelve
  `..`, un S3 propio o un origen nuevo sí. _(lectura)_
- **`src/lib/rate-limit.ts` es código muerto, y el login depende del limitador
  implícito de better-auth.** El limiter casero (`src/lib/rate-limit.ts`, 107 líneas,
  5 intentos / 15 min por IP, con limpieza cada 30 min) **se borró el 2026-10-29**: era
  el consumidor de `src/app/api/auth/login/route.ts`, que la migración `fa06894` borró
  junto con sus 221 líneas de tests, y no tenía otro importador. Lo que sí limita el
  login hoy es el default de la librería:
  `enabled: options.rateLimit?.enabled ?? isProduction`
  (`node_modules/better-auth/dist/context/create-context.mjs:172`), con reglas
  especiales de **3 requests / 10 s** para `/sign-in`, `/sign-up`, `/change-password` y
  `/change-email`, 3 / 60 s para reset y verificación
  (`dist/api/rate-limiter/index.mjs:301-315`) y 3 / 10 s para `/two-factor/*`
  (`dist/plugins/two-factor/index.mjs:340-347`). `server.ts` no configura `rateLimit`,
  así que es todo default. O sea: **en producción el login ya está limitado; en
  desarrollo no** (`isProduction` = `NODE_ENV=production`), y por eso nunca se ve
  probando localmente. **Severidad: media**, no alta, por dos agujeros concretos:
  (1) el storage es `"memory"` (`create-context.mjs:175`) y no hay `secondaryStorage`:
  cada instancia serverless tiene su propio mapa, así que el límite real es "3 / 10 s
  por instancia caliente" y un cold start lo borra; se cierra con `secondaryStorage`
  (Redis/Upstash) o `rateLimit.storage: "database"`. (2) Sin
  `advanced.ipAddress.ipAddressHeaders`/`trustedProxies`, la librería no resuelve la IP
  y cae a un bucket compartido por path avisando por log
  (`dist/api/rate-limiter/index.mjs:43-49`): eso ya no es bypass sino **DoS**, porque 3
  intentos de cualquiera bloquean a todos. _(lectura)_
- **Sin headers de seguridad.** `src/proxy.ts:53,57` setea únicamente `Cache-Control`.
  No hay CSP, HSTS, `X-Frame-Options`, `X-Content-Type-Options` ni `Referrer-Policy`.
  **Severidad: baja-media**, sube el día del primer deploy. _(lectura)_
- **401 vs 403 inconsistentes.** 29 respuestas `"No autorizado"` (401) contra 4 `403` en
  `src/app/api`. **Severidad: baja** — cosmética de API, pero molesta para tests y
  clientes. _(lectura)_
- **El token de sesión no se hashea en la base (era M-4).** Sigue abierto, pero **ya no
  vive en `src/lib/auth/session.ts`**: las sesiones las administra better-auth. Hay que
  revisarlo sobre su tabla `session`, no sobre el código propio que ya no existe.
  **Severidad: baja-media** (requiere acceso a la base). **_[sin verificar]_**

### Datos y modelo

- **No existe el campo `condition` (usado/0km) en el schema.** El ítem viejo decía
  "falta filtro en `/autos`". No es un filtro: `grep condition prisma/schema.prisma` no
  devuelve nada, o sea es un agujero de modelo. Agregarlo implica campo + migración +
  backfill de los autos existentes + filtro + label. **Severidad: producto.**
  _(lectura)_

### UI

- **`SectionHeading` es client y hardcodea `<h2>`.**
  `src/app/(landing)/components/ui/SectionHeading.tsx:1` (`"use client"`, por la
  animación) y `:37` (`<h2>` fijo). No se puede reutilizar donde hace falta un `h1`
  (jerarquía SEO de una página que no sea la landing) ni desde un server component.
  **Severidad: baja.** _(lectura)_
- **Type lie del ref en `Reviews.tsx`.** `:152` declara
  `useScrollAnimation<HTMLDivElement>` y `:158` lo enchufa a un `<article>`. TS no se
  queja por la bivarianza de las props `ref` de React. No rompe hoy; rompe el día que el
  hook use la API propia de `HTMLDivElement`. **Severidad: baja.** _(lectura)_
- **`text-secondary` se usa como color de TEXTO y hoy `--secondary` es gris claro.**
  `src/app/globals.css:68` = `oklch(0.9288 0.0126 255.5078)`. Se consume como texto en
  `SectionHeading.tsx:21`, `LatestCarsSlider.tsx:135`, `Hero.tsx:169`,
  `NavbarClient.tsx:173,198`, `admin-dropdown.tsx:114,126` (y como `border-secondary` en
  `:126`). Sobre superficie clara el contraste cae a ~1.2:1; sobre sección oscura se ve
  bien. **Severidad: media si es regresión visual, ninguna si es intencional
  (plateado sobre negro).** Hay que mirarlo renderizado **por superficie** — no se
  cierra leyendo código. **_[sin verificar: requiere ojo humano]_**
- **`LinkTreeLink.createdAt` vuelve string desde el JSON y se parchea en 2 capas.**
  `src/components/linktree/links-config.tsx:118` (orden defensivo) y `:225` (coerción en
  el map). El parche está bien; el riesgo es el patrón: cualquier form que meta `json.*`
  crudo en el estado repite el bug. **Severidad: baja.** _(lectura)_
- **Guards de doble submit solo en memoria (una pestaña).**
  `src/components/brands-config.tsx:63,98` y `src/components/users/users-table-actions.ts:13,29`.
  Cross-tab depende del early-return del backend. **Severidad: baja.** _(lectura)_
- **Menú móvil del header.** La decisión vieja era "Sheet vs Dropdown", pero
  `src/components/header/header.tsx` no importa ninguno de los dos: la nota no describe
  el código actual. Si se quiere decidir, hay que redactarla de nuevo contra el
  componente real. **_[sin verificar: no se abrió el menú]_**

### Producto (necesita decisión, no código)

- **La API de `/api/settings` sigue huérfana.** `grep "api/settings" src/` fuera de los
  route files devuelve 0: `/admin/config` consulta Prisma directo. Hay un CRUD completo
  y autenticado para una tabla `key`/`value` que la app no usa. La pregunta de fondo:
  ¿es el lugar natural de la configuración del CMS/CRM/ERP, o es código muerto con base
  de datos? No decidido. _(lectura)_

### Lint y tipos

Ver la sección **Medición** más abajo. Resumen: **6 errores, 22 warnings**, y `pnpm lint`
todavía falla, así que **no puede ser gate**.

## Decidido — no tocar

- **`sellerId` asignable por cualquier `COLLABORATOR`** (`POST /api/cars`,
  `PUT /api/cars/[id]`). Es intencional: andamiaje del rol Vendedor del futuro
  CRM/ERP. No es escalada de privilegios.
- **`admin/layout.tsx` sin chequeo de rol.** Es intencional: `panel` y `vehiculos` son
  de acceso libre por diseño; `users`, `config` y `security` sí declaran
  `roles: ["ADMIN"]` en `src/data/admin-navigation.ts:43,52` y el sidebar filtra con eso
  (`src/components/admin/admin-sidebar.tsx:73`). Meter un guard en el layout sería una
  regresión funcional.
- **`.env` local con `sslmode=verify-full`.** Correcto y suficiente; el `.env` no se
  versiona (`.gitignore` → `.env*`) y el guard de producción
  (`src/lib/db/assert-secure-ssl.ts`) cubre el deploy. La otra mitad de la defensa,
  `.env.example`, ya existe.

## Resuelto (una línea cada uno, para no reabrirlos)

- **Fuga de `hashedPassword` por payload RSC** (era H-2) → `select` explícito y test que
  lo pincha: `src/lib/queries/__tests__/cars.test.ts:235`. `grep "user: true" src/` = 0.
- **`GET /api/settings` sin guard** (era M-1) → `src/app/api/settings/route.ts:8-11`
  exige `ADMIN`.
- **Faltaba `.env.example`** → existe, con `DATABASE_URL` + `sslmode=verify-full` (×2),
  `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `BETTER_AUTH_*` y
  `NEXT_PUBLIC_SITE_URL=http://localhost:3000`.
- **`NEXT_PUBLIC_SITE_URL` "apuntando a vercel.app"** → falso: no existe `.vercel/`, el
  proyecto nunca se deployó. La línea vieja contradecía la corrección del 2026-09-27 del
  mismo archivo.
- **Contraste `bg-secondary` + `text-secondary-foreground` (dorado + gris claro)** → los
  tokens cambiaron: `--secondary` gris claro (`globals.css:68`) con
  `--secondary-foreground` oscuro (`:69`), par con contraste correcto. El dorado ya no
  vive en `--secondary`.
- **`react-hooks/rules-of-hooks` en `Reviews.tsx`** → `ReviewCard` extraído, una
  instancia del hook por review.
- **`any` en `auth-middleware.ts` y `prisma-safe.ts`** → tipados (el módulo sigue
  muerto: ver _Abierto_). El helper de error de `prisma-safe` quedó duck-typed a
  propósito, para no convertir en "no reintentable" un throw de objeto plano.
- **`.agents/**` fuera de ESLint\*\* → 132 → 35 problemas en su momento, sin tocar código
  de aplicación.
- **Auditoría de autorización 2026-09-26:** `isActive` re-chequeado en el choke point
  (`getSession()`), `GET /api/cars/[id]` con guard y `select` acotado,
  `DELETE /api/upload` deniega keys sin dueño.
- **Código muerto de auth borrado (2026-10-29)** → `src/lib/rate-limit.ts` completo, y
  de `src/lib/auth/auth-middleware.ts` los wrappers `withAuth` / `withAdmin`. Sobreviven
  `requireAuth` / `requireAdmin` (siguen con cero call sites, ver _Abierto_). El wrapper
  se borró porque su firma `(request)` descartaba el segundo argumento de Next
  (`{ params }`): adoptarlo roto habría dejado sin `params` a toda ruta dinámica.
- **`@neondatabase/serverless` eliminado** — la base es Prisma Postgres, no Neon.
- **Hook de pre-commit autosuficiente**: exporta `PNPM_HOME`/`PATH` si `pnpm` no
  resuelve, así no muere con 127 desde VS Code o un GUI de git.

## Medición — 2026-10-29

Comando: `pnpm exec eslint . -f json` sobre `main @ 85a0060`, 18 archivos con
problemas.

| Métrica                | 2026-09-27 (doc viejo)     | 2026-10-29 |
| ---------------------- | -------------------------- | ---------- |
| Errores                | 7 (el doc también dice 11) | **6**      |
| Warnings               | 24                         | **22**     |
| Archivos con problemas | —                          | 18         |

Los 6 errores son todos `@typescript-eslint/no-explicit-any`:

| Archivo                                           | Línea |
| ------------------------------------------------- | ----- |
| `src/components/form/form-field.tsx`              | 10    |
| `src/components/login-form.tsx`                   | 45    |
| `src/components/models-config.tsx`                | 183   |
| `src/components/users/user-form-dialog.tsx`       | 128   |
| `src/lib/cache/cache-key.ts`                      | 1     |
| `src/lib/images/providers/cloudinary.provider.ts` | 18    |

Warnings: 13 `@typescript-eslint/no-unused-vars`, 7 `@next/next/no-img-element`,
2 `react-hooks/exhaustive-deps`. Ningún warning de `.agents/`.

**Estado del gate: no hay gate de lint.** `pnpm lint` falla por los 6 errores, y el
hook de pre-commit corre `pnpm exec lint-staged`, cuyo único comando configurado es
`prettier --check --ignore-unknown` (`package.json` → `lint-staged`). O sea: **el
formato se exige, el lint no.** Orden natural si se quiere cerrar: los 6 `any` primero,
y recién después agregar `eslint` al `lint-staged`.

## Límites de esta revisión

- **Nada se verificó por ejecución**: ningún guard de API se ejercitó. El repo tiene
  exactamente dos tests de route handler —
  `src/app/api/users/[id]/__tests__/route.test.ts` y
  `src/app/api/users/[id]/verify-email/__tests__/route.test.ts`. Nada cubre `cars`,
  `sellers`, `images` ni `settings`. La afirmación vieja de "este repo no testea route
  handlers" ya es falsa, pero la cobertura sigue siendo de dos archivos.
- Necesitan ojo humano, no grep: el contraste de `text-secondary` por superficie y el
  estado real del menú móvil.
- Los ítems de `session` (token sin hashing) quedaron sin abrir en esta pasada.
