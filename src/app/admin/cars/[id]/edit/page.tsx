import { redirect } from "next/navigation";

import { CarForm } from "@/components/cars";
import { canManageCar, requireAuthSession } from "@/lib/auth";
import { getAdminCarForEdit } from "@/lib/queries/cars";

export default async function EditCarPage({
  params,
}: Pick<PageProps<"/admin/cars/[id]/edit">, "params">) {
  const { id } = await params;

  const session = await requireAuthSession();
  const car = await getAdminCarForEdit(id);

  // The API has always refused to save somebody else's car; this page used to
  // render it anyway, so the limit only appeared after filling the form.
  if (!car || !canManageCar(car, session.user)) {
    redirect("/admin/cars");
  }

  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-8">
        <CarForm car={car} mode="edit" />
      </div>
    </div>
  );
}
