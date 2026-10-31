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
