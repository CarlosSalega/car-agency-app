# mercadoLibre-publishing — one vehicle, published to every channel

Planning document, not an implementation record. Phases 0 and 1 are specified; phases 2 and 3 are one
line each. Nothing here is implemented yet, and the estimates are blocked by the verification items in
`## Open blockers`.

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

| ID  | Specs  | Task                                                                                                                                                                                     | Route  | Commit |
| --- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------ |
| T1  | S3     | `ChannelAccount`, `Publication`, `PublicationEvent` models plus the migration. `Publication` carries the state machine; `PublicationEvent` is append-only for audit and retries          | inline | —      |
| T2  | S1     | Token storage: encryption at rest, refresh before expiry, `EXPIRED`/`REVOKED` states, and a reconnect path from the panel. These are credentials, not settings strings                   | inline | —      |
| T3  | S3     | Panel: per-vehicle, per-channel state. Ships with manual channels ("published by hand" + URL + date), so it is useful before any API exists                                              | inline | —      |
| T4  | S4, S5 | Verify the five MercadoLibre items in `## Open blockers` and rewrite the phase 1 tasks if the answers change them                                                                        | inline | —      |
| T5  | S5     | ML token lifecycle: refresh, proactive renewal, reconnection                                                                                                                             | inline | —      |
| T6  | S5     | ML category prediction plus the required attributes for the categories this agency actually uses                                                                                         | inline | —      |
| T7  | S2     | Per-channel image derivatives derived from the image module's variants                                                                                                                   | inline | —      |
| T8  | S5     | Create, update price, pause, close, and the "sold" cascade that closes every channel                                                                                                     | inline | —      |
| T9  | S3     | Job queue with idempotent handlers and per-channel retries. Decided before T5, not during                                                                                                | inline | —      |
| T10 | S3     | Actionable per-channel errors in Spanish for the operator: what failed and what to do                                                                                                    | inline | —      |
| T11 | S2     | Phase 2: Facebook Page and Instagram publishing (carousel from Cloudinary URLs)                                                                                                          | —      | —      |
| T12 | S2     | Phase 3: generated content for TikTok and Reels. Not a publishing integration: the Content Posting API is video, so the feature is producing the asset for the agency to review and post | —      | —      |

Exit criteria: phase 0 is done when opening a vehicle answers "where is this published and is it up to
date". Phase 1 is done when a price change in car-agency is reflected in ML without manual work, and a
vehicle marked sold disappears from ML.

## Open blockers

Estimation is blocked until these are answered against the current MercadoLibre documentation. They are
recorded here rather than assumed, because a wrong estimate is worse than none:

1. App requirements for publishing vehicle items, and whether the OAuth flow already in the repo
   requests the publishing scopes.
2. Required attributes per vehicle category in Argentina: how many, and which.
3. Image minimums (resolution, count) and whether ML accepts Cloudinary URLs directly.
4. Rate limits per seller and per app, to size the queue.
5. Whether an item can be paused and closed through the API, and what happens to the history on
   republication.

Not answerable from documentation, and needed before phase 1 ships:

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
  the image module (merged, 160 tests) already ships named variants per destination. The OAuth handshake
  is the one part of this feature that is largely done.
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
  this pass; the five ML documentation items are the next action and they are read-only.
