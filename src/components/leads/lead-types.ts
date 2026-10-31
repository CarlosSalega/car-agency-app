import type { LeadStatus } from "@generated/prisma/enums";

/**
 * The row shape `/admin/leads` queries and the table renders.
 *
 * Only what the panel shows is selected: a lead carries a visitor's message and
 * personal data, so the query does not fetch more of it than the screen needs.
 * Dates stay `Date` objects here; the server component hands them to the client
 * component and formatting is pinned to the dealership's time zone in the
 * columns, so the pre-rendered HTML and the hydrated one match.
 */
export interface LeadWithRelations {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  message: string | null;
  status: LeadStatus;
  source: string | null;
  consentAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  car: { title: string; slug: string } | null;
  seller: { firstName: string; lastName: string } | null;
}
