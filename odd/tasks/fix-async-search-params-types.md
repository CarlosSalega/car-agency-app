# Fix async `searchParams` types in admin pages

## Objective

Make `pnpm exec tsc --noEmit` pass after a build by typing `searchParams` as a
`Promise` in the two admin pages that declare it as a plain object.

## Problem

Next.js 15 generates `.next/types/**` route contracts in which `PageProps`
requires `searchParams: Promise<any>`. Two pages declare it as a plain object,
so their props type does not satisfy the generated constraint:

- `src/app/admin/cars/page.tsx` — `searchParams: { page?: string }`
- `src/app/admin/config/page.tsx` — `searchParams: { tab?: string; page?: string }`

Both pages already `await searchParams`, so runtime behavior is correct.
`await` on a non-Promise resolves to the value itself, which is why the app
never broke and the mismatch stayed invisible.

## Why it stayed hidden

`tsconfig.json` includes `.next/types/**/*.ts`, and those files only exist after
`next build`. A typecheck run before any build sees strictly less than one run
after a build. This mismatch dates to `bdd24d1` (initial app commit).

Dynamic route `params` in `src/app/autos/[slug]/page.tsx` and
`src/app/admin/cars/[id]/edit/page.tsx` are already awaited and correctly
typed. They are out of scope.

## Scope

In scope: the two `searchParams` type annotations.

Out of scope: the pre-existing 11 ESLint errors and 24 warnings repo-wide, and
publishing the 12 staged vehicles.

## Tasks

- [x] T1 — Wrap both `searchParams` annotations in `Promise<...>`.
- [x] T2 — Verify in the order build → typecheck → test, so the generated
      route types exist before the typecheck reads them.

## Authorized scope

Edit the two page files only. No database, Cloudinary, dependency, or config
changes.

## Acceptance criteria

- `pnpm build` exits 0.
- `pnpm exec tsc --noEmit` exits 0 **with `.next/types` present**.
- `pnpm test` passes.
- Prettier clean on touched files.

## Applicable checks

```
pnpm build
pnpm exec tsc --noEmit
pnpm test
pnpm exec prettier --check src/app/admin/cars/page.tsx src/app/admin/config/page.tsx
```

## Route and trigger evidence

Both edits are mechanical and already understood, with no unresolved design
decision, so they stay inline per the direct-inline rule. The mapping and
verification work (locating the pages, isolating generated-type errors from
source errors, confirming `params` was unaffected) was done inline too: it
needed only a handful of targeted reads and greps, under the 4-file mapping
threshold.

## TDD mode

Not enabled for this project; no TDD instruction was active in this session.
Ordinary functional checks are used instead of RED/GREEN cycles.

## Progress

- T1, T2 complete. Verification below.

## Verification evidence

- `pnpm build`: exit 0.
- `pnpm exec tsc --noEmit` (after build, `.next/types` present): exit 0,
  down from 2 errors.
- `pnpm test`: 5 files, 36 tests pass.
- Prettier: clean on both files.

## Next step

Open a PR. Merging is the user's decision.
