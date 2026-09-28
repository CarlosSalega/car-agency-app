import type { AdminColumn } from "@/components/admin/admin-table";
import type { CarListItem } from "@/types/cars";

import { ActionButtonsGroup } from "@/components/admin/admin-action-buttons";
import { CarImage } from "@/components/cars/car-image";
import { CarStatusBadge } from "@/components/status-badges";

const formatPrice = (price: number, currency: string) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(price);

interface Params {
  onDelete: (carId: string) => void;
}

export function getCarsColumns({
  onDelete,
}: Params): AdminColumn<CarListItem>[] {
  return [
    {
      key: "image",
      header: "Imagen",
      cell: (car) => {
        const imageKey = car.images?.[0];

        return (
          <div className="relative size-16 overflow-hidden rounded-md">
            <CarImage
              imageKey={imageKey ?? undefined}
              alt={car.title}
              className="size-full object-cover"
              skipSkeleton={false}
            />
          </div>
        );
      },
    },
    {
      key: "vehicle",
      header: "Vehículo",
      // Titles and model names are free text, so they get a width limit and
      // truncate. The constraint sits on the element because a `max-width` on a
      // `td` is only a suggestion under the default `table-auto` layout.
      cell: (car) => (
        <div className="max-w-[220px]">
          <p className="truncate font-medium" title={car.title}>
            {car.title}
          </p>
          <p
            className="text-muted-foreground truncate text-sm"
            title={`${car.brand.name} ${car.model.name}`}
          >
            {car.brand.name} {car.model.name}
          </p>
        </div>
      ),
    },
    {
      key: "year",
      header: "Año",
      cell: (car) => car.year,
    },
    {
      key: "price",
      header: "Entrega Mínima",
      cell: (car) => formatPrice(car.price, car.currency),
    },
    {
      key: "status",
      header: "Estado",
      cell: (car) => <CarStatusBadge status={car.status} />,
    },
    {
      key: "createdBy",
      header: "Creado por",
      cell: (car) => (
        <span
          className="text-muted-foreground block max-w-[160px] truncate text-sm"
          title={car.user?.name || "N/A"}
        >
          {car.user?.name || "N/A"}
        </span>
      ),
    },
    {
      key: "actions",
      header: <span className="text-right">Acciones</span>,
      className: "text-right",
      cell: (car) => (
        <ActionButtonsGroup
          viewHref={`/autos/${car.slug}`}
          viewOpenInNewTab
          editHref={`/admin/cars/${car.id}/edit`}
          onDelete={() => onDelete(car.id)}
        />
      ),
    },
  ];
}
