import { DashboardStats } from "@/components/dashboard-stats";
import { requireAuthSession } from "@/lib/auth";
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

  return (
    <>
      <div className="container mx-auto px-4 py-6">
        {isAdmin ? (
          <>
            <DashboardStats
              totalCars={totalCars}
              availableCars={availableCars}
              byAppointmentCars={byAppointmentCars}
              reservedCars={reservedCars}
              soldCars={soldCars}
              totalVisits={totalVisits}
            />
          </>
        ) : (
          <div className="py-12 text-center">
            <p className="text-muted-foreground">
              Bienvenido, {session.user.name}. Usá el menú para gestionar los
              vehículos.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
