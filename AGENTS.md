<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## White-label architecture (single tenant, resold)

This is one deployment per dealership, sold to several. There is **no `tenantId`**: the
client is configuration that ships with the code.

- **Client identity lives only in `src/site/<client>/`** — name, phone, address, domain,
  social handle, brand colours, and the copy of the public pages.
- The product imports `@/site/active`. Never import a client folder directly, and never read
  `process.env` for brand data: the overrides are resolved once, in `src/site/compose.ts`.
- Brand tokens come from `src/site/<client>/theme.css`, loaded through the stable path
  `src/site/theme.css`. The neutral ramp stays in `src/app/globals.css`.
- `src/site/__tests__/brand-leak.test.ts` fails when a client marker appears outside
  `src/site/`. Do not weaken it to land a change; fix the code.
- A missing or unknown site **must fail the build**. Falling back to a default client means
  showing one dealership's name, phone and address on another dealership's site.

## Database in the MVP phase

The schema is applied with `pnpm db:push`. `prisma/migrations` exists but was never applied to the
development database, so `prisma migrate deploy` and `prisma migrate dev` both fail on objects that are
already there. Ignore the "run prisma migrate deploy" hint that `prisma migrate status` prints: it
assumes the migration history is the source of truth, and here it is not. Before the project leaves the
MVP phase, baseline the folder with `prisma migrate resolve --applied` for each migration.
