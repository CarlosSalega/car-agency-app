# Rename the colliding `CarWithRelations` types and make each derive from its real query

## Objective

Remove the `hashedPassword`-era confusion from the type layer: one dead relation
leaving the server, one duplicated name covering two different contracts, and one
type derived from a declaration that is not the query that actually runs.

## Problem

Three defects, in the order they must be fixed.

### D1 — `seller: true` is dead weight that still crosses to the client (HIGH)

`src/lib/queries/cars.ts:182`, inside `getAdminCarForEdit`, includes the full
`seller` relation. Nothing reads it.

```
src/lib/utils/car-form-utils.ts:13   sellerId: car.sellerId || ""
```

`car.sellerId` is a plain scalar column on `Car`, not the `seller` relation. A grep
for `car.seller`, `car.user` and `.seller?.` across `src/components/cars/`,
`src/lib/utils/` and `src/app/admin/cars/` returns only the `user` reads in
`cars-columns.tsx:82,84` and the scalar read above.

`src/components/cars/car-form/car-form.tsx:1` is `"use client"`, so the full
`Seller` — `firstName`, `lastName`, `phone`, `email` — is serialized to the browser
on every visit to `/admin/cars/[id]/edit` with no consumer. This is the same class
as the `recentLogs` defect removed in `057fc6f`, but carrying real PII, and it is
live in production in both this repo and `fyf-automotores`.

Fix: drop `seller` from the `getAdminCarForEdit` include, and narrow the form type
accordingly. `sellerId` is unaffected — it is a `Car` column.

### D2 — two different contracts share one name

`src/types/cars.ts` and `src/types/car-form.ts:59` both export
`CarWithRelations`, with different shapes:

| Field            | `types/cars.ts`  | `types/car-form.ts` |
| ---------------- | ---------------- | ------------------- |
| `brand`, `model` | yes              | yes                 |
| `user` (owner)   | yes, four fields | no                  |
| `seller`         | no               | yes                 |

They must **not** be merged. Merging would force both queries to fetch all four
relations: `getAdminCarsList` would need `seller: true`, putting every seller's
`phone` and `email` into the admin list RSC payload, and `getAdminCarForEdit` would
need `user`, putting the owner into the form for no reason. Merging would undo the
four security work units `4b5b2f7`, `df8bfaf`, `057fc6f`, `85924dd`.

The name collision is a signal that these are two different contexts — a car in a
listing has an owner, a car in an edit form has a seller. The fix is to name them
for what they are.

### D3 — the form type is derived from a declaration that is not the query

`src/types/car-form.ts:22` exports `carWithRelations`, an object holding the
`include`. It is referenced exactly twice in the whole repo, both inside
`car-form.ts`: once to define it, once to derive the type via
`CarGetPayload<typeof carWithRelations>`. **It is never passed to Prisma.** The
query that actually runs is an inline literal in `getAdminCarForEdit`.

So the type is derived from a parallel copy of the query arguments. Nothing forces
the two to agree. They agree today by coincidence, and D1 is the proof: someone
edited the real query and the parallel declaration drifted, silently.

Fix: make the query arguments a single exported object that the query actually
uses, and derive the type from that same object. One source of truth.

## D3 — the API, verified empirically (read this before implementing D3)

An earlier attempt at this task was cancelled because the implementer had to guess
the Prisma 7 API. It was then investigated directly with `tsc --noEmit` against a
throwaway file, and the result is recorded here so nobody has to rediscover it.

**The pattern that works — a shared args object the query actually spreads:**

```ts
// src/lib/queries/cars.ts
const adminCarForEditArgs = {
  include: { brand: true, model: true },
} satisfies Prisma.CarDefaultArgs;

export async function getAdminCarForEdit(id: string) {
  return prisma.car.findUnique({ where: { id }, ...adminCarForEditArgs });
}
```

```ts
// src/types/car-form.ts
type CarForEdit = CarGetPayload<typeof adminCarForEditArgs>;
```

Verified for both `findUnique` and `findMany`:

- The spread **preserves full inference**. The real return type still carries
  `brand`, `model`, and the narrowed `user`.
- `CarGetPayload<typeof args>` is **structurally identical** to the real return type
  of the query that spreads it (checked in both directions), and also identical to
  the previous inline-literal version. Nothing about the runtime payload changes.

**`Prisma.Result<T, A, F>` is a dead end here — do not use it.** It still exists in
7.10 (`prisma/generated/internal/prismaNamespace.ts:74`), despite the note at
`car-form.ts:15-21` implying the old helpers are gone. But its
`T extends { [K: symbol]: { types: { payload: any } } }` check only succeeds for a
PrismaPromise _value_ (e.g. `const q = prisma.car.findMany(...)`). It does not
match a named `async` function, whose type is `(id: string) => Promise<...>`. The
conditional falls through to an empty payload and silently yields a type with no
relations. It typechecks, so nothing warns you.

**The exact signatures:**

- `CarGetPayload<S extends boolean | null | undefined | CarDefaultArgs>` —
  `prisma/generated/models/Car.ts:2267`. It accepts a `CarDefaultArgs` object, which
  is what the shared-object pattern supplies.
- For `findMany`, `CarGetPayload<typeof args>` yields the **item** type. The query
  returns an array, so the matching type is `Array<CarGetPayload<typeof args>>`.

**Scope note:** `getAdminCarForEdit` and `getAdminCarsList` return the Prisma call
directly, with no `prismaSafe` or `unstable_cache` wrapper, so the derivation works
on them unchanged. The public queries in the same file ARE wrapped, and are out of
scope for D3 — a wrapper is a separate problem and needs its own decision.

There is no import cycle: the type modules would import from
`src/lib/queries/cars.ts`, and that module imports nothing from `src/types/`.

### Two measurement traps that will fake a negative result

Both of these were hit during the investigation. Each one makes a correct
implementation look broken, and reporting that as a finding would be a false result.

1. **`keyof` of a union with `null` is `never`.** `findUnique` returns `T | null`, so
   `"brand" extends keyof RealReturn` evaluates to `false` even though `brand` is
   present. Wrap in `NonNullable<...>` before probing keys.
2. **`CarGetPayload<typeof args>` is the item type, not the array.** Comparing that
   item type against a `findMany` return type yields `false` and looks like the
   spread broke inference. It did not.

The general rule, and the reason both traps were caught: **when a probe fails,
suspect the probe before suspecting the API.** A probe that cannot fail is not
evidence, and neither is one that always fails.

## Authorized scope

Four files, three work units, three commits:

1. `src/lib/queries/cars.ts`, `src/types/car-form.ts` — drop the dead `seller`
   include; export the real args object and derive the form type from it.
2. `src/types/cars.ts`, `src/lib/queries/cars.ts`, and the four consumers —
   rename to distinct, context-true names.
3. Same files as 2 — ensure both types are derived from the live query arguments,
   with no parallel declaration left anywhere.

Consumers that must be updated for the renames:

- `src/components/cars/cars-table.tsx`
- `src/components/cars/cars-columns.tsx`
- `src/components/cars/car-form/car-form.tsx`
- `src/lib/utils/car-form-utils.ts`

## Prisma 7 constraint

`src/types/car-form.ts:15-21` documents the constraint: Prisma 7 removed
`Prisma.validator` and `Prisma.<Model>GetPayload`. Payload types are exported per
model from `@generated/prisma/models/<Model>`, and the args are constrained with
`satisfies Prisma.<Model>DefaultArgs`. Verify the exact import path against
`@generated/prisma` in this repo — do not assume it still works, and do not
reintroduce the removed APIs.

## Naming

Proposed, adjust only if the repo already has a convention:

- `types/cars.ts` → `CarListItem` (a car as it appears in a listing, with owner)
- `types/car-form.ts` → `CarForEdit` (a car as it appears in an edit form)

## Not in scope

- `src/lib/auth/session.ts:37` — server-side, correct.
- `src/app/api/auth/login` — server-side `bcrypt.compare`, curated response.
- `cars-columns.tsx:82,84` keep reading `car.user?.name`; that is the owner field
  the list genuinely needs.
- M-2 (`Seller` PII) as a policy question — whether admins _should_ see seller
  contact data is a product decision. This task only removes data nobody reads.

## DEFERRED — public over-fetch in `getPublicCarBySlug` (technical debt)

Found during W1, deliberately not fixed. Recorded here so it is not rediscovered
from scratch later.

`src/lib/queries/cars.ts`, `getPublicCarBySlug` (~line 112), does
`include: { brand: true, model: true, seller: true }`. The only consumer of the
`Seller` is `src/app/autos/[slug]/page.tsx:120`:

```ts
const sellerPhoneRaw = car.seller?.phone;
```

which strips it to digits and builds a `https://wa.me/...` link. So the query
fetches `firstName`, `lastName`, `email`, `isActive`, `createdById`, `createdAt` and
`updatedAt` for nothing. The same shape as the `user: true` leak fixed in `4b5b2f7`,
just lower severity.

**Why this was NOT fixed here — and why it needs a decision, not a reflex:**

1. It is **not a disclosure**. Verified: `src/components/cars/car-detail/car-detail-specs.tsx`
   has no `"use client"`, so it is a server component, and the page derives only a
   phone string. The full `Seller` stays in server memory and does not reach the
   browser. This is a database-cost defect, not an exposure one.
2. The route is **public and cached with `unstable_cache`** at the query level. The
   cache key is `[CACHE_TAGS.CARS, "car-by-slug", slug]` and is shared across every
   visitor. Narrowing the `include` changes what is stored in that shared cache
   entry, so the change is not purely local to the query — it alters the shape of a
   cache payload that many anonymous readers share.

Fixing it properly means either a `seller: { select: { phone: true } }` (small, but
needs a decision on whether the shared cache entry shape may change) or a
server/client split so the DTO is built before serialization. Both are legitimate;
neither should be chosen by reflex.

**Open question for whoever picks this up:** is the shared `unstable_cache` payload
for `/autos/[slug]` allowed to change shape, or is something else consuming that
cache entry? Verify before touching it.

**Same finding exists in `fyf-automotores`** — it was not audited for this specific
over-fetch, only for `hashedPassword`.

## Acceptance criteria

- [ ] `getAdminCarForEdit` no longer includes `seller`.
- [ ] No component reads `car.seller`; `car.sellerId` still works.
- [ ] The two former `CarWithRelations` have distinct names, and neither name is
      ambiguous about which context it belongs to.
- [ ] Both types are derived from the query arguments that actually run.
- [ ] No `include`/`select` literal is duplicated between a query and a type file.
- [ ] `grep -rn "CarWithRelations" src/` returns nothing.
- [ ] Reintroducing a dead `include` fails a test.

## Checks

- [ ] `pnpm exec tsc --noEmit` -> exit 0. This is the primary proof that the
      derived types match the real queries.
- [ ] `pnpm test` -> green, with a new test asserting `getAdminCarForEdit` does not
      include `seller`.
- [ ] `pnpm exec eslint` on every touched file -> clean.
- [ ] `pnpm exec prettier --check` on every touched file -> clean.
- [ ] Mutation check: add `seller: true` back and confirm a test fails.

## Rollback

Three independent commits, one per work unit: `git revert <sha>`.
