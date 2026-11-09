# mercadoLibre-publishing — one vehicle, published to every channel

Planning document, not an implementation record. Phases 0 and 1 are specified; phases 2 and 3 are one
line each. The MercadoLibre documentation was verified (see `## Verified against the documentation`), so
the remaining estimate blockers are narrow and named.

## Specs

- **S1** — "esta web app car-agency sea utilizada por una agencia de autos": one agency per deployment.
  **Single tenant stays**; the client is configuration and there is still no `tenantId`. Multi-tenant is
  explicitly not part of this feature.
- **S2** — "la cual publica sus autos en la web, mercadolibre autos y postea en redes sociales como
  instagram, facebook, tiktok, etc.": the channels in scope are the website, MercadoLibre, Instagram,
  Facebook and TikTok. "etc." is not a licence to add channels before those work.
- **S3** — "La funcionalidad principal es centralizar todo eso en car-agency asi la agencia de autos en
  cuestion ahorra tiempo": the value is _one place_, not _one more publisher_. A channel that publishes
  but cannot report its state makes the agency check more places than before and costs time instead of
  saving it.
- **S4** — "una vez que carga un vehiculo en la web esta le permite publicarlo en los medios
  anteriormente mencionados": the trigger is the vehicle already loaded in car-agency. The existing
  vehicle form is the entry point; no parallel publishing tool inside the app.
- **S5** — order, chosen by the user (wording from the option they selected): "MercadoLibre primero —
  publicar, actualizar precio y pausar en ML es el mayor ahorro de tiempo. Las redes quedan para
  después."

## Non-goals for this feature

- Multi-tenancy, shared channel accounts across agencies, or one Cloudinary/Meta app serving several
  agencies.
- Automatic periodic reconciliation runs (see the orphan-sweep note in the image module's `AGENTS.md`
  for the same reasoning).
- A generic channel framework. Channels become plugins of the publication model, not the reverse.

## Tasks

| ID  | Specs  | Task                                                                                                                                                                                                                                                                                               | Route  | Commit |
| --- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------ |
| T1  | S3     | `ChannelAccount`, `Publication`, `PublicationEvent` models plus the migration. `Publication` carries the state machine and persists the remote status _and_ sub-status verbatim, because mapping loses information; `PublicationEvent` is append-only for audit and retries                        | inline | —      |
| T2  | S1     | Token storage: encryption at rest, `EXPIRED`/`REVOKED` states, and a reconnect path from the panel. These are credentials, not settings strings                                                                                                                                                    | inline | —      |
| T3  | S3     | Panel: per-vehicle, per-channel state. Ships with manual channels ("published by hand" + URL + date), so it is useful before any API exists                                                                                                                                                        | inline | —      |
| T4  | S4, S5 | Documentation verification                                                                                                                                                                                                                                                                         | done   | —      |
| T5  | S5     | ML token lifecycle. **The refresh token is single-use**: a second concurrent refresh invalidates the first, so refreshes must be serialized per account. Access tokens last 6 h, so renewal is proactive, not reactive                                                                             | inline | —      |
| T6  | S5     | Category discovery at runtime (`/sites/MLA/domain_discovery/search`) plus the required attributes per category from `/categories/{id}/attributes`, cached. Not a hand-written table: the required set lives in the category, not in the docs. Map our fields onto it, including `version` → `TRIM` | inline | —      |
| T7  | S2     | Per-channel image derivatives. ML needs a **new** variant: 1200×1200 (its recommendation), because `thumbnail` 300×225 and `card` 400×300 are below the 500×500 minimum and `fullscreen` 2400×1800 exceeds the 1920×1920 maximum                                                                   | inline | —      |
| T8  | S5     | Create, update price, pause, close. "Sold" means `closed` (there is no sold endpoint). Relisting produces a **new item id**, so `Publication.remoteId` must be updated, and visits carry over only within 60 days for vehicles                                                                     | inline | —      |
| T9  | S3     | Job queue with idempotent handlers and per-channel retries. MercadoLibre publishes no numeric rate limit, only 429 plus backoff-with-jitter guidance, so the design is defensive by default: low concurrency, exponential backoff, no burst                                                        | inline | —      |
| T10 | S3     | Actionable per-channel errors in Spanish. Distinguish a failure from a transient state: URL-hosted pictures can auto-pause the item with sub-status `picture downloading pending`, which resolves itself and must not be reported as an error                                                      | inline | —      |
| T11 | S2     | Phase 2: Facebook Page and Instagram publishing (carousel from Cloudinary URLs)                                                                                                                                                                                                                    | —      | —      |
| T12 | S2     | Phase 3: generated content for TikTok and Reels. Not a publishing integration: the Content Posting API is video, so the feature is producing the asset for the agency to review and post                                                                                                           | —      | —      |

Exit criteria: phase 0 is done when opening a vehicle answers "where is this published and is it up to
date". Phase 1 is done when a price change in car-agency is reflected in ML without manual work, and a
vehicle marked sold disappears from ML.

## Verified against the documentation

Sources are the official MLA developer pages; each claim below was read there, not inferred.

**App and scopes — nothing to add.** The authorization URL takes no `scope` parameter; scopes live on
the application and come back in the token response (`offline_access read write`). The flow already in
`src/app/api/integrations/mercadolibre/` matches the documented URL shape (state plus PKCE S256), so the
OAuth layer is complete. Access tokens last 6 h; the refresh token is single-use and only the last one
issued works.

**No sandbox.** "We do not have a test environment or sandbox to run tests: we make it possible to use
test users for verification directly in production." Development happens against the real site with
test users.

**Category and attributes.** The predictor is `GET /sites/MLA/domain_discovery/search?q=<title>`, which
returns `category_id` and `domain_id`. The blocking attribute set is whatever carries `tags.required` in
`GET /categories/{id}/attributes`; the documentation gives the mechanism and one worked example
(`MLA1744`: BRAND, MODEL, TRIM, VEHICLE_YEAR), not a fixed list. `sale_terms` is only documented as
mandatory for reconditioned items, which require a minimum 90-day warranty.

**Images.** Minimum 500×500, maximum 1920×1920, JPG/JPEG/PNG, up to 10 MB, 1200×1200 recommended (zoom
activates above 800 px width). Pictures can be sent by public URL through `pictures[].source`, so
Cloudinary delivery URLs work on MLA. The per-category maximum count is exposed as
`max_pictures_per_item`; a per-item minimum is not documented for vehicles.

**Lifecycle.** `PUT /items/{id}` with `{"status": "paused" | "active" | "closed"}`. Closing is final but
the item can be relisted, and relisting creates a **new item id** with visits carried over only inside a
60-day window for vehicles. Deletion is `closed` followed by `{"deleted": "true"}` and has no way back —
we never need it, since closed items are discarded automatically. There is no sold endpoint. The
documented statuses are `active`, `payment_required`, `under_review`, `paused`, `closed`, `inactive`,
with sub-statuses such as `picture downloading pending` (transient while URL pictures are processed),
`out_of_stock`, `expired`, `suspended`, `freezed` and `deleted`.

**Rate limits.** Only `429` / `local_rate_limited`, with documented advice to back off with jitter,
distribute requests and avoid extreme concurrency. No official numeric limit for item creation.

## Still unknown

Narrow now, and none of them blocks phase 0 or the start of phase 1:

1. The numeric rate limit for item create/update on MLA. The app's own quota display would answer it.
2. The minimum image count for car categories.
3. Whether `sale_terms` is mandatory for a used car (only the reconditioned rule is documented).
4. The exhaustive required-attribute list for this agency's categories: answered by querying
   `/categories/{id}/attributes` per category, which is exactly what T6 builds.
5. The effect of `target=classified` in the predictor, beyond choosing the domain.

Not answerable from documentation, and still needed before phase 1 ships:

- **Source of truth per field.** If the agency edits the price in ML and also in car-agency, which one
  wins? Needs an explicit, visible rule for price, stock and status, plus a divergence warning.
- **Token encryption approach.** Where the key lives, and what happens when it rotates.

## Log

- **L1** (user, verbatim) — "ahora que tenemos el modulo image-uploads funcional me gustaria plantearte
  lo siguiente para planificarlo: mi idea es que esta web app car-agency sea utilizada por una agencia de
  autos, la cual publica sus autos en la web, mercadolibre autos y postea en redes sociales como
  instagram, facebook, tiktok, etc. La funcionalidad principal es centralizar todo eso en car-agency asi
  la agencia de autos en cuestion ahorra tiempo, una vez que carga un vehiculo en la web esta le permite
  publicarlo en los medios anteriormente mencionados. Dime que opinas"
- **L2** (priority decision, user) — "MercadoLibre primero", from the option: "Publicar, actualizar
  precio y pausar en ML es el mayor ahorro de tiempo. Las redes quedan para después."
- **L3** (evidence, repository) — what already exists: `src/app/api/integrations/mercadolibre/` with
  `authorize`, `callback` and `disconnect`, PKCE plus state in httpOnly cookies, and session guards. What
  does not exist: any `ChannelAccount`/token model in `prisma/schema.prisma`, any publication model, any
  job queue. The dashboard already reports leads per channel (instagram, facebook, google, directo), and
  the image module (merged, 160 tests) already ships named variants per destination.
- **L4** (analysis by the parent, not a user requirement) — the central claim of the plan: the product is
  the **publication model**, not the integrations. Publishing creates N remote records with N lifecycles,
  so the moment a price changes or a vehicle is sold, a system without a `Publication` state per channel
  cannot answer "where is this published". That is why phase 0 is useful with zero APIs.
  Consequences recorded as decisions: channels are not interchangeable (ML is bidirectional and
  attribute-heavy; Instagram needs a Business account linked to a Page and publicly reachable media;
  TikTok takes video, not photo carousels, which makes it a content-generation feature); app review by
  Meta and TikTok is a calendar risk that starts in phase 0; a half-published vehicle needs per-channel
  retries and a visible state; the "sold" cascade matters more than the initial publish.
- **L5** (decisions to make before phase 1, not during) — the job/queue mechanism (a `Job` table plus a
  cron drainer is the simplest option on Vercel, versus a separate worker), and the per-field
  source-of-truth rule. Both are named as blockers rather than silently decided.
- **L6** (not done, deliberately) — no code, no schema, no branch. This document is the deliverable of
  that pass.
- **L7** (T4, documentation verified) — read the official MLA developer pages. Five findings changed the
  plan, each now reflected in a task:
  1. **There is no publishing scope to request.** The authorization URL takes no `scope`
     (`https://developers.mercadolibre.com.ar/en_us/authentication-and-authorization`); the repo's flow
     is already complete at that layer. The blocker about "whether the OAuth flow requests the publishing
     scopes" is closed.
  2. **The refresh token is single-use**, so parallel refreshes invalidate each other. That turned into a
     hard requirement in T5. Access tokens last 6 h.
  3. **Required attributes are per category at runtime**, not a documented list. T6 now builds discovery
     plus caching instead of a hand-written table. The one worked example (MLA1744) names TRIM, which our
     `Car.version` maps onto.
  4. **`pictures[].source` is supported on MLA**, so Cloudinary URLs can be used directly — but URL
     pictures auto-pause the item with sub-status `picture downloading pending` while they are processed.
     That is why T10 must separate a transient state from a failure.
  5. **None of the image module's current variants is valid for ML**: 300×225 and 400×300 are below the
     500×500 minimum and 2400×1800 exceeds the 1920×1920 maximum. T7 gained a marketplace variant at
     1200×1200.
     Also recorded: no sandbox exists (test users in production), and rate limits have no official numbers,
     so T9 is defensive by design.
