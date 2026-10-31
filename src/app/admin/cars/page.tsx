import { Plus, Upload } from "lucide-react";
import Link from "next/link";

import { CarsTable } from "@/components/cars";
import { Button } from "@/components/ui/button";
import { getAdminCarsCount, getAdminCarsList } from "@/lib/queries/cars";

const ITEMS_PER_PAGE = 12;

export const dynamic = "force-dynamic";

export default async function AdminCarsPage({
  searchParams,
}: PageProps<"/admin/cars">) {
  const params = await searchParams;
  const currentPage = Number(params.page) || 1;
  const skip = (currentPage - 1) * ITEMS_PER_PAGE;

  const totalCars = await getAdminCarsCount();

  const totalPages = Math.ceil(totalCars / ITEMS_PER_PAGE);

  const cars = await getAdminCarsList(skip, ITEMS_PER_PAGE);

  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6 flex flex-row-reverse items-center gap-2">
          <Button
            render={
              <Link href="/admin/cars/new">
                <Plus className="mr-2 size-4" />
                Agregar Vehículo
              </Link>
            }
            className="bg-foreground text-background hover:bg-foreground/80"
          />
          <Button
            variant="outline"
            render={
              <Link href="/admin/cars/import">
                <Upload className="mr-2 size-4" />
                Importar Inventario
              </Link>
            }
          />
        </div>

        <CarsTable
          cars={cars}
          pagination={{
            currentPage: currentPage,
            totalPages: totalPages,
            baseUrl: "/admin/cars",
          }}
        />
      </div>
    </div>
  );
}
