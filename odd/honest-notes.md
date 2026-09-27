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

### Lo primero: el 70% del ruido NO es nuestro código

| Regla                                      | Cantidad | Dónde                                                                            |
| ------------------------------------------ | -------- | -------------------------------------------------------------------------------- |
| `@typescript-eslint/no-unused-expressions` | 78       | **1 solo archivo**: `.agents/skills/impeccable/scripts/modern-screenshot.umd.js` |
| `@typescript-eslint/no-unused-vars`        | 34       | 10 archivos (16 de esos en `.agents/skills/impeccable/scripts/live-browser.js`)  |

Son bundles de skills de terceros commiteados dentro de `.agents/`. **No son deuda de este proyecto, son ruido.** Falta un ignore de ESLint para `.agents/**`; con eso solo, `pnpm lint` deja de reportar ~94 de los 132 problemas y por fin puede usarse como gate. Es el arreglo de mayor retorno y el más barato.

### Lo que SÍ es deuda real (38 problemas en `src/`)

- [2026-09-26] **ERROR `react-hooks/rules-of-hooks` en `src/app/(landing)/components/Reviews.tsx:186`.** `useScrollAnimation` se llama DENTRO del callback de `REVIEWS.map((review, i) => ...)`. Eso es N instancias del hook creadas en un bucle dentro del render: viola las reglas de hooks y solo aparenta funcionar porque el largo del array es constante. El fix correcto es extraer un componente `ReviewCard` y llamarlo por review, no reordenar el código para silenciar la regla. **Es el único error del repo que puede cornear un bug real de render** — prioritario sobre el resto.
- [2026-09-26] **10 errores `@typescript-eslint/no-explicit-any`**, todos en `src/`: `api/users/[id]/route.ts:106`, `components/form/form-field.tsx:10`, `components/login-form.tsx:43`, `components/models-config.tsx:183`, `components/users/user-form-dialog.tsx:128`, `lib/auth/auth-middleware.ts:47` y `:69`, `lib/cache/cache-key.ts:1`, `lib/images/providers/cloudinary.provider.ts:18`, `lib/prisma-safe.ts:21`. Los de `auth-middleware.ts` y `prisma-safe.ts` son los que más importan: son frontera de auth y de acceso a datos.
- [2026-09-26] 7 warnings `@next/next/no-img-element` en 6 archivos — la decisión entre imagen nativa y `next/image` se toma por archivo, no globalmente.
- [2026-09-26] 2 warnings `react-hooks/exhaustive-deps`. Vale revisar: los hooks mal declarados suelen ser la causa raíz del error de `Reviews.tsx`.

### Orden sugerido cuando se ataque

1. Ignorar `.agents/**` en ESLint → baja el ruido de 132 a ~38. Sin tocar código de app.
2. `Reviews.tsx` extraer `ReviewCard` → elimina el único error con riesgo de bug real.
3. Los `any` de `auth-middleware.ts` y `prisma-safe.ts` → frontera de seguridad primero.
4. El resto de `any`, `no-img-element` y `exhaustive-deps`.

Mientras tanto: **`pnpm lint` no es un gate confiable en este repo.** El hook de pre-commit solo corre `prettier --check`, no eslint — por eso estos 132 problemas nunca bloquearon un commit. No agregar eslint al hook hasta cerrar (1) y (2).
