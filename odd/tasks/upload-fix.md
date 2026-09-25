# Upload error handling — friendly UX + no achicar límite

## Objective
Arreglar el toast `Unexpected token 'R'... is not valid JSON` al subir fotos, manteniendo un límite generoso para fotos actuales de celular, con error ameno en español.

## Problem
`ImageUpload` hace `response.json()` a ciegas. Cuando `/api/upload` (o Vercel) devuelve texto plano — ej. `Request Entity Too Large` — el parseo explota y el usuario ve un error técnico en inglés en vez del motivo real.

## Why
Fotos de celular hoy pesan 5-12MB. El límite cliente es 10MB pero el `config.bodyParser:false` en `route.ts` es legacy de Pages Router y no aplica en App Router. Hay que alinear cliente/servidor y dar mensaje humano.

## Scope
- `src/components/image-upload.tsx` — parseo seguro + mensajes ES
- `src/app/api/upload/route.ts` — quitar config legacy, validar tamaño, responder siempre JSON
- No cambiar proveedor Cloudinary ni rediseñar UI de upload

## Constraints
- Respuestas en ES, artefactos en EN
- Conventional commits, sin atribución IA
- No mutar DB
- `odd/` untracked

## Tasks
- [x] T1 — Cliente: parseo seguro (`content-type` check + fallback `text()`), mapear 413 / `Request En...` a mensaje ameno, mantener progreso y toast.success existentes
- [x] T2 — Servidor: quitar `config` legacy, validar `file` + tamaño consistente con cliente, siempre `NextResponse.json`, log server para diagnóstico
- [x] T3 — Verificación: `tsc --noEmit --ignoreDeprecations 5.0` + `eslint` en archivos tocados + prueba manual chica (<1MB) y grande (>10MB)

## Authorized scope
Fix autorizado por usuario el 2026-09-21: "probemos con el fix". Límite decidido: 15MB (opción Recomendada).

## Acceptance criteria
- Subir foto grande no muestra más `Unexpected token...`
- Muestra mensaje ameno en ES que explica qué hacer
- Foto chica sigue subiendo igual, progreso y reorder intactos

## Applicable checks
- `tsc --noEmit --ignoreDeprecations 5.0` (tsconfig tiene ignoreDeprecations 6.0 con TS 5.9.3)
- `eslint` archivos tocados
- Prueba manual con 2 tamaños

## Progress
- 2026-09-21: documento creado, propuesta presentada, esperando decisión de límite
- 2026-09-21: fix implementado en rama `fix/upload-friendly-error`, commit `3010892` (2 files, +127/−22, bien bajo el heurístico de 400 líneas). Límite alineado cliente/servidor en 15MB; 413 del servidor usa mensaje ameno ES. `tsc`: solo 3 errores preexistentes fuera del área tocada (`tag-selector.tsx` ×2, `meta-pixel/events.ts` ×1); `eslint` en tocados: 0 errores, 1 warning preexistente (`no-img-element` en thumbnail). Prueba manual real contra Cloudinary pendiente (requiere sesión + archivos de 2 tamaños).
- 2026-09-21 12:40: test independiente OK en `fix/upload-friendly-error`: `vitest` 8/8 en `image-upload.test.tsx`, `eslint` 0 errores (1 warning preexistente), `tsc` solo los 3 preexistentes, lógica 413/`Request En`/`Unexpected token`/18.2MB verificada. Smoke real en navegador (chica <1MB + grande >15MB + reorder) pendiente del usuario.

## Next step
- DELIVERED 2026-09-21: merge FF `3010892` a `main`, push `105dddb..3010892` a `origin/main` (Vercel auto deploy). Rama `fix/upload-friendly-error` pendiente de borrado.
