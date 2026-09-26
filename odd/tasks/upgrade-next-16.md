# Upgrade Next.js 15 to 16

## Objective

Move the project from Next.js 15.5.25 to Next.js 16, using the official
codemods, and leave the repository building, typechecking and testing clean
afterwards.

## Problem

The project is pinned to Next 15.5.25 while Next 16 is current. Staying on 15
means missing the generated `PageProps` route-typed helper, which is the direct
cause of a class of bug this project already hit (see below).

## Why this is first

Of the three candidate migrations (Next 16, Prisma 7, Radix to Base UI), this
is the cheapest and the one with official codemods. It is also independent of
the other two, so it must not be bundled with them.

## Known surface in this repository

Verified by inspection, not assumed:

- `src/middleware.ts` exists and must become `proxy.ts`. **`proxy` runs on the
  Node.js runtime and does not support the edge runtime.** This middleware does
  cookie-presence checks for `/admin` and cache headers for images and public
  pages, so the runtime change is a real behavior change, not a rename.
- `params` and `searchParams` are already awaited in every page and layout, and
  the two `searchParams` annotations were corrected to `Promise<...>` in PR #2.
  The `next-async-request-api` codemod should therefore find little to do. Run
  it anyway to confirm rather than assume.
- Pages hand-write their props interfaces instead of using the generated
  `PageProps<'/route'>` helper. That hand-written interface is exactly what
  produced the PR #2 mismatch against `.next/types`. Adopting `PageProps` is in
  scope as the durable fix, not the annotation patch.
- Dev already runs `--turbopack`, and Turbopack is the default in 16.
- `tsconfig.json` includes `.next/types/**/*.ts`, so the typecheck only sees
  the generated route contracts after a build. **Verification order is build,
  then typecheck, then tests.**

## Scope

In scope: dependencies, `next.config.mjs`, `src/middleware.ts` to `proxy.ts`,
and adopting generated route types where it removes hand-written props.

Out of scope: Prisma 7, Radix to Base UI, the `dash` sidebar, and the 11
pre-existing ESLint errors.

## Tasks

- [x] T1 — Record the baseline: `build`, `tsc --noEmit`, `test` before any change.
- [x] T2 — Run the official `next-async-request-api` codemod and review its diff.
- [x] T3 — Upgrade `next`, `react`, `react-dom` and the React type packages.
- [x] T4 — Convert `middleware.ts` to `proxy.ts` and verify the admin cookie
      redirect and the image cache headers still behave.
- [x] T5 — Adopt `PageProps` for the admin and public routes that hand-write
      their props interfaces.
- [x] T6 — Verify in order: build, typecheck, tests, Prettier, ESLint.

## Authorized scope

Framework layer only. No schema or database change, no UI primitive change, no
dependency outside the Next and React type packages.

## Acceptance criteria

- `next` resolves to 16.x, `react` and `react-dom` to a version Next 16 accepts.
- No file named `middleware.ts` remains; `proxy.ts` exists and the admin
  redirect plus image cache headers still work.
- `pnpm build` exits 0.
- `pnpm exec tsc --noEmit` exits 0 **after** the build, with generated types present.
- `pnpm test` passes with no reduction in test count.
- `pnpm exec prettier --check .` exits 0.
- No new ESLint errors introduced.

## Applicable checks

```
pnpm build
pnpm exec tsc --noEmit
pnpm test
pnpm exec prettier --check .
pnpm exec eslint src
```

## Route and trigger evidence

Direct inline for the mechanical steps (dependency bump, file rename, codemod
review). One delegated exploration pass covered the middleware behavior, the
async-API surface and the hand-written props inventory, which needed more than
four files to establish and would have inflated this context.

## TDD mode

Not enabled for this project; no TDD instruction was active in this session.
Ordinary functional checks are used instead of RED/GREEN cycles. A framework
upgrade has no behavior-first test to write; the existing suite plus the build
is the real gate.

## Progress

T1 through T6 complete. Verification below.

## Verification evidence

- Baseline before any change: `build` exit 0, `tsc --noEmit` exit 0, `test` 5
  files / 36 tests.
- `next` 15.5.25 to 16.3.6, `react` and `react-dom` 19.2.4 to 19.2.8, type
  packages to match.
- `next-async-request-api` codemod reported no changes, confirming the async
  Request APIs were already fully adopted.
- `src/middleware.ts` renamed to `src/proxy.ts`; exported function renamed
  `middleware` to `proxy`. The `config.matcher` and all logic are unchanged, so
  the admin cookie redirect and the image cache headers behave identically. The
  file was already on the Node.js runtime, so the edge-to-Node change is a
  no-op here rather than a behavior change.
- `PageProps` adopted in `src/app/admin/cars/page.tsx` and
  `src/app/admin/config/page.tsx`, replacing the hand-written props interfaces
  that caused the PR #2 mismatch. The generated helper makes that class of bug
  unrepresentable.
- `pnpm build` exit 0, `pnpm exec tsc --noEmit` after build exit 0, `pnpm test`
  5 files / 36 tests pass, `prettier --check .` exit 0, ESLint unchanged at 35
  problems (11 errors, 24 warnings) all pre-existing.

## Next step

Open a PR. Merging is the user's decision. Prisma 7 and the `dash` sidebar
follow as separate changes.
