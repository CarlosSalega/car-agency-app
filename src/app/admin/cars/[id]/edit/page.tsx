import { redirect } from "next/navigation";

import { CarForm } from "@/components/cars";
import { getAdminCarForEdit } from "@/lib/queries/cars";

export default async function EditCarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const car = await getAdminCarForEdit(id);

  if (!car) {
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
