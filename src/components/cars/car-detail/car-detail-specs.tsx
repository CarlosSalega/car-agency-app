import type {
  Car,
  Brand,
  Model,
  PaymentMethod,
} from "@generated/prisma/client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Badge } from "@/components/ui/badge";
import { getCarBadge } from "@/components/status-badges";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/constants/enum-options";
import { carTypeLabels, fuelLabels } from "@/lib/constants/constants";

interface CarDetailSpecsProps {
  car: Car & {
    brand: Brand;
    model: Model;
  };
}

export function CarDetailSpecs({ car }: CarDetailSpecsProps) {
  const formatKm = (km: number) => {
    return new Intl.NumberFormat("es-AR").format(km);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: car.currency,
      minimumFractionDigits: 0,
    }).format(price);
  };

  const specs = [
    { label: "Marca", value: car.brand.name },
    { label: "Modelo", value: car.model.name },
    { label: "Versión", value: car.version || "N/A" },
    { label: "Año", value: car.year.toString() },
    { label: "Kilometraje", value: `${formatKm(car.kilometers)} km` },
    { label: "Tipo", value: carTypeLabels[car.type] ?? car.type },
    {
      label: "Combustible",
      value: fuelLabels[car.fuelType] ?? car.fuelType,
    },
    {
      label: "Transmisión",
      value: car.transmission === "AUTOMATIC" ? "Automática" : "Manual",
    },
    { label: "Color", value: car.color || "N/A" },
  ];

  const badge = getCarBadge(car.status);

  const paymentMethods: PaymentMethod[] = Array.isArray(car.paymentMethods)
    ? car.paymentMethods
    : [];

  const getPaymentMethodLabel = (method: PaymentMethod) =>
    PAYMENT_METHOD_OPTIONS.find((option) => option.value === method)?.label ??
    method;

  return (
    <Card className="bg-accent rounded-none py-6 shadow-none">
      <CardHeader>
        <CardTitle>Ficha Técnica</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div>
            <h1 className="mb-2 text-4xl font-bold text-balance">
              {car.title}
            </h1>
          </div>

          <Badge className={`${badge.className} rounded-none`}>
            {badge.label}
          </Badge>

          <div className="border-border border-t border-b py-4">
            <p className="text-muted-foreground mt-1 text-sm">Entrega Mínima</p>
            <p className="text-foreground text-4xl font-bold">
              {formatPrice(car.price)}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 py-6 md:grid-cols-3">
          {specs.map((spec) => (
            <div key={spec.label} className="space-y-1">
              <p className="text-muted-foreground text-sm">{spec.label}</p>
              <p className="font-medium">{spec.value}</p>
            </div>
          ))}
        </div>
        {paymentMethods.length > 0 && (
          <div className="border-border border-t pt-6 pb-6">
            <h2 className="mb-3 text-xl font-semibold">Formas de pago</h2>
            <div className="flex flex-wrap gap-2">
              {paymentMethods.map((method) => (
                <Badge
                  key={method}
                  variant="outline"
                  className="border-brand text-brand rounded-none"
                >
                  {getPaymentMethodLabel(method)}
                </Badge>
              ))}
            </div>
          </div>
        )}
        {car.description && (
          <div className="border-border border-t pt-6">
            <h2 className="mb-3 text-xl font-semibold">Descripción</h2>
            <p className="text-muted-foreground leading-relaxed text-pretty">
              {car.description}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
