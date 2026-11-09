# mercadoLibre-publishing — one vehicle, published to every channel

Planning document, not an implementation record. Phases 0 and 1 are specified; phases 2 and 3 are one
line each. The MercadoLibre documentation was verified (`## Verified against the documentation`) and the
two decisions that block T1 are resolved (`## Decisions`).

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

## Decisions

### D1 — The app owns the fields; a human resolves divergence

The product publishes from car-agency. That means car-agency is authoritative for everything it
publishes: title, description, pictures, price, currency, the identity fields, and the sold intent.
MercadoLibre contributes read-only facts: item status, sub-status, questions, visits.

The mechanism, which is the part that matters:

- **Sync is event-driven, never a periodic push.** A periodic "push everything" is exactly what silently
  reverts an edit somebody made in ML from the lot. A change in car-agency queues a publication update;
  nothing else writes.
- **Every publication stores what we last sent**: `syncedSnapshot` (price, title, status, picture count)
  plus `syncedAt`. Without that snapshot you cannot tell "ML differs because someone edited it" from "we
  have not pushed yet", and the whole rule collapses.
- **A read that disagrees with the snapshot moves the publication to `DIVERGED`**, carrying both values.
  It is never auto-resolved. The panel offers two buttons: _import what ML has_ or _impose what
  car-agency has_. The first is the escape hatch that respects reality — whoever edited in ML usually did
  it because they were standing next to the car.
- **"Sold" is an intent, not a field.** Marking a vehicle sold closes the item unconditionally, with no
  divergence check. A closed item due to a sale is never a conflict.

Why not ML as the source of truth: the product degrades into a viewer of ML, and S3 dies with it. Why not
silent overwrite: it destroys trust the first time a price edited on a phone gets reverted by a job.

Cost: one JSON column, one extra state, and two buttons. Cheap, and it is the difference between a tool
that is trusted and one that has to be babysat.

### D2 — Token encryption: AES-256-GCM in the application, with versioned keys

Access and refresh tokens are credentials that let anyone act as the agency on the marketplace. They are
encrypted before they reach the database, so a database dump on its own leaks nothing.

- **Key material lives in the environment**, not in the database: `TOKEN_ENCRYPTION_KEYS`, a list of
  `v<version>:<base64 32 bytes>` entries. The current version encrypts; any version still listed can
  decrypt.
- **Cipher**: AES-256-GCM via `node:crypto`, random 12-byte IV per record, authenticated. One column
  holds `v<version>:<iv>:<tag>:<ciphertext>`, all base64. No new dependency.
- **Rotation is a documented path, not a hope**: add `v2` to the environment, run a re-encrypt command
  that reads with the record's version and writes with the current one, then remove `v1`. This is why the
  version is stored per record instead of assumed.
- **Failure mode**: a token that cannot be decrypted marks the account `REVOKED` and asks for a
  reconnect. The sync skips that account and keeps going for the others; it never crashes the queue and
  never retries a token it cannot read.
- **Tokens are never logged**, and error paths redact them. The refresh token is single-use, so losing
  the latest one means a reconnect — another reason not to print it anywhere.

Why not a KMS: an extra network hop on every sync, for a deployment that holds one agency's tokens. The
threat model is the same one that already protects the app's signing secrets, and single tenancy means a
compromised deployment exposes only that agency.

## Tasks

| ID  | Specs  | Task                                                                                                                                                                                                                                                                              | Route  | Commit |
| --- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------ |
| T1  | S3, D1 | `ChannelAccount`, `Publication`, `PublicationEvent` models plus the migration. `Publication` carries the state machine including `DIVERGED`, `syncedSnapshot` and `syncedAt` (D1), and persists the remote status _and_ sub-status verbatim because mapping loses information     | inline | —      |
| T2  | S1, D2 | Token storage per D2: AES-256-GCM, versioned keys, `EXPIRED`/`REVOKED` states, a reconnect path in the panel, and the re-encrypt command for rotation                                                                                                                             | inline | —      |
| T3  | S3, D1 | Panel: per-vehicle, per-channel state, including the `DIVERGED` view with both values and the two resolution buttons. Ships with manual channels ("published by hand" + URL + date), so it is useful before any API exists                                                        | inline | —      |
| T4  | S4, S5 | Documentation verification                                                                                                                                                                                                                                                        | done   | —      |
| T5  | S5     | ML token lifecycle. **The refresh token is single-use**: a second concurrent refresh invalidates the first, so refreshes must be serialized per account. Access tokens last 6 h, so renewal is proactive                                                                          | inline | —      |
| T6  | S5     | Category discovery at runtime (`/sites/MLA/domain_discovery/search`) plus the required attributes per category from `/categories/{id}/attributes`, cached. Not a hand-written table: the required set lives in the category. Map our fields onto it, including `version` → `TRIM` | inline | —      |
| T7  | S2     | Per-channel image derivatives. ML needs a **new** variant: 1200×1200 (its recommendation), because `thumbnail` 300×225 and `card` 400×300 are below the 500×500 minimum and `fullscreen` 2400×1800 exceeds the 1920×1920 maximum                                                  | inline | —      |
| T8  | S5     | Create, update price, pause, close. "Sold" means `closed` (there is no sold endpoint). Relisting produces a **new item id**, so `Publication.remoteId` must be updated, and visits carry over only within 60 days for vehicles                                                    | inline | —      |
| T9  | S3     | Job queue with idempotent handlers and per-channel retries. MercadoLibre publishes no numeric rate limit, only 429 plus backoff-with-jitter guidance, so the design is defensive: low concurrency, exponential backoff, no burst                                                  | inline | —      |
| T10 | S3     | Actionable per-channel errors in Spanish. Distinguish a failure from a transient state: URL-hosted pictures can auto-pause the item with sub-status `picture downloading pending`, which resolves itself and must not be reported as an error                                     | inline | —      |
| T11 | S2     | Phase 2: Facebook Page and Instagram publishing (carousel from Cloudinary URLs)                                                                                                                                                                                                   | —      | —      |
| T12 | S2     | Phase 3: generated content for TikTok and Reels. Not a publishing integration: the Content Posting API is video, so the feature is producing the asset for the agency to review and post                                                                                          | —      | —      |

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

Narrow, and none of them blocks phase 0 or the start of phase 1:

1. The numeric rate limit for item create/update on MLA. The app's own quota display would answer it.
2. The minimum image count for car categories.
3. Whether `sale_terms` is mandatory for a used car (only the reconditioned rule is documented).
4. The exhaustive required-attribute list for this agency's categories: answered by querying
   `/categories/{id}/attributes` per category, which is what T6 builds.
5. The effect of `target=classified` in the predictor, beyond choosing the domain.

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
  job queue. The dashboard already reports leads per channel, and the image module (merged, 160 tests)
  already ships named variants per destination.
- **L4** (analysis by the parent, not a user requirement) — the central claim of the plan: the product is
  the **publication model**, not the integrations. Publishing creates N remote records with N lifecycles,
  so without a `Publication` state per channel nothing can answer "where is this published". That is why
  phase 0 is useful with zero APIs. Channels are not interchangeable: ML is bidirectional and
  attribute-heavy, Instagram needs a Business account linked to a Page and publicly reachable media,
  TikTok takes video rather than photo carousels. A half-published vehicle needs per-channel retries and
  a visible state, and the sold cascade matters more than the initial publish.
- **L5** (decisions taken before phase 1, by the human's instruction "Resuelve esos dos antes de escribir
  T1") — D1 and D2 above. They are decisions, not requirements: D1 chooses the app as authoritative with
  human-resolved divergence over both silent overwrite and ML-as-source; D2 chooses application-level
  AES-256-GCM with versioned keys over a KMS.
- **L6** (not done, deliberately) — no code, no schema, no branch. This document is the deliverable.
- **L7** (T4, documentation verified) — read the official MLA developer pages. Five findings changed the
  plan, each reflected in a task: there is no publishing scope to request, so the OAuth layer is already
  complete; the refresh token is single-use, so refreshes must be serialized per account; required
  attributes are discovered per category at runtime, and the one worked example names TRIM, which our
  `Car.version` maps onto; `pictures[].source` is supported but URL pictures auto-pause the item while
  they are processed, so T10 must separate a transient state from a failure; and **none of the image
  module's current variants is valid for ML** — 300×225 and 400×300 are below the 500 minimum, 2400×1800
  exceeds the 1920 maximum — which is why T7 gained a 1200×1200 variant. Also recorded: no sandbox
  exists, and rate limits have no official numbers.

- **L8** (correction to L3, during T5/T6) — **L3 was wrong.** It claimed no token model existed. It did:
  `MeliAccount`, with `crypto.ts` (`sealValue`/`openValue`), `store.ts`, `token.ts` (its own refresh
  manager) and `manager.ts`. The L3 grep searched for `Integration|Token|Channel|Publication|Mercado`,
  and `MeliAccount` matches none of them: the conclusion rested on a search that could not have found
  it. "It does not exist" needs a grep capable of finding it; searching for the names I expected is
  exactly what produced the error.

  Cost: T5 wrote 458 new lines beside 410 existing ones doing the same job. Because no MercadoLibre
  account was ever linked, retiring the old path cost no data and no reconnection: `store.ts`,
  `crypto.ts`, `token.ts` and `manager.ts` are deleted (−800 lines with their tests), the callback and
  the disconnect route write through `ChannelAccount`, `MeliAccount` is out of the schema, relinking
  still replaces the previous account, and the admin card reads status plus a read-only readability
  probe so a page view can never persist a state.

  Explicitly out of scope and left as a decision: `readMeliConfig` still treats `MELI_TOKEN_ENCRYPTION_KEY`
  as the "configured" gate although nothing reads it any more, so a deployment can look configured and
  fail at link time with `KeyRingError`; and `ChannelAccount` no longer records who linked the account
  or the granted scope.
