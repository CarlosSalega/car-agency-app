# Auth phase 2: email delivery, password reset, verification and 2FA

## Objective

Close the three auth gaps the better-auth migration deliberately left out —
password reset, email verification and second factor — plus the session
revocation gap it exposed, now that a Resend API key exists.

## Problem

The migration replaced the auth engine but not the missing capabilities. After
it, the app still has:

| #   | Gap                                          | Consequence                                                                                                  |
| --- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 1   | No password reset                            | A user who forgets their password is locked out until an admin sets a new one                                |
| 2   | Changing a password does not revoke sessions | A stolen session survives a password change                                                                  |
| 3   | No email verification                        | `emailVerified` is always `false`; a typo'd address is never caught, and a reset would go to the wrong inbox |
| 4   | No second factor                             | One password is the whole security boundary                                                                  |

Gap 2 has two paths: better-auth's own reset endpoint and the admin
`PUT /api/users/[id]`. Both must revoke.

## Verified surface in this repository

- `resend` 6.34.1 is installed. `RESEND_API_KEY` is in `.env` (36 chars) and
  **not** in `.env.example`.
- The key is **restricted to send-only**: `GET https://api.resend.com/domains`
  returns `401 restricted_api_key`. The plan therefore cannot verify which
  domains exist, and the sender address must be configuration, not a guess.
- There is no email code anywhere in `src/` or `prisma/` today.
- `src/lib/auth/server.ts` is the single better-auth instance:
  `prismaAdapter`, `session.expiresIn: 3600`, `minPasswordLength: 8`,
  `additionalFields` for `role`/`isActive`, and a
  `databaseHooks.session.create.before` hook that aborts session creation for
  inactive users.
- `src/app/admin/layout.tsx` guards with `getSession()` and treats
  `/admin/login` specially through the `x-pathname` header set by
  `src/proxy.ts`.
- `src/components/login-form.tsx` posts to `/api/auth/sign-in/email` and
  redirects to `/admin` on `res.ok`.
- The 2FA plugin's exact schema, read from the installed package
  (`dist/plugins/two-factor/schema.mjs`): `user.twoFactorEnabled Boolean`, and a
  `twoFactor` model with `secret`, `backupCodes`, `userId` (indexed),
  `verified`, `failedVerificationCount`, `lockedUntil`.
- The plugin needs **no extra peer dependency**: it uses
  `@better-auth/utils/otp`, already bundled.
- `next/server` exports `after()`, which is the correct primitive for sending
  email after the response without delaying it.
- better-auth endpoints that exist without extra config:
  `POST /request-password-reset`, `POST /reset-password`,
  `POST /send-verification-email`, `GET /verify-email`.
- With `twoFactor()` installed: `POST /two-factor/enable`,
  `POST /two-factor/verify-totp`, `POST /two-factor/disable`, and sign-in
  returns `{ twoFactorRedirect: true }` instead of a session.

## Scope

In scope: `src/lib/email/**` (new), `src/lib/auth/server.ts`,
`src/app/admin/{forgot-password,reset-password,two-factor,security}/page.tsx`
(new), `src/components/login-form.tsx`, `src/components/auth/**` (new),
`src/app/api/users/[id]/route.ts`, `prisma/schema.prisma`, `prisma/seed/**`,
`.env.example`, and new tests.

Out of scope: self-service registration, magic links, social providers, OTP by
email as a second factor (TOTP only), and any change to the car/seller domain.

## Specs

- **S1** — All outbound mail goes through one module, `src/lib/email/send.ts`,
  backed by Resend. The key is read from `RESEND_API_KEY` and never committed;
  the sender comes from `RESEND_FROM_EMAIL`.
- **S2** — Password reset flow: `/forgot-password` posts to
  `/api/auth/request-password-reset` with `redirectTo` pointing at
  `/reset-password`; the emailed link lands there with `?token=`; the page
  posts to `/api/auth/reset-password`. Both pages live in the `(auth)` route
  group, outside `/admin`, so they are reachable without a session (L8).
- **S3** — The reset request must not reveal whether an account exists: the
  endpoint answers the same way for a known and an unknown address, and the
  response is not delayed by the send (S8).
- **S4** — `revokeSessionsOnPasswordReset: true`. A completed reset destroys
  every session of that user, including the one that requested it.
- **S5** — An admin changing another user's password through
  `PUT /api/users/[id]` also deletes that user's sessions, inside the same
  transaction as the password write.
- **S6** — Email verification is available: a user can be sent a verification
  email and, after clicking it, `emailVerified` becomes `true`.
  `requireEmailVerification` stays **false** — there is no self-service sign-up,
  every account is admin-provisioned, and enforcing it would lock out the seeded
  admin and every existing user on the first deploy.
- **S7** — 2FA is TOTP with backup codes, per user, enabled from
  `/admin/security` by entering the current password. Enabling returns a TOTP
  URI rendered as a QR code plus one-time backup codes; the user must confirm a
  code before `twoFactorEnabled` flips to true.
- **S8** — Email sends are scheduled with `after()` so the HTTP response is not
  held open by Resend; send failures are logged and never surface as an auth
  error.
- **S9** — A user with 2FA enabled cannot reach `/admin` after only a password:
  sign-in returns `twoFactorRedirect`, the form sends them to `/two-factor`
  (pre-session, so it lives in the `(auth)` group like reset), and only a
  verified code yields a session.
- **S10** — Everything the migration guaranteed still holds: the flat
  `getSession()` contract, the 401/403 guard semantics, the inactive-account
  session hook, and the absence of user enumeration at login.

## Tasks

- [x] T1 — Email module. `src/lib/email/send.ts` (Resend client, failure
      logging, never throws) and `src/lib/email/templates.ts` (reset template).
      `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `BETTER_AUTH_SECRET` and
      `BETTER_AUTH_URL` documented in `.env.example`. Route: inline. Covers S1,
      S8. Commit: `e013ef5`.
- [x] T2 — Password reset: `sendResetPassword`, `revokeSessionsOnPasswordReset`,
      `backgroundTasks.handler` via `after()`, `/forgot-password` and
      `/reset-password` in the `(auth)` route group, plus the link on the login
      form. Route: inline. Covers S2, S3, S4, S8. Commit: `e013ef5`.
- [x] T3 — Session revocation on the admin password path in
      `PUT /api/users/[id]`, inside the existing transaction, sparing the acting
      admin's own session. Route: inline. Covers S5. Commit: `e013ef5`.
- [x] T4 — Email verification: `emailVerification.sendVerificationEmail`, the
      `/verify-email` landing page in the `(auth)` group, an admin-only send
      route at `/api/users/[id]/verify-email` (address taken from the row), and
      a verification badge plus a send action in the admin users table. Route:
      inline. Covers S6. Commit: pending.
- [ ] T5 — 2FA: `twoFactor()` plugin, Prisma migration for
      `User.twoFactorEnabled` and the `TwoFactor` model, `/admin/security`
      (enable, QR, confirm, backup codes, disable), `/two-factor` (login step),
      and the `twoFactorRedirect` branch in the login form. Adds a QR
      dependency. Route: inline. Covers S7, S9.
- [x] T6 — Tests for this slice: `sendEmail` with Resend mocked (payload,
      missing config, provider rejection, throw), reset template rendering and
      escaping, and the admin password path's session deletion including the
      self-change exception. Route: inline. Commit: `e013ef5`.
- [x] T7 — Verification for this slice: `tsc --noEmit`, `test`, `build`,
      `lint`, `prettier --check`, plus a real end-to-end run against the running
      app. Route: inline. Evidence in L9-L11. Commit: `e013ef5`.

## Open decisions

1. **Sender address — RESOLVED.** Answered `onboarding@resend.dev`. Real
   delivery is therefore limited to the Resend account owner's inbox
   (`carlosalfredosalegas@gmail.com` per Resend's own rejection message), which
   is enough to exercise the flow and not enough for real users. A verified
   domain plus a `RESEND_FROM_EMAIL` change is the only step left for
   production. No code change needed.
2. **Email verification gating.** Recommended: do not gate login (S6). Confirm
   if you want it enforced instead, knowing it locks out every current account.
3. **2FA placement.** Recommended: its own `/admin/security` page. The
   alternative is folding it into `/admin/config`, which is currently
   site-wide settings, not per-user.

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

## Route and trigger evidence

Large task: several sessions, a schema change, four new pages, and no email
infrastructure to build on. Tracking is mandatory.

Route is **direct inline** for every task. The Writer trigger does not fire:
the tasks are strictly sequential and touch the same module graph
(`src/lib/auth/server.ts`, `src/lib/email/**`, the admin shell), so parallel
writers would collide. No two units have disjoint edit surfaces.

## Test-first policy

Behaviour changes get RED first: the reset endpoint's status parity, session
revocation on password change, and the `twoFactorRedirect` branch each get a
failing test before the implementation. Email delivery is tested with Resend
mocked, asserting the payload the module builds, never a real network call.
The one real send in T7 is a manual verification step, not part of the suite.

## Log

- **L1** — "en .env agregué RESEND_API_KEY ya podemos instalarlo y empezar a
  planificar lo que quedo afuera previamente"
- **L2** — Installed `resend` 6.34.1. Verified the key is present (36 chars)
  without printing it.
- **L3** — Discovery: the key is send-only. `GET /domains` returns
  `401 restricted_api_key`, so the sender address and domain verification must
  be user-supplied configuration, not something the plan can derive.
- **L4** — Discovery: the 2FA plugin needs no extra peer dependency; it ships
  `@better-auth/utils/otp`. Its exact Prisma fields were read from the
  installed package rather than guessed.
- **L5** — Decision: `requireEmailVerification` stays false (S6). There is no
  public sign-up, so enforcing it adds no protection and locks out every
  existing account. Verification is still built, because a wrong address makes
  password reset dangerous.
- **L6** — Decision: `revokeSessionsOnPasswordReset: true` and the admin
  password path revoke too (S4, S5). This closes gap 2 from the migration
  audit, which was left out of that phase for scope reasons only.
- **L7** — Decision (user answer to the sender question):
  `RESEND_FROM_EMAIL="onboarding@resend.dev"`. Resend confirmed the limit in its
  own words: "You can only send testing emails to your own email address
  (carlosalfredosalegas@gmail.com)". The flow is testable; real users need a
  verified domain.
- **L8** — Deviation from the plan: the recovery pages live at `/forgot-password`
  and `/reset-password` inside a new `src/app/(auth)` route group, **not** under
  `/admin`. `/admin`'s layout redirects every session-less request to
  `/admin/login`, and `src/proxy.ts` redirects on the cookie before the layout
  even runs. Hosting recovery under `/admin` would mean carving two exceptions
  into that guard, and every future pre-session page would inherit the hole.
  The guard stays absolute instead. Consequence: S2's routes differ from the
  plan's wording, which is why the spec line was updated rather than the code.
- **L9** — Deviation: email deferral uses better-auth's own
  `advanced.backgroundTasks.handler` wired to Next's `after()`, instead of
  hand-rolling scheduling inside `sendEmail`. Reason found by reading the
  installed package: `runInBackgroundOrAwait` **awaits** the callback unless
  that handler is configured, so `sendEmail` is not the place where a send can
  be deferred. `sendEmail` now simply awaits Resend and never throws.
- **L10** — `.env.example` was missing `BETTER_AUTH_SECRET` and
  `BETTER_AUTH_URL` from the previous phase. Added together with the two Resend
  variables, per the file's own rule that a variable the app reads belongs there
  in the same commit.
- **L11** — End-to-end evidence against `next start` on :3000, database at exact
  seed state (one active admin, `admin@caragency.com`):
  - `GET /forgot-password` and `GET /reset-password` → 200 without a session;
    `/reset-password` without a token renders the "Enlace inválido" state.
  - `GET /admin/users` without a cookie → 307 to `/admin/login`. The guard is
    untouched.
  - `request-password-reset` for a known and an unknown address → both `200`
    with the byte-identical body
    `{"status":true,"message":"If this email exists in our system, check your
email for the reset link"}`. Repeated requests → `429`, which is per-IP and
    identical for both addresses.
  - The send path really ran: the server logged
    `[EMAIL] Resend rejected the message: validation_error ...` while the HTTP
    response stayed `200`. That is S8 doing its job.
  - Full reset with a token planted directly in `Verification` (standing in for
    the email): the `/api/auth/reset-password/<token>?callbackURL=…` link
    returned `302` to `/reset-password?token=…`; `POST /api/auth/reset-password`
    → `200`; the old password → `401`; the new one → `200`; replaying the same
    token → `400 INVALID_TOKEN`.
  - Session revocation (S5): created a second user, signed in as them, confirmed
    the session resolved to that user, had the admin change their password, and
    the session then returned `null`. The admin's own session survived.
  - Cleanup: test user hard-deleted, admin password restored to `admin1234`
    through the real reset flow, verification rows removed. Final state: one
    user, `admin1234` logs in, zero verification rows.
- **L12** — Verification totals for this slice: `tsc --noEmit` clean;
  `test` 17 files / 105 tests passing (was 14 / 93); `build` clean with
  `/forgot-password` static and `/reset-password` dynamic; `prettier --check`
  clean; `lint` 30 problems (6 errors, 24 warnings) — identical to the
  post-migration baseline, so nothing new was introduced.
- **L13** — T4 shipped. Two things were not in the plan and are worth naming:
  - The admin action takes the address **from the database row**, never from the
    request. better-auth's `/send-verification-email` accepts an arbitrary
    `email` in its body, so a thin pass-through would have been a mail-bombing
    primitive for anyone with a session. A test pins that the DB address wins.
  - `isEmailConfigured()` was added so the admin action answers `503` instead of
    claiming success when `RESEND_API_KEY` or `RESEND_FROM_EMAIL` is missing.
    The auth flows stay silent about delivery on purpose; an admin who clicked
    "send" does not need that silence.
- **L14** — Known limitation, deliberately not papered over: when the provider
  **rejects** a message (as `onboarding@resend.dev` does for any address but the
  account owner's), the admin action still reports success. better-auth awaits
  the send inside `runInBackgroundOrAwait` and discards the result, and the
  failure policy that makes reset safe — never throw — is the same one that
  hides this. With a verified domain the distinction stops mattering. The
  server log carries the truth today.
- **L15** — T4 end-to-end evidence, same running build and seed-state database:
  - `/verify-email` renders the success state; `/verify-email?error=INVALID_TOKEN`
    renders the failure state. Both `200` without a session.
  - `POST /api/users/<id>/verify-email` as admin → `200
{"success":true,...}`, and the server logged a real Resend attempt. Without
    a session → `401`.
  - A real verification JWT, minted with `createEmailVerificationToken` and the
    app secret, hit `/api/auth/verify-email?token=…&callbackURL=…` → `302` to
    `/verify-email` with no error, and `User.emailVerified` flipped to `true` in
    the database. Replaying the same token is a no-op rather than an error: the
    token is a stateless JWT, and re-verifying only re-sets a boolean.
  - `/admin/users` shows the new column: "Sin verificar" plus the send button
    for an unverified user, and no button once verified.
  - Cleanup: `emailVerified` back to `false`, sessions and verification rows
    deleted, `admin1234` still logs in.
- **L16** — Verification totals after T4: `tsc` clean; `test` 18 files / 114
  tests; `build` clean with `/verify-email` and `/api/users/[id]/verify-email`
  in the route list; `prettier --check` clean; `lint` still 30 (6 errors, 24
  warnings).
