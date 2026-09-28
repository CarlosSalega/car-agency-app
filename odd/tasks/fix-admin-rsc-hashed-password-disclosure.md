# Close the `hashedPassword` disclosure in car-agency-app

## Objective

Stop `hashedPassword` from reaching the browser through the admin car read paths,
and make the type contract stop promising it.

## Status: partial — the endpoint is already fixed

`GET /api/cars/[id]` was already repaired in an earlier work unit: it has the
`getSession()` guard, `where: { id, deletedAt: null }`, and an explicit
`user.select`. **Do not touch that file.** The RSC payload path is what remains
open, and it was never fixed.

## Problem

`user: true` returns every column of the `User` model, and `hashedPassword` is one
of them. Three sites remain.

### C1 — `getAdminCarsList` leaks across the RSC boundary (HIGH)

`src/lib/queries/cars.ts:163`. The chain is:

```
src/app/admin/cars/page.tsx:23    server component, await getAdminCarsList(...)
        ↓  React serializes the whole object across the boundary
src/components/cars/cars-table.tsx:1   "use client"
        ↓
src/components/cars/cars-table.tsx:41  cars={cars}
```

There is no per-prop pruning: React ships whatever object it is handed. Twelve
cars per page, twelve `User` rows, twelve password hashes — visible in DevTools, in
the RSC payload, and in any proxy that logs response bodies.

`src/app/admin/layout.tsx` requires only `getSession()`, with no role check, and the
schema default role is `COLLABORATOR`. A low-privilege collaborator therefore
receives the hash of every user who created a car.

The only field ever read is `car.user?.name` at
`src/components/cars/cars-columns.tsx:82,84`.

### C2 — `recentLogs` is a loaded gun (LATENT)

`src/lib/queries/cars.ts:211` fetches logs with `user: true`, but
`src/app/admin/page.tsx:10-17` destructures only the six counts. Fetched,
serialized, discarded. The day someone renders the logs, C1 goes live on the
most-visited admin page.

Verified: `recentLogs` has no consumer in app code. Only `queries/cars.ts` and its
test reference it.

### C3 — the type contract invites the bug back

`src/types/cars.ts:6` declares `user: User | null`, where `User` is the full Prisma
model imported from `@generated/prisma/client`. A developer who needs the owner's
email adds a field to this type, and `user: true` becomes "correct" again. Fixing
the query without narrowing the type is a symptom-level patch.

## Authorized scope

Three source files, four work units, four commits. No other file.

1. `src/lib/queries/cars.ts` — `getAdminCarsList`: replace `user: true` with the
   explicit `select` already used in `api/cars/[id]/route.ts`.
2. `src/types/cars.ts` — narrow `user` to those four fields.
3. `src/lib/queries/cars.ts` — remove the `recentLogs` query and the returned key.
4. `src/lib/queries/__tests__/cars.test.ts` — update the two assertions that pin
   the vulnerability, and add negative tests that fail if the bug is reintroduced.

## Not in scope

- `src/lib/auth/session.ts:37` (`include: { user: true }`). Server-side only, never
  serialized to a client.
- `getAdminCarForEdit`'s `seller: true` (`queries/cars.ts:182`). The `Seller` model
  has no `hashedPassword`; the `phone`/`email` PII is legitimately needed by the
  edit form. That is M-2, a separate decision.
- `api/auth/login` selecting `hashedPassword`. Correct as is: `bcrypt.compare`
  needs it server-side, and the response returns a curated object.

## Why the negative tests must assert on the payload

`src/lib/queries/__tests__/cars.test.ts:160` and `:232` currently assert
`user: true` and `include: { user: true }`. The suite requires the leak, and the
tempting way to make them green again after a fix is to restore `user: true`.

A test that scans the query _arguments_ for the string `hashedPassword` does not
work: a blanket `user: true` emits the key `user`, never that literal, so such a
test stays green with the vulnerability present. It must simulate Prisma's
projection — the stored row filtered by the requested `select`, where `true` means
every column — and assert on the resulting payload.

This was learned the hard way in the sibling `fyf-automotores` repo, where the
first version of that test was decorative and passed against a live bug.

## Acceptance criteria

- [ ] `getAdminCarsList` never requests a full `User` record.
- [ ] `getAdminCarStats` performs no `log.findMany` call.
- [ ] `types/cars.ts` no longer references the full `User` model.
- [ ] `cars-columns.tsx:82,84` still compiles and still renders the owner name.
- [ ] Reintroducing `user: true` makes the suite fail. Verify this by mutation,
      not by reading the test.

## Checks

- [ ] `pnpm exec tsc --noEmit` -> exit 0.
- [ ] `pnpm test` -> green, including the new negative cases.
- [ ] `pnpm exec eslint` on the touched files -> no new problems.
- [ ] `pnpm exec prettier --check` on the touched files -> clean.
- [ ] `grep -rn "user: true" src/` -> only `auth/session.ts`.
- [ ] Mutation check: reintroduce `user: true`, confirm the suite fails, restore.

## Rollback

Each unit is an independent commit: `git revert <sha>`.
