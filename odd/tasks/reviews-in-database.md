# Reviews in the database (roadmap T4.1 / Phase 4)

Staff-curated reviews living in Postgres, a `.admin` panel to maintain them, the public
section reading from it, and an `aggregateRating` in the landing JSON-LD derived from what
is actually published. Plan of record: `odd/tasks/dealer-product-roadmap.md`, T4.1.

## Specs

**S1 — Model.** `prisma/schema.prisma` gains `model Review` with: `id` (uuid),
`authorName` (required), `rating` (`Int`, 1..5), `text` (required, long), `reviewedAt`
(`DateTime`, required — the date the customer left it), `photoPath` (`String?`, a
repository path such as `/reviews/norma-sonez.webp`), `sortOrder` (`Int`, default 0),
`isPublished` (`Boolean`, default **false**), `createdAt`, `updatedAt`, and
`@@index([isPublished, sortOrder])`. No numeric `photoWidth`/`photoHeight` columns: the
card keeps a fixed `h-20` and lets the image carry its own aspect, so a new photo needs no
row update.

**S2 — Date label.** `reviewedAt` is a real date. The "hace 3 meses" text is computed in
Spanish at render time by a pure, unit-tested formatter; it is never stored, because a
stored phrase is a lie the next month. Under a day it says "hoy".

**S3 — The six real testimonials are seeded verbatim, with one declared exception.**
Their text is copied exactly, including emoji and line breaks, except that a mention of
`Car Agency App` becomes `[client]`: it is the same business after the rename, and the
dead brand must not ship. The `4.9 / 249 reseñas` badge stays a plain visual link to
Google, with **no** structured data behind it.

**S4 — Public surface.** The landing renders only `isPublished` rows, ordered by
`sortOrder` ascending then `reviewedAt` descending. With zero published rows the whole
reviews section is not rendered at all — an empty grid is worse than no headings. The read
goes through a cached query tagged `reviews`, and every admin write revalidates that tag.

**S5 — Panel.** `/admin/reviews` is ADMIN-only and redirects anyone else to `/admin`,
matching `/admin/leads`. It lists every row (published and not) and supports create, edit,
publish/unpublish and delete. Every write goes through a route handler that checks
session + role, validates with zod, and records a `Log` row in the same transaction as the
change. It is reachable from the admin sidebar via `src/data/admin-navigation.ts`.

**S6 — Structured data.** The landing `AutoDealer` carries `aggregateRating` derived from
the published rows — `ratingValue` to one decimal, `reviewCount` = published count — plus
a `review` array with `author.name`, `reviewRating.ratingValue` and `datePublished` per
published review. With zero published rows, neither key is emitted. The hand-typed
`4.9`/`249` never becomes structured data.

**S7 — Validation.** `authorName` 2..80 after trim, `rating` integer 1..5, `text` 10..2000
after trim, `reviewedAt` a valid date that is not in the future, `photoPath` optional and
only an absolute repository path starting with `/`, `sortOrder` an integer ≥ 0.
User-facing messages in Spanish like the rest of the UI.

**S8 — Tests.** The formatter (today / days / months / a future date is rejected by the
schema), the public query (only published, in the specified order), the aggregate (0, 1 and
N rows), the landing JSON-LD (presence and absence of `aggregateRating`, values matching
the published rows), and the API (401 without session, 403 for a non-ADMIN, 400 on invalid
input, 200 on success with the `Log` row written).

## Tasks

| ID  | Task                                                                    | Specs      | Route  | Commit    |
| --- | ----------------------------------------------------------------------- | ---------- | ------ | --------- |
| T1  | `model Review`, SQL preview, `db push`, seed the six real testimonials  | S1, S3     | inline | `13f6d66` |
| T2  | Data layer: published query, aggregate summary, Spanish date formatter  | S2, S4, S8 | inline | `13f6d66` |
| T3  | zod schemas and the admin route handlers, with `Log` audit + revalidate | S5, S7, S8 | inline | `bcb093d` |
| T4  | `/admin/reviews` page, table, form dialog, sidebar entry                | S5         | inline | `bcb093d` |
| T5  | Public section: server wrapper reading the DB, client `ReviewCard`      | S4, S3     | inline | C3        |
| T6  | Landing JSON-LD `aggregateRating` + `review` array                      | S6, S8     | inline | C3        |
| T7  | Docs (`honest-notes.md`, roadmap) and the full gate                     | —          | inline | C3        |

## Log

- **L1 (user, verbatim):** "arranca con reviews fase 4"
- **L2 (decisiones del owner, verbatim de las opciones elegidas):**
  - "Solo staff: panel CRUD, copiadas de Google" — tabla `Review` + `/admin/reviews`, sin
    envío público. "Recomendado para el MVP: cero spam, cero PII nueva, el dueño controla
    qué se publica."
  - "Calcular desde las publicadas" — "El JSON-LD emite aggregateRating real (promedio y
    cantidad de filas publicadas). El badge de Google queda como link visual, sin
    structured data."
- **L3 (hallazgo, 2026-11-01):** el repo tiene 2 carpetas en `prisma/migrations` **sin
  aplicar** y el schema real se creó con `db push`; `prisma migrate status` lo confirma.
  Con 313 leads en la base, `migrate dev` pediría un reset destructivo. Se sigue la
  convención real (`prisma db push`) **previsualizando primero el SQL** con
  `prisma migrate diff` para probar que el único cambio es `CREATE TABLE "Review"`.
- **L4 (hallazgo):** `Reviews.tsx` ya no tiene "dos testimonios": tiene **seis** reseñas
  reales de Google con foto en `public/reviews/`, y dos de los textos dicen
  `Car Agency App`. El handoff que hablaba de dos estaba desactualizado.
- **L5 (conexión, 2026-11-01):** el primer `prisma migrate status` falló con `P1001`; el
  DNS de `pooled.db.prisma.io` devuelve varias IPs y una estaba muerta. Reintento OK. No
  es un problema de la app.

- **L6 (bug encontrado por la verificación funcional, no por los tests):** el
  primer `next start` devolvió 500 en `/` con
  `a.reviewedAt.toISOString is not a function`. Causa: **`unstable_cache` serializa
  su resultado a JSON**, así que un `Date` declarado en el tipo vuelve como string.
  Los tests unitarios no podían verlo porque mockean `unstable_cache` como
  identidad, es decir, borran justo el límite que rompía. Arreglo: `PublicReview.reviewedAt`
  es `string` (ISO), la query serializa explícitamente en el borde, y el formatter y
  el JSON-LD aceptan las dos formas. El test de la query ahora **afirma** la
  conversión, así que el mock ya no puede ocultarla otra vez.
- **L7 (dos guardas existentes atraparon defectos reales en este trabajo):**
  `src/components/__tests__/select-items.test.ts` exigió el prop `items` en el
  Select de calificación (sin él el trigger mostraba `5` en vez de `5 estrellas`), y
  `src/__tests__/public-assets.test.ts` marcó el placeholder `/reviews/cliente.webp`
  del dialog como asset inexistente. Ninguna de las dos se debilitó: se arregló el
  código.
- **L8 (verificación funcional, `next build` + `next start` sobre la base real):**
  `/` dinámica (ƒ), 6 tarjetas, `aggregateRating {ratingValue: 5, reviewCount: 6}`,
  `Car Agency App` = 0 apariciones, badge 4.9/249 intacto. Con las 6 despublicadas
  por la API: sección ausente, sin `aggregateRating`, sin `review[]`. Republicadas:
  6 de nuevo. `Log` con 13 filas `UPDATE`/`Review`. `/admin/reviews` 200 con sesión
  de ADMIN y 307 a `/admin/login` sin sesión. **0 errores en el log del server.**
- **L9 (gate):** `tsc` 0 · **52 archivos / 396 tests** (eran 45/352) · `pnpm build` 0.
