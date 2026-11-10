# Car Agency App

A **white-label platform for car dealerships**: one deployment per client, with a public catalogue, an
admin panel and MercadoLibre publishing from a single place.

The client's identity — name, phone, address, colours, copy and catalogue — lives in
`src/site/<client>/`. The product does not know which dealership it is serving, and there is a test that
proves it.

## What it includes

- **Public catalogue** with filters by make, model, year, price and fuel, a vehicle page with a gallery,
  and `AutoDealer` structured data for search engines.
- **Admin panel**: vehicles, brands and models, sellers, users with roles, inquiries with channel
  attribution, reviews, links and settings.
- **Image pipeline**: uploads with identity, validation and ownership guards; orphan sweeping; a module
  with no coupling to the product.
- **MercadoLibre publishing** (in progress): a durable job queue, encrypted tokens, and handlers to
  publish, update price, pause and close.

## Stack

|           |                                                                   |
| --------- | ----------------------------------------------------------------- |
| Framework | Next.js 16 (App Router, RSC)                                      |
| Data      | PostgreSQL + Prisma 7                                             |
| Auth      | better-auth (session, roles, 2FA)                                 |
| UI        | React 19, Tailwind CSS 4, Base UI                                 |
| Images    | Cloudinary, behind a port of its own                              |
| Tests     | Vitest — 816 tests, plus a live contract suite against Cloudinary |

## How it is built

Three decisions explain almost every file:

**One deployment per client, with no `tenantId`.** The client is configuration that ships with the code.
It is resolved once, by `SITE_SLUG`, in `src/site/active.ts`; a missing variable or an unknown slug
**fails the build**. A silent fallback would end up showing one dealership's name and phone on another
dealership's site.

**Four files belong to the deployment, not to the product.** `src/site/registry.ts`,
`src/site/theme.css`, `src/site/seed.ts` and the `src/site/<client>/` package. One command preserves them
when updating a deployment: `pnpm sync:deployment --to=<path>`, a dry run by default and with no
`--force` anywhere in it.

**Modules are not packaged too early.** `MODULES.md` states the rule: extract inside the repository while
there is one consumer, and promote to a package the day a second project imports it.
`src/modules/image-uploads/` is the worked example — a three-method port, pure guards, thin adapters, and
a test that fails if it ever imports the application.

## Running it

You need PostgreSQL, a Cloudinary account, and a filled-in environment file. The repository ships an
example with every variable documented; copy it and fill in the values.

```bash
pnpm install
SITE_SLUG=demo pnpm db:push       # the schema, applied without migrations for now
pnpm db:seed                      # demo catalogue, one fictional seller, no reviews
pnpm dev
```

Sign in at `/admin` with `admin@example.com` / `admin1234`. **That credential is for development**: a real
deployment has to create its own users and change it.

`SITE_SLUG` is required: without it, `dev` and `build` fail and explain what to do.

## Adding a client

1. Copy `src/site/demo/` to `src/site/<client>/` and replace the identity, colours, copy and catalogue.
2. Register it in `src/site/registry.ts`.
3. Point `src/site/theme.css` at its `theme.css` and `src/site/seed.ts` at its `seed/`.
4. Nothing outside `src/site/` changes.

To keep it up to date with the product afterwards: `pnpm sync:deployment --to=<deployment path>`.

## Other commands

|                                   |                                                         |
| --------------------------------- | ------------------------------------------------------- |
| `pnpm test` / `pnpm test:changed` | the full suite / only what uncommitted changes affect   |
| `pnpm publications <cmd>`         | publish, sync, pause or close a vehicle on MercadoLibre |
| `pnpm drain:jobs`                 | drain the job queue (dry run by default)                |
| `pnpm sweep:orphans`              | sweep orphan images (dry run by default)                |
| `pnpm rotate:tokens`              | re-seal credentials after rotating the key              |

Everything that mutates state defaults to a dry run and requires `--confirm`.

## Where to read

| File                                  | What is in it                                                                             |
| ------------------------------------- | ----------------------------------------------------------------------------------------- |
| `AGENTS.md`                           | the repository's rules: white-label, the database during the MVP phase, what not to touch |
| `MODULES.md`                          | when to extract a module and when to package it                                           |
| `src/modules/image-uploads/AGENTS.md` | the image module's 17 invariants                                                          |
| `odd/tasks/`                          | a record per decision: specs, discarded alternatives, and why                             |

`odd/` is the least usual part of this repository. Every feature left a document with what was asked, what
was assumed, what third-party documentation actually said, and the occasions we were wrong. It reads
closer to an engineering diary than to a changelog.

## License

MIT — see [`LICENSE`](LICENSE). Use it, modify it, redistribute it, keeping the copyright notice.

The images under `public/autos/` are stock photographs and are **not** covered by this license: they keep
the terms they came with.
