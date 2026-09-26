# Add Prettier ignore rules and a Husky pre-commit hook

## Objective

Give the repository a declared, auditable formatting contract: an explicit
Prettier rule set, a `.prettierignore` that stops Prettier from touching files
it must not format, a one-time normalization commit, and a Husky pre-commit hook
that enforces the contract on staged files only.

## Problem

`.prettierrc` declares a plugin and **not a single rule**. Formatting therefore
runs on undocumented Prettier defaults, which can change under any upgrade.

There is no `.prettierignore`, so Prettier resolves the whole working tree. It
reports `No parser could be inferred` for `.gitignore`, `schema.prisma`,
`migration.sql`, `.webp` and `.png` files, and it would rewrite
`pnpm-lock.yaml` — a lock file is generated input and must never be reformatted.

No formatting has ever been enforced. 31 tracked files fail the current check
(15 in `src/`, 13 in `odd/` and docs, 3 configs). Earlier sessions ran
`prettier --write` only on files they happened to touch, so the repository has
never been formatted as a whole.

## Why this order

The hook checks staged files, so installing it before normalizing would not
block commits outright. It would, however, surprise the first person who edits
one of the 15 unformatted `src/` files: the hook would demand a whole-file
reformat inside an unrelated feature commit, mixing formatting noise into
logic. Normalizing first means the hook is never a surprise.

## Decisions

- Rule set: Prettier defaults written **explicitly** (`printWidth` 80, `semi`,
  `doubleQuote`, `trailingComma`, `tabWidth` 2, `endOfLine` lf). The codebase
  already follows them, so churn is near zero, but the contract is now declared
  and auditable instead of implicit.
- Normalize the whole repository, in a commit separate from the tooling change
  so the formatting diff never hides a tooling diff.
- No import-sorting plugin. It would reorder imports across many files and add a
  dependency for no gain the team has asked for.

## Scope

In scope: `.prettierrc`, `.prettierignore`, `package.json`, `.husky/`, and a
one-time reformat of already-tracked files.

Out of scope: the 11 pre-existing ESLint errors and 24 warnings, publishing the
12 staged vehicles, and any change to application behavior.

## Tasks

- [x] T1 — Write `.prettierignore` covering build output, dependencies, the lock
      file, generated files, Prisma SQL/schema, binary assets, and local agent
      directories.
- [x] T2 — Write the explicit rule set into `.prettierrc`.
- [x] T3 — Normalize the repository in its own commit.
- [x] T4 — Install `husky` and `lint-staged`, add the `prepare` script, and add a
      `pre-commit` hook that runs Prettier on staged files only.

## Authorized scope

Tooling and formatting only. No application logic, no dependencies beyond
`husky` and `lint-staged`, no database, no Cloudinary.

## Acceptance criteria

- `prettier --check .` on the repository exits 0 with no parser errors.
- `pnpm-lock.yaml` is byte-identical after the normalization commit.
- `pre-commit` runs Prettier on staged files and blocks a badly formatted one.
- A clean commit of already-formatted files passes the hook.
- `pnpm exec tsc --noEmit` still exits 0, after a build.
- `pnpm test` still passes.

## Applicable checks

```
pnpm build
pnpm exec tsc --noEmit
pnpm test
pnpm exec prettier --check .
git diff --stat -- pnpm-lock.yaml   # must be empty
```

## Route and trigger evidence

Direct inline. The changes are four small, fully-understood config files plus a
mechanical reformat, with no unresolved design decision, so they do not meet the
writer trigger for delegation. The exploration that prepared the work — locating
the current config, quantifying the blast radius, isolating the lock file, and
identifying which paths have no parser — was targeted enough to stay inline,
under the 4-file mapping threshold.

## TDD mode

Not enabled for this project; no TDD instruction was active in this session.
Ordinary functional checks are used instead of RED/GREEN cycles. This task is
tooling configuration with no runtime behavior, so behavior-first tests would
not add signal.

## Progress

T1 through T4 complete. Verification below.

## Verification evidence

- `pnpm exec prettier --check .`: exit 0, no parser errors, 0 unformatted files.
- `pnpm-lock.yaml` unchanged by the normalization commit (`git diff --stat`
  empty for that path).
- `pnpm build`: exit 0.
- `pnpm exec tsc --noEmit` after build: exit 0.
- `pnpm test`: 5 files, 36 tests pass.
- Hook behavior tested by staging a deliberately misformatted file and
  confirming the commit is refused, then restoring it.

## Next step

Open a PR. Merging is the user's decision.
