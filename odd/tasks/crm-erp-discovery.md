# CRM / ERP Discovery — Car Agency App

## Objective
Explore how the existing public catalog and private admin can evolve into a dealership CRM and later ERP.

## Current foundation
- Public catalog, filters, vehicle detail pages, Cloudinary galleries, WhatsApp flows, visits, and SEO.
- Private admin for cars, brands, models, sellers, users, settings, and contact/social links.
- Vehicle lifecycle: AVAILABLE, BY_APPOINTMENT, RESERVED, SOLD, INACTIVE.
- Admin roles: ADMIN and COLLABORATOR.
- Existing Seller is a basic contact record, not a sales representative pipeline.
- Existing Log is audit history, not a CRM activity timeline.

## Recommended direction
Build a lightweight dealer CRM first, then inventory workflows, then financial ERP.

```text
Public vehicle inquiry
→ persisted lead
→ seller assignment
→ follow-up task
→ appointment
→ reservation
→ sale transaction
→ later financial/accounting workflows
```

## Phase 1 — Leads and structured inquiry capture
Add public inquiry forms to vehicle detail and sell-your-car pages. Persist contact details, inquiry type, vehicle interest, message, financing/trade-in interest, source, assignment, stage, and notes. Keep WhatsApp as a complementary channel.

Initial entities: Contact, Lead, LeadActivity, LeadTask, and VehicleInterest.

## Phase 2 — Pipeline and follow-up
Lead stages: NEW, CONTACTED, QUALIFIED, APPOINTMENT, NEGOTIATION, WON, LOST.

Admin screens: lead inbox, lead detail, pipeline board, today's follow-ups, seller workload. Add next-action dates and lightweight activity timeline for calls, WhatsApp, email, notes, and tasks.

## Phase 3 — Appointments and reservations
Add Appointment with lead, car, seller, date/time, status, outcome, and notes. Add Reservation with lead, car, status, reserved/expiry dates, deposit, seller, and notes. `BY_APPOINTMENT` and `RESERVED` remain inventory states, while these entities carry commercial workflow.

## Phase 4 — Sale and handover
Add Sale/SalesOrder with car, buyer lead, seller, sale price, payment method, deposit, balance, financing, handover date, documents, and checklist.

## Phase 5 — Acquisition and intake
For “sell your car”: acquisition inquiry → appraisal → inspection → valuation → offer → documentation → intake → reconditioning → ready for sale. Add intake checklist, mechanical state, acquisition costs, received date, and ready-for-sale date.

## Phase 6 — Financial ERP
Only after operational workflows stabilize: payments, installments, receivables, payables, expenses, commissions, supplier/repair costs, margin, and reconciliation. Do not start with accounting.

## Recommended admin navigation

```text
Inicio
Autos
Leads
Seguimientos
Citas
Reservas
Vendedores
Usuarios
Configuración
```

## Initial admin screens
- Dashboard: new leads, overdue follow-ups, today's appointments, available/reserved cars, unassigned leads, vehicle inquiries, approximate conversion.
- Lead inbox: contact, vehicle, source, stage, seller, last contact, next follow-up, created date.
- Lead detail: contact info, vehicle interest, intent, timeline, notes, tasks, assignment, next action.
- Pipeline board: New → Contacted → Qualified → Appointment → Negotiation → Won / Lost.
- Today's follow-ups: calls, WhatsApp, appointments, expired follow-ups, reservations to confirm.
- Internal car workspace: Overview, Commercial data, Photos, Leads, Activities, Appointments, Reservation, Documents, History.

## Important architecture and security findings
- Authorization is distributed across middleware, layouts, pages, and API routes; roles are currently binary.
- `GET /api/cars/[id]` policy needs an explicit public/authenticated/admin decision before CRM work.
- Keep mutation reads in API routes where they are part of authorization and transaction boundaries.
- Upload image ownership lookup and slug uniqueness lookups have special invariants and should not be migrated blindly.
- Public `CarStatus` visibility is currently tied to AVAILABLE and BY_APPOINTMENT; future internal states must not leak publicly.
- Visit tracking is currently a counter, not a usable funnel.
- `recentLogs` is queried in the admin stats query but not rendered; decide whether to remove, use, or split it.
- Financial modeling will eventually need decisions about decimals, multi-currency, documents, taxes, and payment records; current catalog `price: Int` is insufficient for full accounting.

## First implementation slice
Ship only: Contact, Lead, LeadActivity, LeadTask, public vehicle inquiry form, sell-your-car structured form, lead inbox, lead detail, pipeline board, assignment, and follow-up timeline. This gives business value without starting with accounting complexity.

## Session handoff
In the next session, show this exploration again, then re-check the current repository structure with CodeGraph before proposing implementation. Do not repeat the analysis unless the structure changed.
