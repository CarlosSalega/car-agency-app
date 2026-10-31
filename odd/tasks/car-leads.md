# Car leads: the commercial layer

Roadmap Phase 1 (`odd/tasks/dealer-product-roadmap.md`). Today every inquiry leaves
through a WhatsApp link and leaves no trace, so the dealership cannot know how many
came in, for which car, or whether they closed.

Conventions copied from the repo, not invented: route handlers under `src/app/api`
(no server actions exist), zod schemas in `src/lib/validations/`, Spanish user-facing
messages, `prisma.log.create` for the audit trail, `sendEmail` as the only outbound
mail path.

## Specs

S1. A visitor on `/autos/[slug]` can send an inquiry from the page, with name, phone
and an optional message, without leaving the site.
S2. The inquiry is stored with the car it refers to, and with that car's seller when
it has one.
S3. The generated lead holds a timestamp for the consent given at submit time.
S4. The dealership is notified by email. A mail failure must never lose the lead:
the row is written first, the notification is best effort.
S5. Staff manage leads in the panel with statuses new / contacted / negotiating /
won / lost, and every status change is written to `Log`.
S6. The public endpoint is unauthenticated and writes rows, so it is validated
server-side and abuse-limited: zod parsing, a honeypot field, a length cap and a
rate limit.
S7. Existing behaviour survives: the WhatsApp call to action keeps working, the auth
flows are untouched, and `db:seed` still resets a clean database.

## Tasks

T1.1 — `Lead` model, enum, indexes, relations, zod schema, resetDatabase coverage.
S1, S2, S3 | commit: 1
T1.2 — Public `POST /api/leads` + the form on the car page. S1, S6 | commit: 2
T1.3 — Notification email with a WhatsApp deep link. S4 | commit: 3
T1.4 — Leads section in the panel with statuses and audit. S5 | commit: 4
T1.5 — Attribution: utm/referrer into `source`. | commit: 5
T1.6 — Numbers on `/admin`. | commit: 6

## Log

L1 (user, verbatim): "procede", answering the offer to start the lead layer after
T0.1 and T0.3 landed on `feat/dealer-product`.

L2 (scope for this document): `odd/tasks/dealer-product-roadmap.md` Phase 1, tasks
T1.1 through T1.6.

L3 (convention check): there is no `"use server"` in the codebase, so the submit path
is a route handler like every other write in the app. No rate limiter survives the
earlier auth cleanup, so S6 needs one added rather than reused.

L4 (consequence of the guard test): `resetDatabase()` must also empty `lead`, and the
table list in the seed guard has to grow with it. The guard test compares the two, so
adding the model without touching both fails the suite. That is the test doing its
job, not an accident.

L5 (T1.1 landed, commit `041601a`): the model, the enum, the zod schema and its 16
tests are in. `pnpm db:push` reported the database in sync with no data-loss warning.
The relation was first added to `Brand` by a too-broad replace and `prisma validate`
caught it with P1012; the lesson is that `cars Car[]` exists in more than one model.

L6 (zod 4): `z.literal(true, { errorMap })` is silently ignored in zod 4.3.6, so the
consent message fell back to "Invalid input: expected true". `{ message }` is the
supported form. A test caught it because it asserts the user-facing copy, not just
`success === false`.

L7 (T1.2 code): the limiter is a fixed window with an injectable clock (10 tests), the
route gates rate limit -> honeypot -> validation -> database in that order, and the
form is a client component because the codebase has no server actions. The honeypot
name moved to `lib/leads/honeypot.ts` so the client can import it without pulling zod
into the browser bundle.

L8 (verification mistake worth keeping): the first end-to-end run asserted against
`next start` without rebuilding first, so the new route answered 404 and the page had
no form. `next start` serves compiled output; a route that exists in source does not
exist until `next build` runs. Not a code defect, but it is exactly the kind of false
negative that gets read as one.

L9 (T1.3): the notification is a plain internal template built directly rather than
through `layout()`, because its body is mostly visitor-supplied text and needs
`escapeHtml` per field. The subject carries the car title only, with CR/LF stripped:
a visitor's name in a subject line is a header-injection primitive. The brand line
comes from `SITE_CONFIG.name` instead of adding another literal, since
`templates.ts` still has its own `BRAND = "Car Agency"` (T0.6 debt).

L10 (mail safety): `sendEmail` is documented never to throw, and `notifyNewLead` adds
a catch anyway, because the row is already written and losing a notification must not
turn a saved lead into a 500. Verified live with no recipient configured: POST answers
201, the row is intact with car, seller, consent, message and source, and the server
log records `guardada sin aviso: no_recipient`.

L11 (deliberately not done): no live email was sent. `RESEND_API_KEY` is set but the
sender is `onboarding@resend.dev`, which only delivers to the account owner, so a real
send would have hit a real inbox for a test. The template and the failure paths are
covered by 11 unit tests instead, and the operator-facing variable is documented in
`.env.example` as `LEAD_NOTIFICATION_EMAIL`.

L12 (tooling, twice): a `pkill -f "next start -p ..."` also matched the parent shell
and killed it before the database check ran; a PID in a variable is the fix. And
`prettier --write ... .env.example` fails with no parser, which in an `&&` chain makes
`tsc` never run while the following `echo $?` reports prettier's code. Both produced
false readings that had to be re-checked.

L13 (T1.4, delegated): the panel section was handed to a worker with narrow allowed
edit surfaces; I kept the commit and the verification. It delivered 10 files and 9
tests (179 -> 188). What I checked instead of trusting the report: the diff touches
nothing outside the surfaces, `status-badges.tsx` only renames the interface with an
alias so no existing badge body changed, no hardcoded colour or `dark:` utility in the
new files, and prettier was not run by the worker (the pre-commit hook caught one file,
which means the hook is doing its job).

L14 (T1.4 verified live, which the worker could not do because it was forbidden from
touching the database): admin sign-in 200, `/admin/leads` 200 with the nav entry and an
empty state, a visitor POST creating a row, the panel listing it, `PATCH` returning
`CONTACTED` with the note trimmed from `"  se llamó  "` to `"se llamó"`, invalid status
400, unknown id 404, no session 401, and exactly one `Log` row (`UPDATE`/`Lead`) in the
database. Test rows and their log rows were deleted; 0 leads remain.

L15 (deferred by the worker, and correctly so): car/seller/date filters and a separate
detail route were not built. The roadmap line named them, the delegated deliverable
scoped the status filter plus a dialog. They stay as optional refinements; the list is
already filterable by URL.

L16 (review load, needs a delivery decision): the branch is at ~2879 authored lines
across 9 commits, far past a single reviewable slice. The natural split is three PRs:
T0.1+T0.3 hygiene, the lead layer (model, endpoint, form, notification), and the panel
section. Chained rather than one big merge.

L17 (T1.5, deviation from the plan): the roadmap said "utm/referrer into `source`". It
became four columns — `utmSource`, `utmMedium`, `utmCampaign`, `referrer` — because
T1.6 groups leads by channel, and parsing a packed string in every query is the debt
that compounds. `source` stays as it was: the page on our own site that produced the
inquiry, from the POST referer.

L18 (why the browser has to send it): UTMs live on the page the visitor browsed, not
on the URL the form posts to, and the POST's `referer` header is our own car page.
The external source is `document.referrer`, which only the browser knows.

L19 (where it mounts, and where it cannot): `MetaPixelProvider` was the natural
neighbour but it is mounted only when `NEXT_PUBLIC_META_PIXEL_ID` is set, so
attribution would silently stop working on a deployment without a pixel.
`AttributionCapture` is a null-rendering client component mounted unconditionally in
the root layout. First touch wins, so a later landing with no campaign cannot erase
the one that brought the visitor.

L20 (verification, with one harness correction): live POST with attribution stored
`instagram/cpc/hilux-octubre` plus the referrer, a POST without it stored NULLs and
still answered 201, and a 130-character utm answered 400. My first attempt to prove
the panel _shows_ the channel grepped the server-rendered HTML and "passed" for the
wrong reason: the match was in serialized React props, and the dialog only renders on
open. Replaced with a kept render test that opens the dialog and asserts the channel
line, the referrer and the landing page. The capture component's mount is proven by
its presence in a client chunk, not by the HTML.

L21 (deleted, not kept): an `eslint-disable no-control-regex` that no rule required.
A stale suppression hides the next real finding from the same rule.
