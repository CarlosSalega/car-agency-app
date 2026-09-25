import type { Car, Brand, Model } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { getCarBadge } from "@/components/status-badges";

interface CarDetailInfoProps {
  car: Car & {
    brand: Brand;
    model: Model;
  };
}

export function CarDetailInfo({ car }: CarDetailInfoProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: car.currency,
      minimumFractionDigits: 0,
    }).format(price);
  };

  const badge = getCarBadge(car.status);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-2 text-4xl font-bold text-balance">{car.title}</h1>
      </div>

      <div className="flex items-center gap-2">
        <Badge className={badge.className}>{badge.label}</Badge>

        {car.kilometers === 0 ? (
          <Badge variant="outline">0Km</Badge>
        ) : car.kilometers > 0 && car.kilometers < 50000 ? (
          <Badge variant="secondary">Pocos kilómetros</Badge>
        ) : null}
      </div>

      <div className="border-border border-t border-b py-6">
        <p className="text-foreground text-4xl font-bold">
          {formatPrice(car.price)}
        </p>
        <p className="text-muted-foreground mt-1 text-sm">Entrega Mínima</p>
      </div>

      <div>
        <h2 className="mb-3 text-xl font-semibold">Descripción</h2>
        <p className="text-muted-foreground leading-relaxed text-pretty">
          {car.description}
        </p>
      </div>
    </div>
  );
}
