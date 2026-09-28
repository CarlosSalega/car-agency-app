"use client";

import type { PaginationProps } from "@/components/pagination/pagination";
import type { CarListItem } from "@/types/cars";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { AdminTable } from "@/components/admin";
import { getCarsColumns, DeleteCarDialog } from "@/components/cars";

export interface CarsTableProps {
  cars: CarListItem[];
  pagination?: PaginationProps;
}

export function CarsTable({ cars, pagination }: CarsTableProps) {
  const router = useRouter();

  const [carToDelete, setCarToDelete] = useState<CarListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleConfirmDelete(carId: string) {
    if (isDeleting) return;
    try {
      setIsDeleting(true);

      const res = await fetch(`/api/cars/${carId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        toast.error("Error al eliminar el vehículo");
        return;
      }

      toast.success("Vehículo eliminado exitosamente");
      setCarToDelete(null);
      router.refresh();
    } catch {
      toast.error("Error al eliminar el vehículo");
    } finally {
      setIsDeleting(false);
    }
  }

  const columns = getCarsColumns({
    onDelete: (carId) => {
      const carToRemove = cars.find((car) => car.id === carId);
      if (carToRemove) {
        setCarToDelete(carToRemove);
      }
    },
  });

  return (
    <>
      <AdminTable
        data={cars}
        columns={columns}
        rowKey={(car) => car.id}
        emptyState="No se encontraron vehículos"
        pagination={pagination}
      />

      <DeleteCarDialog
        open={!!carToDelete}
        car={carToDelete}
        loading={isDeleting}
        onCancel={() => setCarToDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
