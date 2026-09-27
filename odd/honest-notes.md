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
