import { redirect } from "next/navigation";

import type { LeadStatus } from "@generated/prisma/enums";

import { LeadsTable } from "@/components/leads";
import { requireAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { leadStatusSchema } from "@/lib/validations/lead";

export const dynamic = "force-dynamic";

interface AdminLeadsPageProps {
  searchParams: Promise<{ status?: string | string[] }>;
}

/**
 * The panel's leads section, admin-only like the rest of the staff-facing
 * personal data.
 *
 * The list is queried here, in the server component, the same way
 * `/admin/users` does it: there is no GET route for the panel. The status comes
 * from the URL, so a filtered view is a link staff can share and reload.
 */
export default async function AdminLeadsPage({
  searchParams,
}: AdminLeadsPageProps) {
  const session = await requireAuthSession();

  if (session.user.role !== "ADMIN") {
    redirect("/admin");
  }

  const params = await searchParams;
  const rawStatus = Array.isArray(params.status)
    ? params.status[0]
    : params.status;

  // An unknown value in the URL is not an error page: it falls back to the
  // unfiltered list, which is what a truncated link should show.
  const parsedStatus = leadStatusSchema.safeParse(rawStatus);
  const status: LeadStatus | "ALL" = parsedStatus.success
    ? parsedStatus.data
    : "ALL";

  const leads = await prisma.lead.findMany({
    where: status === "ALL" ? undefined : { status },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      message: true,
      status: true,
      source: true,
      utmSource: true,
      utmMedium: true,
      utmCampaign: true,
      referrer: true,
      consentAt: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      car: { select: { title: true, slug: true } },
      seller: { select: { firstName: true, lastName: true } },
    },
  });

  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-6">
        <LeadsTable leads={leads} status={status} />
      </div>
    </div>
  );
}
