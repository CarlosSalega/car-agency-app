# SEO landing — tandas de auditoría `.agents/seo-audit.md`

## Objective
Cerrar los rojos y amarillos de la auditoría SEO de la landing en el orden acordado, sin cambiar diseño ni copy visible (salvo metadata).

## Problem
Sin robots/sitemap, `/admin` indexable, metadata genérica fuera de la landing, rating sin schema, imágenes sin dimensiones, headers incompletos.

## Scope
- T1: `src/app/robots.ts` (nuevo), `src/app/sitemap.ts` (nuevo, incluye slugs vía `getCarSlugs`), `noindex` en layout admin + login
- T2: metadata propia en `/autos`, `/contacto`, `/ventas`; description landing ~155 con keyword+CTA; canonical absoluta en fichas `[slug]`
- T3: `AggregateRating` (4.9/249) en JSON-LD landing; `h3`→`h2` en FeatureCards (o `p` con estilo)
- T4: Hero a `next/image` (+ remotePattern unsplash), width/height en imgs restantes (cards, reseñas, logos); HSTS + Permissions-Policy en `next.config.mjs` (NO CSP: rompería el inline script de Meta Pixel sinocking nonces)

## Constraints
- ES respuestas, EN artefactos; conventional commits sin IA; no tocar DB
- No cambiar UI visible ni copy de página; metadata sí puede redactarse
- `odd/` untracked; no pushear ni mergear sin pedido

## Tasks
- [x] T1 — robots + sitemap + noindex admin (`3b0ec16`)
- [x] T2 — metadata páginas + canonical fichas (`c4cbc80`)
- [x] T3 — AggregateRating + orden de headings (`a48fe28`)
- [x] T4 — imágenes (CLS) + headers (`926440b`)

## Authorized scope
Implementación autorizada 2026-09-21: "implementalo en ese orden". Rama `fix/seo-landing` desde `main`.

## Acceptance criteria
- `/robots.txt` 200 con Allow/Disallow + Sitemap; `/sitemap.xml` lista `/`, `/autos`, `/contacto`, `/ventas` + slugs
- `noindex` verificable en `/admin*`; resto indexable
- Titles 50-60 / descriptions 150-160, únicos por página; canonical absoluta por ficha
- JSON-LD valida (AggregateRating 4.9/249); un solo `h1`, sin saltos de nivel
- Sin `<img>` sin width/height en landing; headers HSTS+PP presentes

## Applicable checks
- `tsc --noEmit --ignoreDeprecations 5.0`, `eslint` en tocados
- `next dev` + `curl /robots.txt /sitemap.xml` (o build si es más directo)
- Validar JSON-LD con parses (node -e) — Rich Results Test queda para el usuario en Search Console

## Progress
- 2026-09-21: documento creado, delegado a writer único
- 2026-09-21: T1→T4 implementados en rama `fix/seo-landing` (desde `main`), un commit por tanda, sin push ni merge:
  - `3b0ec16` feat(seo): add robots and sitemap, noindex admin area — `/robots.txt` 200 (Allow/Disallow + Sitemap), `/sitemap.xml` 200 con 4 estáticas + 18 slugs, `noindex,nofollow` verificado en `/admin/login`
  - `c4cbc80` feat(seo): unique metadata per page and absolute canonical on car pages — titles 50-60 / descriptions 150-160 (landing 156, autos 152, contacto 151, ventas 156), canonical absoluta por ficha vía `SITE_CONFIG.url`
  - `a48fe28` feat(seo): add aggregate rating to landing JSON-LD, fix heading order — JSON-LD parseado con node (4.9/249 OK); un solo `h1`, `h3`→`h2` en FeatureCards sin cambio visual
  - `926440b` feat(seo): optimize landing images for CLS and add security headers — Hero a `next/image` (fill + remotePattern unsplash), width/height en car-image (800×500), reseñas (por foto), logos (69×64 / 65×64), whatsapp (64×64); HSTS + Permissions-Policy
- Verificación: `tsc` solo 3 errores pre-existentes (tag-selector x2, meta-pixel x1); `eslint` en tocados solo hallazgos pre-existentes (hooks en Reviews, `no-img-element` warnings por decisión, `sizes` sin usar en car-image); `curl` robots/sitemap 200 con slugs listados
- Decisión registrada: NO se agregó Content-Security-Policy — rompería el inline script de Meta Pixel (`layout.tsx`) sin plumbing de nonces

## Next step
- Writer implementa T1→T4 con commits por tanda; luego smoke + merge a `main`
