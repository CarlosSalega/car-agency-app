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
