import { DashboardStats } from "@/components/dashboard-stats";
import { LeadsDashboard } from "@/components/leads";
import { requireAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAdminCarStats } from "@/lib/queries/cars";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await requireAuthSession();

  const isAdmin = session.user.role === "ADMIN";

  const {
    totalCars,
    availableCars,
    byAppointmentCars,
    reservedCars,
    soldCars,
    totalVisits,
  } = await getAdminCarStats();

  // The dashboard reads every lead and aggregates in memory. At dealership
  // volume (a few thousand rows a year) that is cheaper and simpler than a
  // dozen SQL group-bys, and it keeps the bucketing rules in one tested module.
  // Bound to revisit: if a year of data ever makes this page slow, move the
  // aggregation into SQL. Only the fields the metrics use are selected, and
  // nothing at all for a role that cannot see them.
  const leads = isAdmin
    ? await prisma.lead.findMany({
        select: {
          name: true,
          status: true,
          createdAt: true,
          utmSource: true,
          car: { select: { title: true } },
        },
      })
    : [];

  const now = new Date();

  return (
    <>
      <div className="container mx-auto px-4 py-6">
        {isAdmin ? (
          <div className="space-y-10">
            <LeadsDashboard leads={leads} now={now} />

            <div className="mx-auto max-w-xl space-y-4">
              <h2 className="text-xl font-semibold">Inventario y visitas</h2>
              <DashboardStats
                totalCars={totalCars}
                availableCars={availableCars}
                byAppointmentCars={byAppointmentCars}
                reservedCars={reservedCars}
                soldCars={soldCars}
                totalVisits={totalVisits}
              />
            </div>
          </div>
        ) : (
          <div className="py-12 text-center">
            <p className="text-muted-foreground">
              Bienvenido, {session.user.name}. Usá el menú para gestionar los
              vehículos.
            </p>
            {/* Without this line the panel simply lacks a section, which reads
                as broken rather than as a permission. */}
            <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm">
              Las consultas y sus gráficos los ve un administrador.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
