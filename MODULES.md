# Modules

How this repository grows reusable code, and when that code stops being a folder here and
becomes a package somewhere else.

## The rule

Extract **inside** the repository while there is one consumer. Promote to its own package
the day a second project imports it. Never the reverse.

A package with a single consumer has a version, a changelog and a CI pipeline that nobody
reads, and its fixes reach nobody because there is no second project to receive them. A
folder behind a boundary test costs nothing and can be promoted in an afternoon: the guard
that keeps it decoupled already exists.

## What qualifies as a module

All four, not three:

- **No domain vocabulary.** No car, product, order, listing. If the code needs to know what
  the business sells, it is a feature.
- **No client data.** Nothing from `src/site/`, no brand, no copy, no phone.
- **A boundary test.** `tests/boundaries.test.ts` fails when the module imports the host
  application. The rule is executable, not a convention.
- **Its own contract in prose.** `AGENTS.md` with the invariants whoever touches it next
  must keep, and a `README.md` for whoever consumes it.

## Extracting one

1. `src/modules/<name>/` holding the code and its tests beside it.
2. `tests/boundaries.test.ts` — the guard, with a positive control so it cannot pass
   vacuously.
3. `AGENTS.md` — the invariants. Add the one that matters most: what it must never import.
4. `README.md` — what it does, how another project copies it, and what is deliberately not
   covered.
5. **No `package.json` inside.** The folder is copied, not installed. A nested manifest
   confuses both Next and pnpm.
6. `vitest.config.ts` — the module's tests run under the node environment when it touches
   Node APIs; the project entry in the config is part of the extraction.
7. **Everything it needs from the host is injected**: a port, a callback, a plain function.
   The module never reaches for the host.

`image-uploads` is the worked example; copy its shape.

## What exists today

| Path                         | State     | Host coupling                               |
| ---------------------------- | --------- | ------------------------------------------- |
| `src/modules/image-uploads/` | extracted | none. `cloudinary` is an optional peer      |
| `src/lib/jobs/`              | candidate | Prisma, only through an injected `JobStore` |
| `src/lib/deploy/`            | candidate | `git`, invoked by a CLI                     |
| `prisma/seed/guard.ts`       | candidate | Prisma                                      |

A candidate is not a promise. Each becomes a module when a second consumer makes it worth
the boundary test, and not before.

## Promoting to a package

Move the folder out, add the manifest the folder never had, publish it, and let this app
import it by version. The trigger is concrete, not aspirational: **a second project imports
it, or a consumer needs a version pinned to a commit.**

When that happens, the `README.md` and `AGENTS.md` travel unchanged — they were written for
a consumer that did not exist yet.

## What is never a module

- Anything that knows what a car is.
- Anything that reads `src/site/`.
- Anything that renders UI for this product.
