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
- Seed catalogue: `prisma/seed/cars.ts` with 16 units, `link-tree.ts` with the dealership's phone,
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
| N8  | —      | The sync must preserve the deployment surface: a documented command that copies the product tree over `glautos` while restoring `src/site/glautos/`, `public/` client assets, the deployment's seed, and its environment. Without this, the next sync destroys the deployment                                                                                                 | inline | —      |

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
