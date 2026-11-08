# image-uploads module — extract Cloudinary upload + guards into a reusable package

Deliverable: `/home/charly06arg/Desktop/Dev/Modules/image-uploads/` (outside this repo).
This document is the orchestrator record; no application code in `car-agency-app` changes.

## Specs

- **S1** — "necesito extraer la forma en la que se suben imagenes a cloudinary en conjunto con sus
  guards correspondientes": the module must expose the complete Cloudinary upload path _and_ its
  guards (identity, file validation, delete authorization), not just the SDK wrapper.
- **S2** — "la idea es modularizarlo y asi poder reutilizarlo en otros proyectos, como por ejemplo
  una web tipo ecommerce con catalogo de productos": the core must not import `@/site/active`,
  anything from `car-agency-app`, Prisma models (`Car.images`), or better-auth. Cloudinary `folder`
  and `tags`, the actor resolver and the delete-ownership check are all injected.
- **S3** — "La idea es crear una carpeta dentro de Desktop/Dev/Modules": target directory is
  `/home/charly06arg/Desktop/Dev/Modules/image-uploads/`.
- **S4** — "Módulo ahora, refactor aparte": `car-agency-app` application code is NOT modified in this
  pass. Its migration to the module is a separate task.
- **S5** — "Genéricos inyectables + adapter better-auth". The agreed entry point shape is:

  ```ts
  createUploadHandler({
    provider: cloudinaryProvider({ ... }),
    getActor: async (req) => session?.user ?? null,
    validate: { maxBytes: 15MB, mimePrefix: ['image/'] },
    authorizeDelete: async (key, actor) => prismaOwnershipCheck(key, actor),
    errors: { es: {...} }
  })
  ```

  The reusable core never depends on better-auth; a separate optional adapter maps a better-auth
  session to the module `Actor`.

- **S6** — "Source TS + vitest, sin build": the package is consumed as TypeScript source (no tsup,
  no `dist/`). `package.json` `exports` point at `./src/*.ts`. Tests run with vitest.

## Tasks

| ID  | Specs      | Route  | Commit             | State                                                                               |
| --- | ---------- | ------ | ------------------ | ----------------------------------------------------------------------------------- |
| T1  | S3, S6     | inline | n/a (outside repo) | done — package.json/tsconfig/vitest/.gitignore/gitignore                            |
| T2  | S1, S2     | inline | n/a                | done — `src/core/{types,errors,messages,validate,service,url}`                      |
| T3  | S1, S2     | inline | n/a                | done — `src/providers/cloudinary.ts`, SDK injected                                  |
| T4  | S1, S2, S5 | inline | n/a                | done — `src/guards/{types,policy}.ts`, delete fails closed                          |
| T5  | S1, S5, S6 | inline | n/a                | done — `src/next/{upload-handler,image-proxy-handler}.ts`, Web `Request`/`Response` |
| T6  | S5         | inline | n/a                | done — `src/adapters/better-auth.ts`, structural, no better-auth import             |
| T7  | S2, S4     | inline | n/a                | done — README + migration table + deliberate-differences table                      |
| T8  | S6         | inline | n/a                | done — `pnpm typecheck` clean, `pnpm test` 7 files / 110 tests                      |

Commits: the deliverable lives outside this repository, so ODD work-unit commits do not apply here.

Delivered at `/home/charly06arg/Desktop/Dev/modules/image-uploads/` (the directory on disk is
`modules`, lowercase). 2,835 lines of TypeScript across `src/` and `tests/`.

## Log

- **L1** (user, verbatim) — "necesito extraer la forma en la que se suben imagenes a cloudinary en
  conjunto con sus guards correspondientes, la idea es modularizarlo y asi poder reutilizarlo en
  otros proyectos, como por ejemplo una web tipo ecommerce con catalogo de productos. La idea es
  crear una carpeta dentro de Desktop/Dev/Modules"
- **L2** (decisiones) — alcance: "Módulo ahora, refactor aparte". guards: "Genéricos inyectables +
  adapter better-auth". empaquetado: "Source TS + vitest, sin build".
- **L3** (evidencia, exploración) — estado actual en `car-agency-app`:
  - `src/lib/images/image-provider.interface.ts` es lo único agnóstico: `upload(file)`,
    `delete(key)`, `deleteMany(keys)`.
  - `src/lib/images/providers/cloudinary.provider.ts` lee `process.env` a nivel módulo (efecto
    colateral en import).
  - `src/lib/images/cloudinary-config.ts` acopla el cliente: `tags: [activeSite.identity.name, "vehicle"]`
    y `folder: "car-agency-app"` hardcodeados.
  - `src/app/api/upload/route.ts` mezcla 3 guards: sesión → 401 `{error:"No autorizado"}`; mime no
    `image/` → 400; `size > 15MB` → 413; borrado con ownership Prisma + rol ADMIN → 403. Sin rate limit.
  - Defecto del original que NO se copia: `src/lib/auth/auth-middleware.ts` ya expone
    `requireAuth`/`requireAdmin` y la ruta de upload no los usa (duplica la lógica inline).
- **L4** (evidencia de cierre) — `pnpm typecheck` sin errores; `pnpm test` → 7 archivos, 110 tests en verde.
  Decisiones de implementación que el usuario debe conocer:
  - `cloudinary` v2 no expone la clase `Cloudinary` (verificado: `require("cloudinary").Cloudinary === undefined`),
    así que las credenciales son globales al proceso. El provider las configura en la factory (no en el import)
    y acepta un `sdk` inyectado para tests y para usos avanzados.
  - Los guards copiados no dependen de better-auth: `src/adapters/better-auth.ts` es estructural (solo tipa la
    sesión), por eso el core no arrastra la librería de auth.
  - `authorizeDelete` omitido ⇒ el borrado se rechaza (fail closed). El original no tenía default porque el
    chequeo Prisma estaba inlined en la ruta.
  - Los adapters usan `Response.json` estándar de Web, sin `next/server`, así que sirven también en Remix/Workers.
- **L5** (entorno) — pnpm 12 ignora `pnpm.onlyBuiltDependencies` de package.json; el allow-list de `esbuild`
  quedó en `pnpm-workspace.yaml` (`allowBuilds`). En un clon nuevo, `pnpm install --allow-build=esbuild` si
  vuelve a aparecer `ERR_PNPM_IGNORED_BUILDS`.
- **L6** (pendiente, fuera de este alcance por S4) — migrar `car-agency-app` al módulo. La tabla de migración
  está en el README del módulo. No se tocó código de la aplicación.
- **L7** (corrección de alcance, pedido del usuario) — el usuario preguntó si cambiar el provider de
  Cloudinary a R2/S3 rompe el módulo. Diagnóstico: el port, los guards, los handlers y los errores no se
  tocan; rompían **dos helpers** con forma de Cloudinary: `getPublicIdFromUrl` exigía el segmento `upload`
  y `createImageUrlResolver` insertaba siempre un segmento de transform. Autorizado a generalizarlos.
  Cambio (aditivo, retrocompatible, version 0.2.0):
  - `getPublicIdFromUrl` gana `afterSegment` (`"upload"` por defecto, `null` = todo el path es la key),
    `stripVersion` y `stripExtension`. Los defaults siguen siendo Cloudinary y un layout desconocido
    devuelve el fallback en vez de adivinar.
  - `createImageUrlResolver` gana `variantPlacement: "segment" | "none"` y `stripExtension`.
  - Test-first: 6 tests nuevos en rojo (118 total tras el GREEN), 112 previos intactos. `pnpm typecheck` limpio.
  - Documentación alineada: `AGENTS.md` y `docs/architecture.md` ya no declaran esos dos límites como
    no cubiertos, y el README muestra el caso bucket plano.
    Queda sin cubrir a propósito: layout por query string (`?w=400`). No se toca `ImageProvider`.
- **L8** (Fase 0 + Fase 1, autorizadas) — tras la auditoría del módulo el usuario aprobó el plan por fases
  con una precondición: eliminar todos los comentarios del código antes de crear el repo.
  - Strip de comentarios: el usuario eligió explícitamente **sin historia** (no se conserva el JSDoc
    eliminado) y **todo afuera** (JSDoc público incluido). 138 rangos en 13 archivos de `src/`;
    `tests/` quedó byte a byte idéntico porque sus `//` y `/*` eran literales de strings y regex.
    Herramienta nueva `scripts/remove-comments.mjs` basada en el scanner de TypeScript (no regex),
    idempotente (segunda pasada reporta 0). El `remove-comments` de `car-agency-app` que `package.json`
    invocaba **no existía**: la convención era una intención, no una herramienta.
  - Fase 0: `git init -b main`, commit inicial `b18378a` (34 archivos), `.github/workflows/ci.yml` con
    install frozen-lockfile + typecheck + test. Identidad git tomada del repo del usuario (no inventada).
  - Fase 1 (seguridad, test-first):
    - **B1** el handler buffereaba el body entero antes de mirar `file.size`. Ahora un `content-length`
      declarado por encima de `maxBytes + multipartOverheadBytes` (64 KiB por defecto) responde 413 sin
      parsear. Límite honesto: un body chunked sin length sigue llegando a `formData()`.
    - **B2** XSS almacenado por SVG: `image/*` aceptaba `image/svg+xml` y el proxy lo servía desde el
      origen propio. Dos capas: `DEFAULT_BLOCKED_MIME_TYPES` (evaluado antes de la allow-list, con
      `blockedMimeTypes: []` para reactivar) y CSP `sandbox` en la respuesta del proxy.
      Evidencia: RED de 6 tests nuevos, GREEN 129 (118 + 11), `pnpm typecheck` limpio, cero líneas borradas
      en `tests/`. Commit `fix:` de 196 líneas + docs.
  - Pendiente del plan: H3 test de contrato contra el SDK real de Cloudinary y la migración de
    `car-agency-app` (H1 y H2 se cerraron en L9).
- **L9** (Fase 2, autorizada) — H1 timeouts/abort y H2 cota de concurrencia, test-first: 17 tests nuevos,
  **146 totales** en 8 archivos, `pnpm typecheck` limpio.
  - `src/core/concurrency.ts` nuevo: `mapWithConcurrency` preserva el orden de entrada, nunca excede el
    límite y normaliza límites inválidos (0, negativo, NaN) a 1. `deleteMany` lo usa con `concurrency`
    (default `DEFAULT_DELETE_CONCURRENCY = 8`) en vez del `Promise.allSettled` sin cota.
  - `UploadOptions.signal`: un aborto destruye el stream y rechaza `UPLOAD_FAILED`. El handler **no**
    inventa un signal: se pasa por `uploadOptions` desde el runtime del consumidor.
  - Proxy: `timeoutMs` (default `DEFAULT_IMAGE_PROXY_TIMEOUT_MS = 10000`) combinado con `request.signal`
    vía `AbortSignal.any`, y además el handler corre el fetch contra el signal, así que un `fetch` que
    ignora el abort tampoco cuelga. Timeout → nuevo código `TIMEOUT`/504; cualquier otro fallo sigue 500.
  - Desvío autorizado por el padre: el worker chocó con una restricción mía mal puesta — no podía cumplir
    "todo `init` lleva `signal`" y "no tocar aserciones existentes". Se autorizó `signal:
expect.any(AbortSignal)` en las dos aserciones de payload completo. `git diff -U0 tests/` muestra una
    única línea borrada (un import ampliado). Se rechazó la opción de esconder el signal como propiedad no
    enumerable: sería una trampa para el próximo mantenedor.
  - Corrección de premisa: `DOMException` **sí** es `instanceof Error` en Node ≥17, así que `describeError`
    devolvía sólo el mensaje y los timeouts se logueaban sin nombre. La rama `DOMException` ahora va antes
    de la de `Error`; ningún otro caso cambió su salida.
  - Límite documentado: una desconexión del cliente responde 500 `UPSTREAM_FAILED`, igual que un fallo
    upstream; sólo el motivo logueado difiere. Sólo el timeout se distingue, como 504.
- **L10** (publicación) — repo creado y pusheado: `CarlosSalega/image-uploads` **privado**, 5 commits,
  `main`, upstream configurado. El CI corrió en un runner limpio y pasó en 19 s con 9 archivos de test:
  resuelve la duda de si `pnpm install --frozen-lockfile` respeta `allowBuilds: esbuild` desde
  `pnpm-workspace.yaml` — sí. La identidad git se tomó del repo del usuario porque no había ninguna
  configurada (ni global ni local).
- **L11** (Fase 3b: migración de `car-agency-app`) — hecha y verificada: **56 archivos / 426 tests**
  (corrida propia, no sólo del worker), `tsc --noEmit` limpio, eslint limpio en los archivos tocados,
  diff de 11 archivos +227/−334. Estrategia de blast-radius mínimo: los cinco archivos de
  `src/lib/images/` quedaron como shims sobre el módulo, así **ningún call site cambió**; las dos rutas
  se reescribieron por dentro y conservan path, status y copy.
  Recorrido: la primera entrega volvió en `interaction_required` y con **cuatro regresiones reales**.
  Tres se corrigieron en la app (provider lazy y memoizado para no romper en import; `resolveProvider`
  para volver a honrar `IMAGE_PROVIDER`; `logger` mapeado a `console.warn/error` para no perder los
  logs de fallo) y una era un **hueco del módulo**: `CloudinaryUploadDefaults` no podía expresar
  `quality`/`fetch_format` del original almacenado → corregido y pusheado en `27ac9cb`.
  Test de pinning: el usuario eligió permitir specs locales; se agregó `LOCAL_SPEC` y un test que fija el
  **conjunto exacto** de specs permitidos, así la excepción no se amplía sin editar una línea visible en
  el diff.
  Abierto: la resolución en runtime del paquete TS vía `transpilePackages` nunca se ejecutó
  (`next dev`/`build` no corrieron); `file:../../modules/image-uploads` **no es desplegable** (falta pasar
  a git dependency fijada a commit o a registry); el trabajo está **sin commitear**; la suite de contrato
  viva sigue sin correr por falta de credenciales (`.env` bloqueado por política).
- **L12** (verificación en runtime, `next dev` en el puerto 3000) — con tres requests sin sesión, que
  prueban lo que ningún test unitario probaba: que Next resuelve y transpila el paquete TypeScript fuente.
  - `POST /api/upload` → `401 {"error":"No autorizado"}`
  - `DELETE /api/upload` → `401 {"error":"No autorizado"}`
  - `GET /api/images/no-existe-esta-clave.webp` → `404 {"error":"Imagen no encontrada"}`

  Los tres cuerpos provienen del `ES_MESSAGES` del módulo, así que `transpilePackages` funciona, las dos
  rutas resuelven a las factories nuevas y los guards corren en orden (autenticación antes que todo). El
  404 del proxy prueba que se llegó al upstream; **no** prueba que el cloud name sea correcto, porque una
  URL con cloud inválido también responde 404. Queda sin verificar por el padre la subida autenticada
  real: el usuario reporta que la subida funciona, pero no observé el `{success,key,url}` de esa subida.
