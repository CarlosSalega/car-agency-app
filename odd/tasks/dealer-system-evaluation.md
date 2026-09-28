# Dealer system evaluation — CMS / CRM / ERP for an Argentine car dealership

Supersedes `crm-erp-discovery.md` (kept for history). That document is a generic
CRM phase list. It is directionally reasonable, it is two bullets out of date, and
it contains **zero** references to the regulatory and commercial reality of an
Argentine car dealership. This document does the same job with the local specifics
and a different ordering, plus a verified map of what the codebase actually has.

Verified against the repository on 2026-09-28. Every claim about the code carries a
`file:line`; claims about the Argentine market are stated as domain facts and
flagged where they need confirmation with an accountant or a dealer.

---

## 1. The headline

**This is a catalogue CMS with user management. It has no concept of a customer, a
transaction, an obligation, or a unit of work.**

The audit is exhaustive on absences, not on impressions: `rg -i` sweeps over `src/`
and `prisma/schema.prisma` for `lead`, `contact`, `appointment`, `reservation`,
`sale`, `installment`, `commission`, `expense`, `task`, `activity`, `warranty` all
return zero real hits. `PaymentMethod.PERMUTA` (`schema.prisma:55`) is a checkbox
with no trade-in entity. `CarStatus.BY_APPOINTMENT` and `RESERVED` are bare enum
values with no date, attendee, or expiry behind them. There is no form anywhere in
the public tree: `rg -n "onSubmit|<form|useForm|action=" src/app` excluding
`admin/` and `api/` returns empty.

And the commercially decisive gap is not the missing CRM. It is this:

> **`Car.price` is the only monetary field in the entire database**
> (`schema.prisma:179`), it is an `Int` validated as an integer
> (`src/lib/validations/car.ts:32-35`), and there is **no cost field of any kind**.

A dealer cannot answer "¿cuánto ganamos con este auto?" because the system does not
store what the auto cost. That is fixable in one migration and it is worth more than
the first three phases of any CRM.

---

## 2. Two corrections to the previous document

Both were checked, both are stale.

- **"Admin for ... settings ..."** — there is no settings UI. `/admin/config` renders
  exactly four tabs: brands, models, sellers, linktree
  (`src/components/config-tabs.tsx:69-80`). The `Settings` model is only reachable by
  calling `/api/settings` by hand, and nothing in the codebase does.
- **"`recentLogs` is queried in the admin stats query but not rendered"** — refuted.
  It was **deliberately removed** in commit `057fc6f`, and a regression test now locks
  it out: `src/lib/queries/__tests__/cars.test.ts:343,349` assert that
  `logMocks.findMany` was never called and that `recentLogs` is absent from the
  returned keys.

Also resolved since that document was written: `GET /api/cars/[id]` policy is now
settled as authenticated-only, with ownership checks on `PUT`/`DELETE` only
(`src/app/api/cars/[id]/route.ts:14-17,79,154-157`).

---

## 3. What is already there, and the traps in it

| Asset                                                              | Location                            | Trap                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------ | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Car.soldAt DateTime?`                                             | `schema.prisma:186`                 | **Never written.** `rg -n "soldAt" src` → 0 hits. Setting `status: "SOLD"` (`api/cars/[id]/route.ts:216`) does not set it. The sale-date column already exists and is free.                                                                                       |
| `Car.patent String? @unique`                                       | `schema.prisma:184`                 | Allocated, `@unique`, **never read, never written**, and absent from both the Zod schema (`lib/validations/car.ts:19-58`) and the form. `patent` is the vehicle's registry identity — the most dealer-specific field possible, sitting unused.                    |
| `Car.showBadge Boolean`                                            | `schema.prisma:177`                 | Zero references. Merchandising flag.                                                                                                                                                                                                                              |
| `Log` table                                                        | `schema.prisma:199-238`             | 22 consistent write sites, `entityId` populated — but **`metadata` never written** and **no index at all**. A price edit and a description edit produce identical rows. It is one index and one diff payload away from being a real timeline.                     |
| `LinkTreeLink`                                                     | `schema.prisma:219-231`             | The **only genuine content model**: category, label, href, iconKey, sortOrder, isActive, with an index and a working admin tab. This is the proven template for FAQ, financing terms, banners.                                                                    |
| `Settings` + full CRUD API                                         | `schema.prisma:233-240`             | Fully authorized, fully logged, **zero UI, zero consumers**. The cheapest CMS surface in the codebase.                                                                                                                                                            |
| `withAuth` / `withAdmin` / `requireAdmin`                          | `lib/auth/auth-middleware.ts:19-98` | ~100 lines, typed, **zero call sites**. Every route reimplements the check inline. The danger is not the dead code: the next developer will reach for `withAdmin` believing it is the house pattern.                                                              |
| `Account`, `VerificationToken`, `User.emailVerified`, `User.image` | `schema.prisma:83-99,109-115,67-68` | NextAuth leftovers. Auth is hand-rolled cookie→DB (`lib/auth/session.ts`).                                                                                                                                                                                        |
| `Visit`                                                            | `schema.prisma:210-217`             | An entity, not a counter, and it fires on every detail view — but `ip` and `userAgent` are **never populated** and it has **no index**, while `getAdminCarStats` runs a full-table `count()` on every dashboard load. You cannot separate a human from a crawler. |
| `PaymentMethod` enum                                               | `schema.prisma:50-56`               | `BNA_MAS`, `CREDITO_PRENDARIO`, `TARJETA_CREDITO`, `PERMUTA` are **marketing attributes on the car** — what the seller accepts, not what a buyer paid. They look like a financing model and are not.                                                              |

### The identity trap

`User` and `Seller` are **disconnected identity systems**.

- `User` has a login, a role, `isActive`.
- `Seller` has `firstName`, `lastName`, `phone`, `email` — **no `userId`, no login, no
  role**. Its only use in the entire codebase is reading `.phone` to build a WhatsApp
  deep link (`app/autos/[slug]/page.tsx:120-121`).

The decision already taken — a COLLABORATOR may assign any seller to any car — is the
right precursor to a future seller role. But it cannot be built on `Seller` as it
stands. **Do not overload `Car.userId` for sales assignment**: that relation is an
ownership and permission boundary today (`api/cars/[id]/route.ts:79,154-157` use it to
decide who may edit or delete a car). Conflating "who can delete this" with "who sold
this" breaks authorization.

The prerequisite is a single `Party`/`Contact` concept that a login and a seller
record can both hang off, with a role relation that is not the ownership relation.

---

## 4. What the market requires that a generic CRM does not know about

This is the section the previous document was missing entirely. Items marked
**[verify]** are domain statements that should be confirmed with an accountant and a
dealer before being designed against.

### 4.1 Invoicing is a legal obligation at the moment of sale, not "accounting"

Electronic invoicing is mandatory in Argentina. **[verify]** Since RG 4291/2021 and
RG 4954/2021, issuing electronic invoices (Factura A/B/C) through AFIP/ARCA web
services is the rule, with CAE authorisation and controlled numbering.

This breaks the previous document's ordering, which put the financial ERP last
("do not start with accounting"). That advice is right for _accounting_ and wrong for
_invoicing_: **a dealership cannot legally complete a sale without issuing a factura.**
Invoicing belongs in the sale phase, not the last one.

Implementation is a real cost, not a form field: certificate and private key,
service provider, numbering state, and a fallback if the ARCA web service is down when
a car is sold. Worth deciding early whether to integrate directly or use a billing
provider.

### 4.2 The 10.5% IVA retention on sales to other dealers

**[verify]** When a used vehicle is sold by a registered seller to another registered
car dealer, the seller must withhold a percentage of IVA and later remit it. A
dealer's own `Seller` record can represent another dealership, so this is reachable in
normal operation, not an edge case.

No generic CRM models a withholding. It needs a tax concept on the sale, a
conditional flag on the buyer, and a remittance record.

### 4.3 Documents, not just records

**[verify]** A used vehicle cannot legally be sold without title
(_transferencia de dominio_ at the Registro Nacional de Automotores), and the
transfer requires a specific set: invoice, buyer's DNI, title, insurance, and
verification of the domain. Insurance verification via the electronic policy
verification system became part of the transfer process.

So the `Sale` entity is inseparable from a **document checklist with an expiry per
item**. This is where a generic CRM stops and a dealership system begins.

### 4.4 Ushuaia / Tierra del Fuego

**[verify]** Under Ley 19.640 and Ley 23.775, cars and motorcycles in the province
are not subject to IVA or the relevant duties. A dealer with operations there has a
different tax calculation and a different price display, and the _origin_ of a unit
matters commercially. Regional _percepciones_ are a separate regime again.

If this dealership will not operate in TdF, record the decision and move on. If it
might, "where is this unit taxed" is a field that cannot be retrofitted cheaply once
sales exist.

### 4.5 Revaluation, not just depreciation

Used-vehicle economics in Argentina are driven by fast real depreciation plus inflation.
Dealers reason about **revaluation**: what the unit cost, what it is worth now, how
many days it has sat, and what it will be worth in 30 days. Index-linked references
(IPC, UVA) appear in the trade.

For a dealer, a per-unit view of _purchase price, reconditioning cost, current market
value, days in stock_ is the central number. The current dashboard is six counts with
no arithmetic (`lib/queries/cars.ts:213-244`) and cannot produce it.

### 4.6 Acquisition and the taller

Integral means the back office too: auction purchases (**remates**), imports, fleet
buy-outs, appraisal, inspection, reconditioning, parts, mechanic hours, warranty claims.
A used-car dealer that tracks leads but not acquisition cost and reconditioning is a
CRM, not an ERP.

### 4.7 Fleet sales

Corporate fleet purchase is a material revenue channel in Argentina and has a
different shape: multiple drivers, cost centres, expense policy, and invoicing to a
company with its own CUIT. It does not fit a single-buyer sale record.

### 4.8 Identity and invoicing of the buyer

**[verify]** The buyer is identified by DNI plus CUIT/CUIL for invoicing, which
constrains the customer entity from day one. Validate CUIT/CUIL check digits on entry
rather than storing free text.

---

## 5. Infrastructure that blocks the work, ranked by cost of discovering it late

These are not features. They are the things that make the next phases either possible
or ruinous, and several of them are cheap now and expensive later.

1. **There is no baseline migration.** Only two migrations exist, both trivial
   `ALTER TYPE ... ADD VALUE`. The schema was created with `prisma db push`
   (`package.json`). A fresh environment cannot be built from migrations, and there is
   no rollback path. **Fix before the first CRM migration**, not after. Cheapest and
   most urgent item in this document.

2. **No background jobs, no cron.** `vercel.json` has no `crons` array; there is no
   queue. A CRM's entire value proposition is time-based: follow up tomorrow, follow
   up in seven days, a reservation expiring, a stale lead going cold. None of that can
   be built on the current infrastructure. This is a platform prerequisite.

3. **The in-memory rate limiter does not work in production.** `lib/rate-limit.ts` uses
   an in-memory `Map` keyed on `x-forwarded-for` (5 attempts / 15 min), and its cleanup
   `setInterval` cannot survive a serverless cold start. On a serverless fleet the real
   limit is far weaker than it reads. Meanwhile no other endpoint is limited at all.

4. **`cleanupExpiredSessions()` is written and never called**
   (`lib/auth/auth.ts:45-53`). Its own doc comment presumes a cron that does not exist.
   Sessions accumulate forever.

5. **`next build` does not typecheck.** `typescript.ignoreBuildErrors: true`
   (`next.config.mjs:75-77`), and `tsc --noEmit` is not wired into any npm script. A
   project about to grow several times in surface area cannot ship with the compiler
   muted.

6. **No tests for any API route, auth check, or Zod schema.** Every data-layer test
   mocks Prisma entirely. The security guards fixed this week — including the
   `hashedPassword` disclosures in both repositories — were verified by reading the
   diff, not by executing anything. For a system that will handle invoices, personal
   documents and money, that is the wrong place to stand.

7. **No file or document storage.** Cloudinary only, and `ImageService.getProvider()`
   throws for any non-Cloudinary value (`lib/images/image-service.ts:11`), so the S3
   branch in `api/images/[...path]/route.ts:33-36` is unreachable. Upload accepts
   `image/*` up to 15MB. Storing a scanned title or a factura PDF needs a new storage
   layer and an asset model.

8. **Audit logging is manual and one operation escapes it.** 22 hand-written
   `prisma.log.create` calls; a new mutation that forgets is silently unaudited.
   `/api/upload` in both verbs writes no `Log` at all despite being destructive.

9. **No migration for `money`.** `price Int` with no `Decimal` anywhere in the schema,
   and a `Currency { ARS, USD }` enum with no exchange rate table, so a fleet priced in
   both currencies cannot be totalled.

---

## 6. Recommended ordering, and where it differs

The previous document's sequence (leads → pipeline → appointments → reservations →
sale → acquisition → finance) is a reasonable generic order. Two changes.

**First: platform before product.** Phases 0 and 1 below are not features, and doing
CRM work without them means doing it twice.

**Second: unit economics before leads.** A dealership's day is about cars, not about
leads. The single most valuable thing this system can learn is the margin of each unit
and the age of the stock. A CRM on top of a system that does not know what a car cost
is a CRM reporting on nothing.

### Phase 0 — Platform (blocking; nothing commercial should start before this)

- Baseline migration: capture the current schema as a migration so environments are
  reproducible and rollbacks exist.
- Remove `ignoreBuildErrors`, wire `tsc --noEmit` into the verify script.
- Consolidate authorization: either adopt `withAdmin`/`withAuth` across all 18 routes,
  or delete the module. Do not leave a typed, plausible, unused gate next to 22 inline
  copies.
- Introduce a schedulable job mechanism (Vercel Cron plus a task table) and call
  `cleanupExpiredSessions` from it.
- Replace the in-memory rate limiter with something durable; extend it beyond login.
- `price` → `Decimal`, add `cost` and `reconditioningCost`, add a currency rate table.
- Add tests for the authorization decision of every route that will touch money or
  personal data.

### Phase 1 — Unit economics (the heart of a dealership)

- Write `Car.soldAt` when status becomes `SOLD` (the column already exists).
- `Car.cost`, `Car.reconditioningCost`, `Car.soldPrice`.
- Days in stock, derived from a new `receivedAt` (today `createdAt` is the row insert
  time, which is not the same thing).
- Per-unit margin, and the reports that actually drive a dealership: units over N days,
  margin realised this month, stock ageing by model.
- Give `Log` an index and a real `metadata` diff, then add the first read path.

### Phase 2 — Leads and contact (the CRM proper)

The business case is blunt: **100% of today's contact attempts leave through WhatsApp
and none of them are recorded.** `/ventas` even pre-fills a WhatsApp message listing
the fields the agency wants (`app/ventas/page.tsx:20-39`) and then receives it as free
text. There is no form, no capture, no funnel.

- Structured inquiry form on `/autos/[slug]` and `/ventas`, persisting
  `Contact`/`Party` + `Lead` with source, vehicle interest, intent, and
  financing/trade-in interest.
- Unify `User` and `Seller` under a `Party` concept with a role relation, and add a
  **sales assignment** that is explicitly not `Car.userId`.
- Lead stages, assignment, next-action dates, and an activity timeline — all of which
  need the Phase 0 job mechanism to be worth anything.
- Lead inbox, lead detail, pipeline board, today's follow-ups, seller workload.

### Phase 3 — Sale, documents and the legal obligation

- `Sale` entity: car, buyer, price, payment method, deposit, balance, financing.
- **AFIP/ARCA electronic invoicing** — see 4.1. This is where it belongs.
- Transfer document checklist with per-item dates: factura, DNI, title, insurance,
  domain verification.
- The 10.5% retention path for sales to a registered dealer (4.2).
- Financing fields: anticipo, financiadora, cuotas, plazo. The existing
  `PaymentMethod` enum is the seed of this, not the implementation.

### Phase 4 — Acquisition, reconditioning and after-sales

- Appraisal and intake for "sell your car", reusing the same `Party` the CRM uses.
- Purchase cost, inspection, reconditioning, ready-for-sale date.
- Taller: service orders, parts, labour, warranty claims.

### Phase 5 — Financial ERP

Receivables and payables, commissions with a compensation plan per seller, expenses,
supplier and repair costs, margin and reconciliation, expressed in constant currency
(4.5). Only after the operational flows above are stable and being used daily.

---

## 7. The screens that follow from this

Replacing the current seven-item navigation:

```
Inicio          Carros         (dashboard: ageing, margin, stale leads, today)
Autos           stock, unit economics, internal workspace per car
Leads           inbox, detail, pipeline, assignment, follow-ups
Citas           appointment scheduling
Ventas          sales, documents, invoicing
Financiación    financiers, plans, approvals
Toma de autos   acquisition and appraisal
Usuarios        people, roles
Configuración   brands, models, sellers, settings, content
```

The internal car workspace is the screen that ties the phases together and it does not
exist yet — today `/admin/cars/[id]` only has `edit`
(`app/admin/cars/[id]/edit/page.tsx`). Proposed tabs: Overview, Commercial, Photos,
Leads, Activities, Appointments, Reservation, Documents, History.

---

## 8. Open questions that need a human decision

These are product or accountant questions. The code cannot answer them and guessing
will be expensive.

1. **Concesionaria, agencia, or agent?** The regulatory and tax obligations differ, and
   it changes whether AFIP integration is in scope for phase 3.
2. **Is TdF / Ushuaia ever in scope?** Changes the tax model and the unit's origin field.
3. **Where is the acquisition data today?** If costs live in a spreadsheet, phase 1
   needs an import, not just a column.
4. **Is the `Settings` table for dealer configuration, or for app configuration?**
   Cheap either way, but the key namespace should be designed before data lands in it.
5. **Seller compensation: flat, percentage, or tiered?** Determines whether `Seller`
   can ever be a login or must stay a party record with a separate commission table.
6. **Is a warranty/taller operation actually in scope?** It is a separate ERP module
   and it roughly doubles phase 4.

---

## 9. What I would not do

- **Do not start with accounting.** Agreed with the previous document, with the
  invoicing caveat in 4.1.
- **Do not build a generic CRM first.** The registry already has a differentiated CRM
  for dealers. The defensible ground here is the part a generic product does poorly:
  Argentine tax and transfer compliance, per-unit economics, and the acquisition and
  reconditioning back office. A lead pipeline is the _easiest_ thing to build and the
  least defensible.
- **Do not overload `Car.userId`.** It is the permission boundary. See 3.
- **Do not add entities before the baseline migration exists.**
