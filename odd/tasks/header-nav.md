# Header nav + hamburger

## Objective

Actualizar el header público: Inicio (/), Catálogo (/autos, antes Stock), Ventas (/ventas, nuevo), Contacto (/contacto); más menú hamburger en tablet/mobile (<lg) sin romper el dropdown de sesión.

## Problem

Nav actual solo tiene Inicio/Stock/Contacto, sin /ventas y sin menú móvil (nav hidden <lg deja a tablet/mobile sin navegación).

## Why

Consistencia de navegación y acceso a /ventas desde el header en todos los viewports.

## Scope

- `src/app/(landing)/components/NavbarClient.tsx` (items + hamburger + sheet)
- Nuevo `src/app/(landing)/components/NavbarMobileMenu.tsx` si hace falta (o todo en NavbarClient si queda simple)
- No tocar `HeaderUser`/`AdminDropdown` salvo para convivir con el hamburger

## Constraints

- ES respuestas, EN artefactos; conventional commits sin IA
- Corte `lg` (1024px): `lg:flex` desktop, `lg:hidden` hamburger (decisión existente, no cambiar)
- `odd/` untracked; no push ni merge sin pedido
- Preservar `aria-current`, underline activo, `bg-primary`, skip-link y dropdown logueado

## Tasks

- [x] T1 — Items: Inicio→/, Catálogo→/autos (rename Stock), Ventas→/ventas, Contacto→/contacto, con `isActive` por `pathname.startsWith` (exacto solo /) (`c71a7a8`)
- [x] T2 — Hamburger <lg: botón `aria-label="Abrir menú"`, `aria-expanded`, Sheet con mismos links, cierre al navegar + Escape, foco visible; `HeaderUser` siempre visible (`c71a7a8`)
- [x] T3 — Verificación: `tsc --noEmit --ignoreDeprecations 5.0`, `eslint` en tocados, check visual desktop + mobile (validado por usuario con screenshots 2026-09-22)

## Authorized scope

Implementación autorizada 2026-09-22: "modifiquemos el header publico..." Rama feature desde `main`.

## Acceptance criteria

- Desktop ≥lg muestra 4 links con activo subrayado; mobile/tablet muestra hamburger que abre menú con los 4 links
- Cada link va a su path; /ventas aparece y marca activo en /ventas
- Logueado: dropdown sigue accesible en desktop y mobile
- Sin regresión de a11y (skip-link, aria-current, foco)

## Applicable checks

- `pnpm tsc --noEmit --ignoreDeprecations 5.0` (hay 5 errores pre-existentes fuera del área; solo deben importar los tocados)
- `pnpm eslint` en archivos tocados
- `pnpm dev` + vista 375px y 1280px

## Progress

- 2026-09-22: T1→T3 completos y mergeados a `main` (fast-forward, commits `c71a7a8` + `9c2d2dc` + `f7cd547`). Sin push a pedido (no disparar deploy). Mirror Engram pendiente.

## Next step

- Writer implementa T1→T2 en rama `feat/header-nav`, un work-unit commit; luego T3
