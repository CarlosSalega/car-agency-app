# Public Query Error UI

## Objective
Add friendly public error boundaries for catalog and car detail routes when server queries fail.

## Scope
- Add a shared client-rendered public error state.
- Add route-level `error.tsx` boundaries for `/autos` and `/autos/[slug]`.
- Keep the header, error content, and footer layout pattern consistent with the existing 404 page.
- Log the real error for diagnostics without exposing Prisma details to the user.
- Do not change query behavior, error retries, admin UI, or API routes.

## Checks
- Prettier and ESLint for new files.
- Vitest focused test for the shared error state if practical.
- `git diff --check`.
- Confirm route error boundaries are client components and expose `reset`.

## Route
Delegated direct writer because the change spans a shared UI component and two route boundaries.

## Progress
- [x] Added shared public error state with header, content, retry action, and footer.
- [x] Added `/autos` and `/autos/[slug]` error boundaries with server-error logging in the client boundary.
- [x] Kept database details out of user-facing copy.
- [x] Prettier, ESLint, focused Vitest, production build, Impeccable detector, and `git diff --check` passed.
- [x] No component test added because the shell depends on navigation/footer/intersection-observer behavior; focused query tests remain green.

## Commit evidence
No commit yet. Commit only when explicitly requested.
