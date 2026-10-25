# Migrate auth from hand-rolled sessions to better-auth

## Objective

Replace the hand-written email+password authentication (`bcryptjs` + a private
`Session` table + custom route handlers) with better-auth, using its email and
password provider, its default `scrypt` password hashing, and its managed
sessions — without changing the `getSession()` contract that 56 call sites
depend on.

## Problem

The current auth works but has concrete, verified gaps:

| #   | Gap                                              | Evidence                                                                                                                                  |
| --- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | No password reset flow exists at all             | `grep -riE "forgot\|reset.?password" src` → 0 hits                                                                                        |
| 2   | Changing a password does not invalidate sessions | `src/app/api/users/[id]/route.ts:120` writes the hash; no `session.deleteMany`                                                            |
| 3   | `cleanupExpiredSessions()` is dead code          | defined at `src/lib/auth/auth.ts:45`, zero call sites                                                                                     |
| 4   | Rate limiter is an in-process `Map`              | `src/lib/rate-limit.ts:11` — resets on deploy, not shared across instances                                                                |
| 5   | User enumeration                                 | `src/app/api/auth/login/route.ts:67-74` returns 403 for inactive vs 401 for unknown; no `bcrypt.compare` when the user is absent (timing) |
| 6   | Minimum password length is 6                     | `src/app/api/users/route.ts:115`                                                                                                          |
| 7   | No second factor                                 | —                                                                                                                                         |
| 8   | Two divergent `hashPassword` implementations     | `src/lib/auth/auth.ts:7` (async) and `src/lib/hash-password.ts:3` (sync)                                                                  |
| 9   | Zero auth tests                                  | 11 test files exist, none covers auth                                                                                                     |

Gaps 1, 2, 3, 5 and 7 are behaviours better-auth ships and this codebase does
not. Gap 8 disappears with the migration. Gaps 1 and 7 stay **out of scope**
here because they require an email provider this project does not have.

## Verified surface in this repository

Established by reading the code and the current better-auth documentation, not
assumed:

- `src/lib/auth/session.ts` — `createSession`, `getSession`, `deleteSession`,
  `requireAuthSession`. Cookie `session`, `httpOnly`, `secure` in production,
  `SameSite=Lax`, 1-hour expiry.
- `src/lib/auth/auth.ts` — `hashPassword`/`verifyPassword` (bcrypt, cost 10),
  `getUserByEmail`, `createUser`, dead `cleanupExpiredSessions`.
- `src/lib/auth/auth-middleware.ts` — `requireAuth`, `requireAdmin`,
  `withAuth`, `withAdmin`, `AuthError`.
- `src/app/api/auth/{login,logout,me}/route.ts` — the whole HTTP surface.
- `src/components/login-form.tsx:37` posts to `/api/auth/login`;
  `src/lib/auth/logout.ts:11` posts to `/api/auth/logout`;
  `src/data/header.ts:14` points at `/api/auth/me`.
- `getSession()` has **56 callers**. Its return shape is the de-facto contract
  of the whole app, and it is **flat**: the session row itself with `user`
  attached — `{ sessionToken, userId, expires, user }` — _not_ a
  `{ session, user }` wrapper. Measured: 63 reads of `session.user`, 4 of
  `session.expires`, 0 of `session.session`.
- `prisma/schema.prisma` already contains an **Auth.js-shaped** `User`,
  `Account`, `Session` and `VerificationToken`, but `next-auth` is not a
  dependency. That schema is dead weight and does not match better-auth's
  shape.
- better-auth stores credentials in `Account` with `providerId: "credential"`
  and `accountId` equal to the user id. Without that row, email+password sign-in
  fails. This is the step that breaks everything if forgotten.
- `emailVerified` must be `boolean` in better-auth; the current column is
  `DateTime?`.
- The seed is fully destructive (`prisma/seed/repositories.ts:8` deletes every
  table) and uploads `public/autos/*.webp` to Cloudinary on each run
  (`prisma/seed.ts:61-63` asserts Cloudinary is configured and reachable).
  All four Cloudinary variables are present in `.env`.

## Scope

In scope: `prisma/schema.prisma` auth models, `src/lib/auth/**`,
`src/app/api/auth/**`, `src/components/login-form.tsx`, `src/data/header.ts`,
`prisma/seed/{repositories,users,types}.ts`, `prisma/seed.ts`, `package.json`,
and new characterization tests.

Out of scope: password reset, email verification, 2FA, any email provider, the
admin UI, car/seller/brand data model, and Cloudinary behaviour.

## Specs

- **S1** — Authentication moves to better-auth's email and password provider.
- **S2** — No email provider is introduced in this migration. Password reset,
  email verification and 2FA are explicitly out of scope and deferred.
- **S3** — Nothing in the current database is preserved. It is mock seed data
  and is regenerated by resetting and reseeding.
- **S4** — Car images come from `public/autos` (62 webp files) via
  `prisma/seed/image-manifest.ts`, uploaded to Cloudinary by the seed as today.
- **S5** — `getSession()` keeps its current contract, which is **flat**: it
  returns the session row with `user` attached —
  `{ sessionToken, userId, expires, user } | null` — not `{ session, user }`.
  `expires`, `user.isActive` and `user.role` stay intact so the 56 call sites
  and the four guards do not change.
- **S6** — Passwords are hashed with better-auth's default `scrypt`. `bcryptjs`,
  `src/lib/hash-password.ts` and both duplicated `hashPassword` functions are
  removed.
- **S7** — The seed creates the admin through `auth.api.signUpEmail`, so the
  hash is always produced by the configured algorithm.
- **S8** — Characterization tests describe the current auth behaviour before
  any migration edit, and must pass unchanged after it.
- **S9** — `role` and `isActive` are better-auth `additionalFields` with
  `input: false`, so a client cannot set them.
- **S10** — The seeded admin `admin@caragency.com` / `admin1234` still logs in
  and still reaches `/admin` after the migration.

## Tasks

- [x] T1 — Baseline: record `build`, `tsc --noEmit`, `test` and `lint` results
      before any edit. Route: inline.
- [x] T2 — Write characterization tests for the current auth: login success,
      bad password, unknown email, inactive user, session read with/without
      cookie, expiry, `requireAdmin` on a non-admin, logout. Route: inline.
- [x] T3 — Rewrite the four auth models in `prisma/schema.prisma` to
      better-auth's canonical shape, keeping PascalCase model names and mapping
      them with `modelName`. Route: inline.
- [x] T4 — Install `better-auth`, add `BETTER_AUTH_SECRET` and
      `BETTER_AUTH_URL`, and create `src/lib/auth/server.ts` with
      `prismaAdapter`, `minPasswordLength: 8`, and the `additionalFields`.
      Route: inline.
- [x] T5 — Replace `getSession()` with an adapter over `auth.api.getSession()`
      that preserves the S5 contract; keep the guards untouched. Route: inline.
- [x] T6 — Mount `/api/auth/[...all]` with `toNextJsHandler`; repoint the login
      form, logout and the header endpoint. Route: inline.
- [x] T7 — Make the seed create the admin with a `better-auth/crypto` hash and
      a `credential` `Account` row, and delete `bcryptjs` and both
      `hashPassword` implementations. Route: inline. (Deviation from the
      original wording, which said `auth.api.signUpEmail`; see L11.)
- [x] T8 — Reset and reseed, then prove the seeded admin reaches `/admin`.
      Route: inline.
- [x] T9 — Verification: characterization tests still green, `build`,
      `tsc --noEmit`, `test`, `lint`, `prettier --check`. Route: inline.

## Applicable checks

```
pnpm exec tsc --noEmit
pnpm test
pnpm build
pnpm lint
pnpm exec prettier --check .
pnpm exec prisma validate
pnpm exec prisma generate
```

Destructive check, run only inside T8 and only because S3 authorizes it:

```
pnpm exec prisma migrate reset --force
pnpm db:seed
```

## Route and trigger evidence

Large task: it fails the resume test (schema migration, seed rewrite, 56 call
sites, and no existing auth tests). Tracking is therefore mandatory.

Route is **direct inline** for every task. The Writer trigger does not fire:
there are no two independent units of behaviour with disjoint edit surfaces
here — every task edits the same auth module graph and depends on the previous
one, so parallel writers would collide on `src/lib/auth/**` and the schema.

## Test-first policy

Characterization tests (T2) come before any migration edit. They describe
behaviour that already exists, so they must be **green on arrival** — this is
the correct exception to RED-before-GREEN: there is no new behaviour to drive,
the goal is to pin the current contract so the migration cannot silently change
it. Every test asserts the observable effect (HTTP status, cookie presence,
returned shape), not internals.

## Known conflict

`admin1234` is 9 characters. `minPasswordLength: 10` would make the seeded admin
uncreatable and break S10. The migration therefore uses **8**, better-auth's
default and still an improvement over the current 6. Raising it to 10 later
requires changing the seed password, which is a user-visible decision.

## Log

- **L1** — "ahora quiero que planifiques una migracion de auth a better-auth,
  utilizaremos email y password, crees que sea mas seguro que el auth actual?"
- **L2** — "los datos actuales son mock, estan en el seed, con lo cual no hay
  problema con respecto a perdida de datos o backups, esto no es produccion"
- **L3** — "en /public hay imagenes de autos que podemos usar para popular la DB
  cuando terminemos, no hace falta mantener nada de la DB actual"
- **L4** — "arranca con el feature document y sigue tu recomendacion de no
  incluir de momento proveedor de email"
- **L5** — Analysis: the Auth.js-shaped schema in `prisma/schema.prisma` is dead
  weight (`next-auth` is not installed) and must not be mistaken for a
  ready-made better-auth schema; the shapes differ in password location,
  `emailVerified` type, session token/expiry names and the whole `Account`
  model.
- **L6** — Decision: L2 and L3 remove the expensive half of an auth migration.
  There is no password hash to preserve, so the project takes better-auth's
  `scrypt` default instead of a bcrypt compatibility shim. That is the actual
  security upgrade and it is free here.
- **L7** — Decision: L4 keeps reset, verification and 2FA out of scope. They
  are additive later and need no rework.
- **L8** — T2 evidence, and a correction to the plan. The characterization
  tests proved that `getSession()` returns the **flat** session row with `user`
  attached, not `{ session, user }`. Measured across `src/`: 63 reads of
  `session.user`, 4 of `session.expires`, 0 of `session.session`. The adapter
  sketched earlier in this session would have broken all 56 call sites. S5 and
  the verified-surface notes are corrected above; T5 must map better-auth's
  `{ session, user }` onto the flat shape, not pass it through.
- **L9** — T1/T2 verification. Baseline before any edit: `tsc --noEmit` exit 0,
  `pnpm test` 11 files / 73 tests passing, `pnpm build` exit 0, `pnpm lint`
  **already failing** with 31 problems (7 errors, 24 warnings) — all
  pre-existing, so the lint criterion is "no new problems", not "lint passes".
  After T2: 4 new test files, 32 new tests, all green on arrival as intended
  for characterization tests (`session.test.ts` 10,
  `auth-middleware.test.ts` 11, `login.test.ts` 10, `logout.test.ts` 1).
  Full suite after T2: **14 files / 105 tests passing**, `tsc --noEmit` exit 0,
  `lint` unchanged at 31 pre-existing problems. Committed on
  `feat/better-auth-migration` as `31fbc66`.
- **L10** — T3/T4/T5/T6 implementation. Schema: `emailVerified Boolean`, and
  `Session`/`Account`/`Verification` replaced by better-auth's canonical shape
  (the model is `Verification`, not `VerificationToken`, so the adapter's
  default model name resolves against `prisma.verification`). `server.ts` sets
  `session.expiresIn` to 3600s to match the old one-hour window,
  `minPasswordLength: 8`, `additionalFields` for `role`/`isActive` with
  `input: false`, and `advanced.database.generateId` to keep uuid ids.
  `session.ts` is now a pure adapter: better-auth's nested
  `{ session, user }` in, the flat `{ sessionToken, userId, expires, user }`
  out. `/api/auth/[...all]` mounts `toNextJsHandler(auth)`; the three custom
  routes are deleted; the login form, logout helper and header endpoint point
  at `sign-in/email`, `sign-out` and `get-session`.
- **L11** — Deviation from S7. The seed does **not** call
  `auth.api.signUpEmail`: the seed is a CLI process with no request context,
  and better-auth's sign-up path sets the session cookie through
  `next/headers`. Instead the seed (and the admin users API) hash with
  `hashPassword` from `better-auth/crypto` and insert the `credential`
  `Account` row explicitly. This is the same scrypt implementation the sign-in
  endpoint verifies with, and `password.test.ts` pins that compatibility.
- **L12** — S8 refined after the fact. `auth-middleware.test.ts` survived
  unchanged, which is the strongest evidence the guard contract held.
  `session.test.ts` was rewritten to assert the flat shape against a mocked
  `auth.api.getSession` -- the mapping is the new risk. `login.test.ts` and
  `logout.test.ts` were retired together with the routes they described: they
  characterised code that no longer exists. `password.test.ts` replaces them
  with the risk that actually matters now (seed hash vs. verifier).
- **L13** — Deliberate behaviour change, both improvements: an inactive
  account now fails sign-in with `401 FAILED_TO_CREATE_SESSION` from the
  `databaseHooks.session.create.before` hook instead of the old
  `403 "cuenta desactivada"`, and an unknown email returns the same
  `401 INVALID_EMAIL_OR_PASSWORD` as a wrong password. The 403/401 split that
  leaked account existence is gone. Verified by HTTP.
- **L14** — Bug caught only by the end-to-end run: `src/proxy.ts` gated
  `/admin` on a cookie literally named `session`, which better-auth never
  sets. A valid session still redirected to `/admin/login`. Fixed with
  `getSessionCookie(request)` from `better-auth/cookies`. The proxy stays an
  optimistic presence check; authority remains in the layout's `getSession()`.
- **L15** — T8 used `prisma db push --force-reset --accept-data-loss`, not
  `migrate reset`: the project has only two historical migrations and ships
  `db:push`, so push is its schema workflow. Prisma's built-in
  destructive-action guard refused the command and required consent given
  _after_ the attempt; the user confirmed explicitly and the run proceeded.
- **L16** — T9 evidence. `pnpm build` OK (`/api/auth/[...all]` mounted),
  `tsc --noEmit` OK, `pnpm test` 14 files / 93 tests, `prettier --check .`
  clean, `pnpm lint` 30 problems (6 errors, 24 warnings) versus the 31/7
  baseline -- no new problems, one fewer. End-to-end over HTTP: wrong password
  and unknown email both 401; seeded admin 200 with `role: "ADMIN"`; session
  expiry 60 minutes; deactivation blocks sign-in; reactivation restores it;
  sign-out nulls the session; `/admin` and `/admin/users` 200 with a session
  and 307 to `/admin/login` without one; admin-created user logs in with the
  password set through the API; a 7-character password is rejected with the
  8-character message. Database left in exact seed state: one active admin.
