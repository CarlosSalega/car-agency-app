# Clean up the dead Next.js config keys

## Objective

Remove the two `next.config.mjs` keys that Next.js 16 reports as dead weight, and
leave behind a comment that explains why each removal is correct so the next
person does not "restore" it.

## Why

`pnpm dev` printed two warnings on every start. Both were accurate: both keys
were doing nothing at all. Keeping them is worse than useless because they look
like configuration that protects something.

### 1. `headers()` rule for `/_next/static/:path*`

```js
{
  source: "/_next/static/:path*",
  headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
}
```

`headers()` never applied to `/_next/static`. Next serves those files from a
static handler that bypasses the config headers pipeline. Measured with
`next start` and the old rule still in place: a hashed chunk came back as
`max-age=3600` — which is the `/:path*\.(css|js)` rule matching it, not this
one. Next.js 16 flags exactly this pattern.

The `immutable` cache is still _correct_ for content-hashed chunks. It just has
to come from the host or CDN, not from application config. That is a deployment
concern, not a code change, so it stays out of scope here.

### 2. `eslint: { ignoreDuringBuilds: true }`

Next.js 16 dropped the `eslint` config key and no longer lints during
`next build`. The option had no effect and only produced an "unrecognized key"
warning.

Removing it does not weaken anything: linting is enforced by `pnpm lint` and by
the Husky `pre-commit` hook (`pnpm exec lint-staged`).

## What was kept, and why it looks inconsistent

`typescript: { ignoreBuildErrors: true }` stays. Next.js 16 still honours that
key, and this project needs it: `next build` does **not** typecheck here, so
`pnpm exec tsc --noEmit` is a required separate step. Keeping it is a
deliberate decision, not an oversight, and the comment in the file says so.

## Scope

Authorized:

- `next.config.mjs` — remove the two dead keys, add explanatory comments.

Not authorized:

- Any change to the remaining `headers()` rules, `images.remotePatterns`, or
  `typescript.ignoreBuildErrors`.
- CDN/host cache configuration for `/_next/static`. Flagged, not done.
- Any push to the remote.

## Tasks

- [x] **T1 — Remove the `/_next/static` header rule.** Replaced with a comment
      recording the measurement, so the rule is not silently re-added.
- [x] **T2 — Remove the `eslint` key.** Replaced with a comment pointing at
      `pnpm lint` and the Husky hook as the real enforcement.
- [x] **T3 — Document why `typescript.ignoreBuildErrors` is kept.** Prevents the
      next reader from "cleaning up" the inconsistency.
- [x] **T4 — Verify.** `pnpm dev` boots with no config warnings, `pnpm exec tsc
--noEmit` exits 0, `next.config.mjs` is lint-clean and prettier-clean.
- [x] **T5 — Commit** as a single work unit.

## Checks

| Check                          | Command                                      | Result                                                                            |
| ------------------------------ | -------------------------------------------- | --------------------------------------------------------------------------------- |
| No config warnings on dev boot | `pnpm dev`                                   | pass — only `Running next.config.mjs took 35ms`; both prior warnings are gone     |
| Typecheck                      | `pnpm exec tsc --noEmit`                     | pass — exit 0, no output                                                          |
| Lint (changed file)            | `pnpm lint`                                  | pass — 0 problems reference `next.config.mjs`                                     |
| Lint (whole repo)              | `pnpm lint`                                  | **fail, pre-existing** — 132 problems (11 errors, 121 warnings), all under `src/` |
| Formatting                     | `pnpm exec prettier --check next.config.mjs` | pass                                                                              |

Note: `tsc --noEmit` must run **after** `next build`/dev has generated
`.next/types`, or unrelated route-type errors surface. Run the dev boot first.

The remaining `DeprecationWarning: module.register()` in the dev log comes from
Node inside Next's own dev server, not from this config. Out of scope.

The 132 lint problems are separate pre-existing debt. They were not fixed here
because they sit outside this task's authorized scope, and folding them in would
bury a two-key config cleanup inside an unrelated refactor.

## Route

Direct inline. One file, already understood, no unresolved design decision —
the previous session had already written the change and only the verification
and the commit were missing.

## Progress

- T1–T3: the edits were written in the previous session but left uncommitted
  when the machine shut down. This session adopted them, verified the file is
  internally consistent with `package.json` and the Husky hook, and did not
  rewrite them.
- T4, T5: this session.

## Next step

Committed as `fix(config): drop the two dead Next.js config keys`. Branch
`feat/admin-sidebar` is still unpushed; the remote push stays the user's call.
