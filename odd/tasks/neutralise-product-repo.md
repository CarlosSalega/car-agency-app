# neutralise-product-repo — car-agency as the product, not one client's site

The client (`glautos`) now has its own private deployment repository, synced to `8fd209e`. This feature
turns car-agency-app into the neutral product: a template with a demo client that builds, whose tests
pass, and which carries no data belonging to a dealership or to its customers.

> **Blocker before the next sync.** The sync to `glautos` replaced the whole tree. Today that was
> harmless because car-agency still carried the client package. After this feature, syncing again would
> replace `src/site/glautos/`, the dealership seed and the branded assets with the demo ones, leaving the
> deployment without its client. **The sync must preserve the deployment's own surface before it is run
> again.**

## Specs

- **S1** — "glautos = deploy del cliente; car-agency = producto neutro" (the user's choice). This repo
  ships a demo client and no dealership identity; the deployment repo keeps the real one.
- **S2** — "Cliente demo + SITE_SLUG que falla el build". The product must build with a neutral demo
  client, and a deployment that names no site, or names an unknown one, must fail the build rather than
  fall back to a default. This is already the rule in the repo's `AGENTS.md`.
- **S3** — "Conservar autos, borrar personas": the vehicle catalogue and its photography stay. The
  review portraits, the verbatim customer testimonials, and the real seller's name, phone and email go.
- **S4** — "No publicar todavía": the repository stays private and its history is not rewritten. Nothing
  in this feature publishes anything.
- **S5** — "todo lo relacionado a glautos en car-agency": at the end, no tracked file outside the
  historical `odd/` records mentions the client's name, phone, address, domain, email or social handle,
  and `brand-leak.test.ts` still enforces that for the demo.

## What the inventory found

- Selection is a hardcoded constant: `src/site/active.ts:17` is `export const activeSite = glautos;`. The
  doc comment above it already describes the `SITE_SLUG` resolution that does not exist yet.
- The client package is `src/site/glautos/` (`index.ts` id/theme, `identity.ts` name, phone, address,
  geo, maps, hours, socials and asset paths, `seo.ts` page copy, `theme.css` brand colour).
- **Real people**: `prisma/seed/sellers.ts` carries a named seller with a phone and an `@glautos.ar`
  address; `prisma/seed/reviews.ts` carries verbatim Google testimonials with six customers' full names;
  `public/reviews/` holds their portraits.
- **Dealership photography**: `public/logo*.png`, `hero.webp`, `preview.webp`, `favicon.ico`,
  `apple-touch-icon.png`, and 62 files under `public/autos/`.
- Seed catalogue: `prisma/seed/cars.ts` with 18 units, `link-tree.ts` with the dealership's phone,
  WhatsApp and maps links, `users.ts` with `admin@glautos.ar`.
- Tests: `brand-leak.test.ts` holds the seven client markers as a literal list; `package.test.ts`
  imports `@/site/glautos` directly; several unrelated tests use `glautos.ar` and the dealership phone as
  fixtures.
- Docs: `design/` and `odd/` contain the client's name, phone and address in prose.

## Tasks

| ID  | Specs  | Task                                                                                                                                                                                                                                                                                                                                                                          | Route  | Commit |
| --- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------ |
| N1  | S2     | `SITE_SLUG` resolution: a registry of client packages, a lookup that throws when the variable is missing or the slug is unknown, and `activeSite` reading it. `vitest.setup.ts` pins the slug for the suite so tests do not depend on a developer's environment                                                                                                               | inline | —      |
| N2  | S1, S2 | Demo client package `src/site/demo/`: the full contract (`id`, `identity`, `theme`, `seo`, `assets`) with invented values, its `theme.css`, and the swap in `src/site/theme.css`                                                                                                                                                                                              | inline | —      |
| N3  | S1, S3 | Move the seed data into the client package so it lives behind the same seam as identity and copy: `prisma/seed.ts` reads the catalogue, sellers, users, reviews and links from `@/site/active`, and the demo package carries a small synthetic set. This is what makes a sync safe: the deployment's `src/site/<client>/` is the only folder the product must never overwrite | inline | —      |
| N4  | S3     | Remove the people: `public/reviews/`, the verbatim testimonials, and the named seller with their contact details. The vehicles and their photography stay                                                                                                                                                                                                                     | inline | —      |
| N5  | S1, S3 | Branded assets: replace the logo, hero, preview, favicon and apple icon with neutral ones owned by the product. The 62 vehicle photos stay, and the deployment keeps its own set                                                                                                                                                                                              | inline | —      |
| N6  | S5     | Tests: `brand-leak.test.ts` reads its markers from the active client instead of a literal list, and keeps the positive control; `package.test.ts` points at the demo package; the fixtures that use `glautos.ar` and the dealership phone become neutral                                                                                                                      | inline | —      |
| N7  | S5     | Prose: `design/` and `odd/` records that name the client. Decide per file whether it stays (historical record, still private) or is scrubbed                                                                                                                                                                                                                                  | inline | —      |
| N8  | —      | **done** — The sync must preserve the deployment surface: a documented command that copies the product tree over `glautos` while restoring `src/site/glautos/`, `public/` client assets, the deployment's seed, and its environment. Without this, the next sync destroys the deployment                                                                                      | inline | —      |

Exit criteria: `pnpm test` green with `SITE_SLUG` unset in the environment (the suite sets it), the build
fails with a clear message when `SITE_SLUG` is missing or unknown, and `grep -ri glautos` over tracked
files returns only the historical `odd/` records that N7 decided to keep.

## Decisions taken, with the reason

- **A demo client, not an empty product.** S2 requires failing the build without a slug, but a public
  template that cannot build until you author a client package is a template nobody clones. The demo
  satisfies the contract and gives a deployment something to copy.
- **The seed moves behind the seam.** It is client data. Leaving it in `prisma/` means every product
  update overwrites the deployment's catalogue, which is the same defect as hardcoding the client's name
  in `cloudinary-config.ts` — a file that belongs to the product carrying data that belongs to a client.
- **The vehicle photos stay** because the user asked for them to stay, and they are the catalogue rather
  than the identity. **This deserves a second look before anything is published**: their ownership is a
  legal question, not a technical one.

## Log

- **L1** (user, verbatim) — "tengo este repot: https://github.com/CarlosSalega/glautos actualizalo a como
  tenemos el repo de car-agency, luego modifiquemos todo lo relacionado a glautos en car-agency"
- **L2** (user, decisions) — direction: "glautos = deploy del cliente; car-agency = producto neutro";
  history: "Conservar los 2 commits de glautos"; client: "Cliente demo + SITE_SLUG que falla el build";
  seeds: "Conservar autos, borrar personas"; publishing: "No publicar todavía".
- **L3** (done before this feature) — `CarlosSalega/glautos` synced to car-agency `main` as commit
  `8fd209e`, on top of its two existing commits, carrying an identical tree; verified against the remote
  through the API. No history was replaced.
- **L4** (evidence) — the inventory that produced the task list: `src/site/active.ts:17` hardcodes the
  client; the client package carries a real name, phone, address, geo, maps URL, hours and socials; the
  seed carries a named seller, six verbatim customer testimonials and 16 vehicles; `public/` carries the
  dealership's logo, hero, social preview and 62 vehicle photos; `brand-leak.test.ts` holds the seven
  markers literally; many tests use the dealership domain and phone as fixtures; `design/` and `odd/`
  name the client in prose.
- **L5** (warning, raised before writing any task) — the sync to `glautos` is a whole-tree replacement.
  Once this repo is neutralised, running it again would strip the deployment of its client package, its
  seed and its branded assets. N3 and N8 exist because of that; **do not sync again until N8 exists.**

- **L6** (N4 done) — the people left the seed and `public/`. Deleted `prisma/seed/reviews.ts`, the
  re-seed-only `prisma/seed-reviews.ts` and its script entry, the six portraits in `public/reviews/`, and
  the review-seeding step; the seller is now `vendedor-demo` with an all-zero phone and an address at
  `example.com`, the admin seeds as `admin@example.com`, and the link tree points at the invented demo
  identity. The 18 vehicles and their photography are untouched.

  Three things surfaced that the inventory missed, all of them leaks:
  1. `prisma/schema.prisma` carried a doc comment naming a real reviewer in an example path.
  2. `src/app/(landing)/components/reviews/review-google.ts` ships `GOOGLE_OVERALL_RATING = 5.0` and
     `GOOGLE_TOTAL_REVIEWS = 6` with a Google search URL for the dealership's opinions. The section
     renders nothing while no reviews are published, but the moment a deployment publishes one, the
     badge will claim 5.0 from six reviews regardless of the rows. That is shipped copy, so it belongs
     to N6/N7, not to the seed.
  3. `resetDatabase` still empties the `review` table while nothing re-creates it: running `db:seed`
     against a database that has real reviews deletes them permanently. The deployment is safe because
     its own seed re-creates them, but the product's seed now has a destructive edge worth knowing.

  Correction to the inventory: the catalogue is **18** vehicles, not 16.

  Reorder, recorded here because it reverses the task numbering: **N4 before N3**, and **N6 before N3**.
  N3 moves the seed behind the client seam, but the real seed data cannot move into `src/site/glautos/`
  while that package is still part of the product — and it must not stay there. So the order is: remove
  the people (N4, done), remove the client package and re-point the tests (N6), then move the seed
  behind the seam (N3), then the assets (N5), then the sync (N8).

- **L7** (N8 done) — the sync exists, and it is the only thing that may now be run against a deployment.
  `pnpm sync:deployment --to=<deployment>` is a dry run that prints the plan; `--confirm` creates **one**
  ordinary commit on top of the deployment's `HEAD` and pushes it; `--push=false` keeps the commit local
  so the deployment's own build can be run first. The rules live in `src/lib/deploy/sync-deployment.ts`
  (`planSync` is pure, `inspectSync` is the read-only half, `applySync` writes, `pushDeployment` pushes),
  and the shell in `scripts/sync-deployment.ts` only parses flags and prints.

  **The preserved surface, verbatim**, derived rather than configured — a list of names here would be a
  list of clients, and the product must not know which clients exist:
  - `src/site/<client>/` — every top-level directory under `src/site/` other than `__tests__` and `demo`.
    Its identity, theme, SEO, assets config and (after N3) its seed data.
  - `src/site/registry.ts` — the slug → package map that makes it selectable.
  - `src/site/theme.css` — the static `@import` of its theme.
  - `src/site/seed.ts` — the pointer to its seed data.
  - `public/` — its logo, hero, social preview, favicon and its vehicle photographs.

  Everything else under the tree is the product's and is updated by the sync. A deployment that ships no
  extra client package, or has no `src/site/seed.ts` yet, is **reported and not failed**: the sync prints
  the missing preserved path and never substitutes the product's copy, because pointing a deployment at
  the demo's seed is exactly the silent defect this feature exists to remove.

  **Why it refuses to force.** The deployment's history is the deployment's, and the paths this feature
  protects — the client package, the seams, `public/` — are the ones a force would discard without
  leaving a commit to recover them from. A rejected push means the local branch is behind the one the
  deployment is served from, which is a fact a human has to reconcile; there is no force variant in the
  tool and no flag that reaches one. For the same reason it refuses a dirty tree on either side, a path
  that is not the root of a repository (a subdirectory sync would look like a hundred deletions), a
  deployment with no `origin`, a detached `HEAD`, and it creates no commit at all when the deployment
  already matches the product.

  Two things the first real run will surface, both reported by the tool rather than repaired by it:
  1. The deployment was synced at `8fd209e`, before N3, so it has no `src/site/seed.ts` and its catalogue
     still lives in the old product-owned `prisma/seed/`. The sync reports the missing seam, updates
     `prisma/seed.ts` to import `@/site/seed`, and therefore leaves `db:seed` broken until the maintainer
     creates its own `src/site/<client>/seed/` and `src/site/seed.ts`. That is a manual step, and the
     commit is the record of what the sync did; do it before `--confirm`, not after.
  2. **`public/` being wholly preserved** means a product-owned asset added there — the neutral logo,
     hero, preview, favicon and apple icon from N5 — never reaches an existing deployment. It reaches a
     deployment created from this tree after the change. This is deliberate: the alternative is an
     exception list of "product assets inside the deployment's folder", which is how the deployment
     loses its photos on the day somebody adds the wrong name to it. Deciding otherwise is a product
     decision, not a sync one, and it is recorded here instead of being implemented quietly.
