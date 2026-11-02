import Link from "next/link";

import { CarImage } from "@/components/cars/car-image";
import { carTypeLabels } from "@/lib/constants/constants";
import { formatKm, formatPrice } from "@/lib/utils";

/**
 * The latest arrivals, as rows.
 *
 * A card grid asks the eye to compare four things at once; a row puts the model
 * on the left and the price on the right, which is how a person reads a stock
 * list. It also survives a photo that fails: the row is still a row.
 *
 * The whole row is the link. The price is text, not a button, because there is
 * one action on this screen — open the unit — and duplicating it per row adds
 * tab stops without adding choice.
 */

type Arrival = {
  id: string;
  title: string;
  version: string | null;
  slug: string;
  year: number;
  kilometers: number;
  price: number | string;
  currency: string;
  type: string;
  images: string[];
};

interface LatestArrivalsProps {
  cars: Arrival[];
  totalCars: number;
}

export function LatestArrivals({ cars, totalCars }: LatestArrivalsProps) {
  if (cars.length === 0) return null;

  const remaining = Math.max(totalCars - cars.length, 0);

  return (
    <section id="ingresos" className="border-border border-b py-20">
      <div className="mx-auto w-full max-w-[1320px] px-7">
        <div className="mb-8 grid items-end gap-6 md:grid-cols-[1fr_auto]">
          <div>
            <p className="text-muted-foreground mb-2 flex items-center gap-3 font-mono text-[11px] tracking-[0.16em] uppercase">
              <s aria-hidden="true" className="bg-brand block h-px w-7" />
              Últimos ingresos
            </p>
            <h2 className="text-[clamp(26px,3vw,38px)] leading-[1.05] font-bold tracking-[-0.02em]">
              Lo que entró esta semana al salón
            </h2>
          </div>
          <p className="text-muted-foreground max-w-[32ch] font-mono text-[11px] leading-relaxed tracking-[0.14em] uppercase md:text-right">
            Ordenados por fecha de ingreso.
            <br />
            El precio es de lista: el saldo se arma con parte de pago.
          </p>
        </div>

        <div className="border-border border-t">
          {cars.map((car) => (
            <Link
              key={car.id}
              href={`/autos/${car.slug}`}
              className="border-border hover:bg-accent/40 grid grid-cols-[92px_1fr] items-center gap-x-4 gap-y-2 border-b py-4 transition-colors sm:grid-cols-[112px_1fr_auto] sm:gap-6"
            >
              <span className="border-border bg-ground block border p-1.5">
                <CarImage
                  imageKey={car.images[0] ?? null}
                  alt=""
                  variant="thumbnail"
                  sizes="112px"
                  skipSkeleton
                  className="aspect-[4/3] h-auto w-full"
                />
              </span>

              <span className="min-w-0">
                <span className="block truncate text-lg font-bold tracking-[-0.01em] sm:text-xl">
                  {car.title}
                  {car.version ? ` ${car.version}` : ""}
                </span>
                <span className="text-muted-foreground mt-1 block font-mono text-[11px] tracking-[0.08em]">
                  {car.year} ·{" "}
                  {car.kilometers === 0
                    ? "0 km"
                    : `${formatKm(car.kilometers)} km`}{" "}
                  · {carTypeLabels[car.type] ?? car.type}
                </span>
              </span>

              <span className="col-start-2 text-left sm:col-start-3 sm:text-right">
                <span className="block font-mono text-base font-medium whitespace-nowrap">
                  {formatPrice(Number(car.price), car.currency)}
                </span>
                <span className="text-muted-foreground font-mono text-[10px] tracking-[0.14em] uppercase">
                  Ver la unidad
                </span>
              </span>
            </Link>
          ))}
        </div>

        <Link
          href="/catalogo"
          className="border-line-strong hover:bg-accent mt-6 flex items-center justify-between gap-4 border px-5 py-4 transition-colors"
        >
          <span className="font-mono text-[11px] tracking-[0.16em] uppercase">
            {remaining === 0
              ? "Estas son todas las unidades"
              : `Quedan ${remaining} unidades más`}
          </span>
          <span className="text-brand font-mono text-[11px] tracking-[0.16em] uppercase">
            Ir al catálogo →
          </span>
        </Link>
      </div>
    </section>
  );
}
