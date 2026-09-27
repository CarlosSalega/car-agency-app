# Remove `any` from the auth and data-access boundaries

## Objective

Eliminate the 3 `no-explicit-any` errors that sit on this project's security
and data-access boundaries, replacing them with types that are derived from the
real source of truth so they cannot drift.

## Why these three and not the others

Ten `no-explicit-any` errors remain repo-wide. These three are first because
they are the ones where a wrong type is a wrong _permission_ or a wrong _retry_,
not a wrong autocomplete hint:

- `src/lib/auth/auth-middleware.ts:47` and `:69` — the `user` parameter handed
  to every authenticated route handler is `any`. A handler can read any property
  off it, and `user.role !== "ADMIN"` in `requireAdmin` is the only thing
  standing between a `USER` and the admin routes. With `user: any`, a handler
  that reads `user.role` gets no compiler help whatsoever if the model changes.
- `src/lib/prisma-safe.ts:21` — `catch (error: any)` in the function that decides
  whether a database failure is retryable. `error?.message` on an `any` means the
  retry classifier silently keeps working even if what Prisma throws changes
  shape, which is exactly the failure mode that turns a blip into an outage.

The other 7 `any` are in forms, config tables, and a cache-key helper: real debt,
but a wrong type there is a bug in a dropdown, not a privilege escalation.

## The fixes

### `auth-middleware.ts`

The type must be derived, not hand-written. `getSession()` returns
`Prisma.Session & { user: User }`, so the user is the generated `User` model.
Write it as a derived alias so a Prisma schema change propagates automatically:

```ts
export type AuthenticatedUser = NonNullable<
  Awaited<ReturnType<typeof getSession>>
>["user"];
```

Then `withAuth` and `withAdmin` take
`(request: NextRequest, user: AuthenticatedUser)`.

Do NOT import the `User` type by hand from the generated client. A hand-written
duplicate is exactly how these two drift apart next time the schema changes.

### `prisma-safe.ts`

`catch (error: unknown)` plus a narrowing helper:

```ts
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "";
}
```

`error instanceof Prisma.PrismaClientInitializationError` still narrows fine
from `unknown` — that is the whole point of `unknown` over `any`.

## Behavior that must NOT change

- `AuthError` still maps to its own `statusCode`; anything else still 500.
- `requireAuth` / `requireAdmin` still throw and still return the same object.
- The retry classifier in `prismaSafe` still treats exactly three things as a
  connection error: `PrismaClientInitializationError`, a message containing
  `"Can't reach database server"`, and a message containing
  `"Connection terminated"`.
- `retries === 0` still rethrows.
- The `log` default still depends on `NODE_ENV`.

## Scope

Authorized:

- `src/lib/auth/auth-middleware.ts` — the two `user: any` parameters, plus the
  derived `AuthenticatedUser` export.
- `src/lib/prisma-safe.ts` — the `catch (error: any)` and its message extraction.

Not authorized:

- Changing runtime behavior, error messages, status codes, or retry semantics.
- The 7 remaining `no-explicit-any` errors in `src/`.
- The unused `request` parameter warning at `auth-middleware.ts:15` and `:33`
  (`requireAuth`/`requireAdmin` accept a `request` they never use). Out of scope;
  it is a separate API-shape question, not a typing one.
- Adding an eslint-disable anywhere.

## Acceptance criteria

1. `pnpm exec eslint src/lib/auth/auth-middleware.ts src/lib/prisma-safe.ts`
   reports **0 errors**.
2. Repo-wide error count drops from **10 to 7**.
3. `pnpm exec tsc --noEmit` exits 0 — and critically, the derived
   `AuthenticatedUser` type must resolve, proving the derivation is correct rather
   than collapsed to `any` or `never`.
4. Every existing call site of `withAuth` / `withAdmin` still typechecks without
   modification. If a call site breaks, the derived type is wrong — fix the
   derivation, do not cast at the call site.
   **Outcome: vacuously true. There are ZERO call sites.** See "Bigger finding"
   below — this criterion could not have caught anything.
5. Prettier clean on both files.

## Checks

| Check | Command                | Result  |
| ----- | ---------------------- | ------- |
| T1    | Target files lint      | pending |
| T2    | Repo-wide count 10 → 7 | pending |
| T3    | Typecheck              | pending |
| T4    | Formatting             | pending |

## Route

Delegated writer. Two files on a security boundary, and understanding the
session/Prisma types is preparation for the write, so the read and the edit
happen in one bounded worker.

## Tasks

- [x] **T1 — Type the `user` parameter** in `withAuth` and `withAdmin` via a
      derived `AuthenticatedUser` alias.
- [x] **T2 — Narrow the `catch`** in `prismaSafe` to `unknown` with a helper.
      The first version used `instanceof Error`; the delegated writer flagged
      that this silently changes behavior, and the orchestrator replaced it with
      a duck-typed guard. See "Correction to this document".
- [x] **T3 — Verify** against the acceptance criteria, confirming no call site
      needed a cast.
- [x] **T4 — Commit** as a single work unit.

## Progress

Created before the first source edit, per the ODD protocol. The typing work was
delegated to one bounded writer, which surfaced two findings that changed the
outcome (below).

## Correction to this document

The original draft said `getSession()` returns `Prisma.Session & { user: User }`.
**That is wrong.** `session.ts:35` uses `prisma.session.findUnique({ include:
{ user: true } })`, so the return type is Prisma's inferred `SessionGetPayload`.
The prescribed alias is still correct — it derives the real payload type — but
the stated reason was wrong. Do not "fix" the alias to match that sentence.

## Bigger finding: this module has no callers

`withAuth`, `withAdmin`, `requireAuth` and `requireAdmin` have **zero call sites**
outside their own file. `src/lib/auth/index.ts` re-exports them, and nothing
imports them. Verified by the writer and independently re-verified by the
orchestrator with a repo-wide `rg`.

What actually guards `/admin` today is `requireAuthSession()` in
`session.ts:62`, used by `src/app/admin/page.tsx`, `config/page.tsx` and
`users/page.tsx`, plus the cookie check in `src/proxy.ts`.

Consequence: this task improved the type safety of code that is currently dead.
Worth doing — it is the shape the API should have — but it did **not** harden
any live authorization path. Do not read this commit as "the auth boundary is
now type-safe". The live boundary is `requireAuthSession` + `proxy.ts`, and that
is where a real authorization review should start.

Whether to delete this module or wire it up is a separate decision for the user.
Not decided here.

## Next step

Committed. Remaining in the debt queue: 7 `no-explicit-any` in
`src/components/` and `src/app/api/`, then the 2 `exhaustive-deps` and 7
`no-img-element` warnings.
