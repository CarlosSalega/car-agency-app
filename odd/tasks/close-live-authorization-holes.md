# Close the live authorization holes found in the audit

## Objective

Fix the two CRITICAL findings and the one HIGH finding that shares their root
cause, as three independently revertible work units. Public surface is fixed by
the user: **only `/`, `/autos`, `/ventas`, `/contacto` are public.**

## Why these three, in this order

W1 first because it is the cheapest change with the widest blast radius: one
condition inside `getSession()` repairs all 37 inline `getSession()` checks at
once, including the two mutating routes that have no role check of their own.

W2 and W3 after, because they are the two findings that leak data or destroy
assets, and both are independent of W1.

## W1 — Re-assert `isActive` in the single choke point

`src/lib/auth/session.ts:40` currently returns a session based only on token
existence and expiry. It never looks at `session.user.isActive`, so deactivating
a user does not revoke their live session for up to 1 hour (`expires` is +1h at
`session.ts:7`).

The only place that ever checked `isActive` after login was `requireAuth`
(`auth-middleware.ts:30-32`), which is dead code.

Fix: include `!session.user.isActive` in the existing invalid-session condition
at `session.ts:40`, so it returns `null` like an expired session.

**Behavior change, explicitly authorized:** a deactivated user with a live
session now gets `null` from `getSession()` and therefore 401 from every guarded
route, instead of operating normally. This is the correction, not a regression.
The login route already rejects inactive users before password verification
(`api/auth/login/route.ts:67-74`), so this closes the window between login and
deactivation.

Do NOT delete the user's `Session` rows here. That is a separate improvement
(H-1 in the audit) and would change logout semantics. This change only makes
the existing session stop authorizing.

## W2 — Guard and narrow `GET /api/cars/[id]`

`src/app/api/cars/[id]/route.ts:9-33` is the only handler in its own file with
no session check, even though `getSession` is already imported at line 6 for
`PUT` and `DELETE`.

Two changes, both required:

1. **Add the session guard.** Not public per the user's definition. This breaks
   nothing public — verified: `src/app/autos/[slug]/page.tsx:38,103` reads
   through `getPublicCarBySlug` directly from Prisma and never calls this
   endpoint, and the only client caller is `components/cars/cars-table.tsx:29`,
   which is admin-only.
2. **Narrow the `user` relation.** `include: { user: true }` at line 22 returns
   the entire `User` row, and `schema.prisma:71` declares `hashedPassword
String?`. Replace it with an explicit `select` that carries only what a car
   detail response legitimately needs.

Also add `deletedAt: null` to the `where` so soft-deleted inventory stops being
readable. The public list already filters on it; this handler did not.

Do NOT change the 404/500 status codes or the Spanish error messages.

## W3 — Deny unowned image keys instead of allowing them

`src/app/api/upload/route.ts:91-106` wraps the entire ownership check in
`if (carsWithImage.length > 0)`. A `key` referenced by no car skips the check
and falls through to `ImageService.delete(key)` → `cloudinary.uploader.destroy()`.

That is allow-by-default on a destructive endpoint: any authenticated
`COLLABORATOR` can destroy any image in the Cloudinary account by POSTing an
arbitrary `public_id`.

Fix: when no car references the key, return 403 instead of deleting. The
existing owner-or-ADMIN check stays exactly as it is for referenced keys.

Do NOT add Cloudinary prefix/namespace validation. That invents a scheme nobody
asked for and needs maintaining. The 403 closes the finding on its own.

## Scope

Authorized — exactly these three files:

- `src/lib/auth/session.ts`
- `src/app/api/cars/[id]/route.ts`
- `src/app/api/upload/route.ts`
- this task document, plus `odd/honest-notes.md`

Not authorized:

- `lib/queries/cars.ts:163` and `:211-215` — the same `user: true` leak through
  the RSC payload to a client component (audit H-2). Separate work unit.
- `api/settings` GET guards (M-1), `api/sellers` GET PII (M-2), admin cars
  ownership (M-3), session token hashing (M-4), `api/images/[...path]` path
  traversal (M-5), `ADMIN_NAVIGATION` comment (M-6), login rate limiting (H-3).
- 401-vs-403 status codes (L-1), `proxy.ts` security headers (L-2).
- Any change to the public pages or the public query helpers.

Mixing a security fix with these would make it impossible to revert one without
the other. They stay in the ledger as separate work units.

## Acceptance criteria

1. `pnpm exec tsc --noEmit` exits 0.
2. ESLint error count does not increase; report the exact number before and
   after.
3. Prettier clean on all three files.
4. `GET /api/cars/[id]` no longer returns a `user` object containing
   `hashedPassword`. Grep the final diff to prove no `hashedPassword` remains in
   a serialized path.
5. `getSession()` returns `null` for an inactive user.
6. `DELETE /api/upload` with an unreferenced key returns 403, not a delete.
7. Each work unit is its own commit.

## Checks

| Check | Command                                     | Result  |
| ----- | ------------------------------------------- | ------- |
| T1    | `pnpm exec tsc --noEmit`                    | pending |
| T2    | ESLint error count, before and after        | pending |
| T3    | `pnpm exec prettier --check` on the 3 files | pending |
| T4    | Structural readback of each diff            | pending |
| T5    | Three separate commits                      | pending |

No route handler is exercised by an automated test in this repo, so T1–T4 are
the available proof. Say that plainly in the report rather than implying test
coverage that does not exist.

## Route

Delegated writer. Three non-trivial files on the authorization path, and
understanding the session/Prisma shapes is preparation for the write, so the
read and the edit happen in one bounded worker.

## Tasks

- [x] **W1** — `isActive` in `getSession()`. `2fc4a67`
- [x] **W2** — session guard + narrowed `user` select + `deletedAt` filter. `287ad19`
- [x] **W3** — 403 for unreferenced image keys. `24489cc`
- [x] **T** — verify, update ledger, three commits. `bc9fd77`

## Progress

All three work units landed, 68 insertions / 16 deletions total. The
orchestrator re-measured `tsc` and the ESLint count independently after the
worker returned; both matched the worker's report.

## Corrections to this document

Three factual errors in this spec were found during execution:

1. "all 37 inline `getSession()` call sites" — the real number is **32
   invocations across 22 files**. The conclusion is unaffected, but the
   blast-radius figure was inflated.
2. "the only client caller is `components/cars/cars-table.tsx:29`" — that line is
   a `DELETE` fetch, not a `GET`. **Nothing in the repo called
   `GET /api/cars/[id]` at all.** The endpoint was a fully orphaned
   unauthenticated read. The guard is still correct; the stated justification
   for it was not.
3. The 403 message for an unreferenced key originally reused
   `"...Pertenece a otro vehículo."`, which is **factually false** for a key no
   car references. Reusing it was defensible under the "do not invent strings"
   constraint, but a lying error message is its own defect. Corrected in
   `fix(upload): give the unreferenced-key 403 an honest message`.

## Judgment calls kept, and why

- The explicit `carsWithImage.length === 0` early return was preferred over the
  one-liner (dropping the wrapper works, because `[].some(...)` is already
  `false`). The explicit form makes deny-by-default legible and stops a future
  reader from "simplifying" it back into the hole.
- No Cloudinary prefix/namespace validation was added. The 403 closes the
  finding on its own; a namespace scheme would be invented structure nobody
  asked for.

## Next step

Open, in `odd/honest-notes.md`: H-2 (the same `user: true` leak reaching a
client component through the RSC payload — W2 fixed the endpoint, not this),
H-3, M-1 through M-6, L-1, L-2. The next one to take is H-2, since it is the
same data leak on a different path.
