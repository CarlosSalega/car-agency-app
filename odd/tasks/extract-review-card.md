# Extract ReviewCard to fix the rules-of-hooks violation

## Objective

Remove the `react-hooks/rules-of-hooks` error in
`src/app/(landing)/components/Reviews.tsx` by extracting the per-review markup
into its own component, so each review's scroll-animation hook is a legitimate
hook instance instead of a hook created inside a `map` callback.

## The bug

At line 186, inside the render:

```tsx
{
  REVIEWS.map((review, i) => {
    const { ref, isVisible } = useScrollAnimation<HTMLDivElement>({
      rootMargin: "0px 0px -80px 0px",
    });
    return <article ref={ref}>…</article>;
  });
}
```

A hook is called from inside a callback. React's rule of hooks requires hooks to
be called unconditionally from a component or a custom hook, in the same order
on every render. Here React ends up creating one hook instance **per array
element, per render**, in a loop.

It appears to work only because `REVIEWS` is a module constant with a fixed
length, so the call count never changes. That is an accident, not a guarantee.
The moment the list becomes dynamic — paginated reviews, a filtered list, a CMS
feed — the hook count changes between renders and the component breaks with
corrupted hook state.

`eslint` reports it as an error:

```
ERROR react-hooks/rules-of-hooks
  src/app/(landing)/components/Reviews.tsx:186:40
  React Hook "useScrollAnimation" cannot be called inside a callback.
```

## Why not silence the rule

The wrong fix is an eslint-disable comment, or hoisting the hook out of the map
and sharing one `ref`/`isVisible` across every review. The second one is worse
than the bug: all reviews would then share a single intersection observer state,
so the scroll animation would stop being per-item. The rule is correct; the code
must change.

## Scope

Authorized:

- `src/app/(landing)/components/Reviews.tsx` — extract the per-review `article`
  into a `ReviewCard` component in the same file, and render `<ReviewCard />` from
  the map.

Not authorized:

- Touching `useScrollAnimation` or any other shared hook.
- Visual or copy changes. The extracted component must render **exactly** the
  same markup and classes as today.
- The 2 repo-wide `react-hooks/exhaustive-deps` warnings. They are in other
  files, not this one. Logged as separate debt; out of scope here.
- The 10 `no-explicit-any` errors repo-wide. Separate work unit.

## Acceptance criteria

1. `pnpm exec eslint "src/app/(landing)/components/Reviews.tsx"` reports **zero**
   errors and no new problems.
2. Repo-wide error count drops from 11 to **10**.
3. The rendered markup, classes, and animation behavior of each review are
   unchanged.
4. Each review still gets its **own** `useScrollAnimation` instance — the fix
   must not share observer state between cards.
5. `pnpm exec tsc --noEmit` exits 0.
6. Prettier clean on the file.

## Checks

| Check | Command                       | Result  |
| ----- | ----------------------------- | ------- |
| T1    | Target file lint              | pending |
| T2    | Repo-wide error count 11 → 10 | pending |
| T3    | Typecheck                     | pending |
| T4    | Formatting                    | pending |

## Route

Delegated writer. Reading the component and the `useScrollAnimation` hook is
preparation for the write, so both happen in the same bounded worker.

## Tasks

- [x] **T1 — Extract `ReviewCard`.** Same file, same markup, own hook instance.
- [x] **T2 — Verify** against the acceptance criteria.
- [x] **T3 — Commit** as a single work unit.

## Progress

This document was created before the first source edit, per the ODD protocol.
The extraction itself was delegated to one bounded writer.

`key={review.name}` moved from the `<article>` onto the `<ReviewCard>` element
inside the map. That is the only correct position: React reads `key` from the
outermost element of an array child, and it was previously being ignored on the
inner `<article>`. Reconciliation behavior is unchanged.

## Correction to this document

An earlier draft of the scope section claimed this file had 2
`react-hooks/exhaustive-deps` warnings. **That was wrong.** The writer caught it:
the file has exactly one warning, `@next/next/no-img-element`, and there are
zero `exhaustive-deps` warnings in it before or after the change. The two
`exhaustive-deps` warnings are elsewhere in the repo. Scope corrected above.

## Known, deliberately untouched

`useScrollAnimation<HTMLDivElement>` types its ref as `HTMLDivElement` but the
ref is attached to an `<article>`, which is `HTMLElement`. TypeScript does not
complain because React ref props are bivariant. Preserved verbatim to keep this
a pure structural refactor. It is a real type inaccuracy to tighten separately.

## Next step

Committed. Next in the debt queue: the `no-explicit-any` errors in
`auth-middleware.ts` and `prisma-safe.ts` (auth and data-access boundaries).
