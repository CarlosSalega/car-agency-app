# Dealer product roadmap: from one dealership to a repeatable delivery

Single tenant, one deployment per agency, no `dealerId` in the schema. That makes
the product **a rebrandable deployment**, not a SaaS, and that is why brand identity
must move out of the source code before agency #2.

Two different deadlines matter and they are not the same date:

- **Before handing over to GL Autos:** Phase 0 + Phase 1. Without a guarded seed,
  backups and leads, the delivery is a demo with a monthly invoice.
- **Before selling to agency #2:** T6 (brand config) + T20 (deployment runbook).
  Selling the same codebase twice by hand-editing strings is how a product becomes
  a maintenance trap.

Everything below assumes the current stack: Next.js App Router, Prisma 7 + Postgres
(Neon), better-auth, Cloudinary, Resend, Vercel.

## Phase 0 — Delivery hygiene (blockers)

T0.1 — Refuse to seed outside development. **S**
`prisma/seed.ts` runs `resetDatabase()`, which wipes users, cars, sellers, brands,
models, linktree, settings and sessions. Guard it: abort unless
`NODE_ENV === "development"` or `SEED_ALLOW_DESTRUCTIVE=1` is set, and print what it
is about to delete. Acceptance: `pnpm db:seed` on a non-dev env exits non-zero
without touching a row.

T0.2 — Backups with a proven restore. **M — DEFERRED (MVP, no production yet)**
Automated snapshot (Neon branch or `pg_dump` cron) plus a documented restore. The
proof is a restore into a scratch database, not a checkbox: if nobody has restored
one, there is no backup.

Deferred by the owner while the product is a development MVP with no production
database. Recorded here so nobody re-diagnoses it from zero:

- A weekly backup workflow **already exists**, `.github/workflows/database-backup.yml`,
  and has been failing since the `fyf` rename (runs from 2026-10-11 onward are red).
  Its `BACKUP_REPO` is `Car Agency Appautomotores/Car Agency App-backups` — a GitHub
  path with spaces, produced by the same blind rename, which cannot exist.
- `gh secret list` comes back empty, so `BACKUP_REPO_SSH_KEY` is probably missing too.

So this is not "build a pipeline": it is "point the existing one at the real backup
repository". That needs the repository name from the owner, and guessing the path of a
backup is how a backup is lost.

While it stays deferred, T0.1 (the seed guard) is the only thing standing between a
mistyped command and an emptied database, which is why that guard is not optional.

T0.3 — Make `aggregateRating` honest. **S**
The landing JSON-LD publishes `4.9 / 249` reviews. Structured data must reflect
reviews that exist and can be verified, or Google treats it as spam. Either wire a
real source (T4.1) or delete the block.

T0.4 — Real domain and a verified sending domain. **M**
`glautos.ar` pointed at the deployment, `BETTER_AUTH_URL` set to the real origin
(otherwise sign-in returns 403), `NEXT_PUBLIC_SITE_URL` updated once DNS resolves,
and Resend's sending domain verified. Acceptance: password reset received end to end
from a fresh browser.

T0.5 — Privacy policy and cookie consent. **M**
Leads plus Meta Pixel plus IP/UA in `Visit` are personal data (AR Ley 25.326). Needs
a policy page and Pixel that does not fire before consent. Acceptance: no `fbq` call
until the visitor accepts.

T0.6 — Brand config instead of brand literals. **M**
One `dealer` config (name, legal name, domain, phone, WhatsApp, address, hours,
socials, logo paths) as the single source, consumed by `metadata.ts`, the JSON-LD, the
footer, the contact defaults, the seed and the linktree. The page-level
titles/descriptions stay but must interpolate the config, never the literal
"GL Autos". Acceptance: a deploy for a second agency needs zero source edits outside
the config and `public/`.

T0.7 — Rate limit the public surface. **S**
A public lead form is an abuse target, and the previous rate limiter was deleted with
the auth cleanup. Reinstate it scoped to the form endpoints.

## Phase 1 — The commercial layer (leads)

Without this the site produces WhatsApp conversations that leave no trace, and there
is no number to justify a renewal.

T1.1 — `Lead` model. **S**
Fields: `id`, `name`, `phone`, `email?`, `message?`, `carId?`, `sellerId?`, `status`
(new | contacted | negotiating | won | lost), `source?` (utm/referrer), `createdAt`,
`updatedAt`, plus `Consent`-related timestamp. Index on `status`, `carId`,
`createdAt`.

T1.2 — Public form on `/autos/[slug]`. **M**
"Consultar por este auto" with name + phone + optional message. Zod validation, a
honeypot field, rate limit, and a server action that writes the lead. The car context
is attached automatically. Acceptance: a submission appears in the panel and the
WhatsApp fallback still works.

T1.3 — Notify the dealership. **S**
Resend template to the dealer address on every lead, plus a `wa.me` deep link in the
email so the seller answers from the phone. Acceptance: an email arrives with the car
and the contact data.

T1.4 — Leads section in the panel. **L**
List with filters (status, car, seller, date), detail view, status transitions,
internal notes, and every transition written to the existing `Log` audit trail.
Acceptance: a lead moves new -> won and the change is in `Log`.

T1.5 — Attribution. **S**
Capture `utm_*` and `referrer` at submission and store them in `source`, aligned with
the Meta Pixel events that already exist.

T1.6 — Numbers on `/admin`. **M**
Leads per week, per car, and per status. This is the screen that renews the contract,
so it must be readable by the owner, not by an engineer.

Before starting Phase 1, read `odd/tasks/crm-erp-discovery.md`: a CRM/ERP exploration
already exists and must not be duplicated.

## Phase 2 — Inventory visibility

T2.1 — `Vehicle` + `Offer` JSON-LD on `/autos/[slug]`. **M**
Price, currency, availability, mileage, year, fuel, transmission, seller, images. Today
the car pages emit zero structured data, which is exactly what keeps inventory out of
Google's vehicle surfaces.

T2.2 — Per-car metadata. **S**
Unique title/description, canonical, and OG image taken from the car's first photo.

T2.3 — Sitemap hygiene. **S**
Include car URLs with `lastModified`; drop or `noindex` sold/inactive cars.

## Phase 3 — Where buyers actually look

T3.1 — Inventory CSV export for MercadoLibre. **M**
Column mapping plus image URLs, generated from the panel.

T3.2 — Meta catalog feed. **L**
Optional, after CSV proves the field mapping.

## Phase 4 — Living content

T4.1 — Reviews in the database. **L**
Moderated reviews or a Google Business source, replacing the two hardcoded quotes that
still say the previous brand. Feeds T0.3.

T4.2 — Financing calculator. **S**
Optional lead magnet with the legal disclaimer; `Currency` already exists.

## Phase 5 — Productization

T5.1 — Config-driven seed. **M**
Brand, contact and inventory fixtures come from the dealer config, so bootstrapping a
new agency is config plus data, not edits.

T5.2 — Deployment runbook. **S**
A checklist per new agency: DNS, env vars, `BETTER_AUTH_URL`, sending domain, seed,
Pixel, backups, privacy pages. The runbook is the product.

T5.3 — Repository handoff hygiene. **S**
Decide what ships: the `odd/` notes and the seeded `admin1234` password must not reach
a client's production.

## Ordering

Flagship delivery: `T0.1, T0.3, T0.4, T0.5` then `T1.1 -> T1.6` (done), then `T2.1,
T2.2, T2.3`. `T0.2` is deferred while there is no production database.

Productization, before agency #2: `T0.6, T0.7, T3.1, T5.1, T5.2, T5.3`.

Not now: online payments or deposits, a full CRM/ERP, multi-tenant.

## Mercado Libre integration

Split from the T3 work and documented in `odd/tasks/meli-integration.md`, which carries
the verified facts (6-hour access token, single-use refresh token, the authorizing user
must be an administrator, vehicles need a contracted package and photos).

- **A — account linking: done.** OAuth with `state` and PKCE, sealed tokens in their own
  table, `disconnect` guarded by an Origin check.
- **B — token lifecycle: done.** Single-flight refresh, ahead of expiry, with a clear
  re-link path on `invalid_grant`.
- **C, D, E — package check, publishing, syncing: documented and not built.** They need
  the dealership's ML account, a contracted package and a registered app; writing them
  before that would be writing blind.

## Progress

- T0.1 (seed guard) — done, `860a9cc`. Decision in `prisma/seed/guard.ts`, 17 unit
  tests, runtime-controlled with three negative/positive controls, row counts
  unchanged across them.
- T0.3 (aggregateRating) — done, `bd4c3f7`. Verified absent from the rendered
  JSON-LD while the rest of the AutoDealer block survives.
- T1.1 -> T1.4 (the lead layer) — done. `041601a`, `a96809c`, `65b0868`, `327d3d0`;
  the car page records inquiries, notifies by email, and the panel lists them with
  statuses and an audit row per change. Detail in `odd/tasks/car-leads.md`.
- T1.5 (attribution) and T1.6 (the numbers on /admin) — done. `7dd92ed`, `f9bbde3`,
  `9fe5718`. First-touch campaign capture in four columns, and a dashboard on `/admin`
  with counters, a 12-week series, channel/status bars, a ranked car table and the
  unanswered queue. Detail in `odd/tasks/car-leads.md`. Phase 1 is complete.
- Dependencies are now pinned exactly, enforced by
  `src/__tests__/dependencies.test.ts` (`45a8e37`).
- Next, and the only thing left before handing over: Phase 0 items that need the owner
  (T0.2 backups, T0.4 domain and sending domain, T0.5 privacy), then T0.6 brand config
  before a second agency.
- Next that needs the owner: T0.4 (DNS, `BETTER_AUTH_URL`, sending domain) and T0.5
  (privacy text and legal review). T0.2 is deferred until production exists.
- T0.6 (brand config) before any second agency, not before GL Autos.
