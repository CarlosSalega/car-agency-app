"use client";

import type { Car } from "@generated/prisma/client";
import Link from "next/link";

import { CarImage } from "@/components/cars";
import { getCarBadge } from "@/components/status-badges";
import { fuelLabels } from "@/lib/constants";
import { safeJsonParse, formatPrice, formatKm } from "@/lib/utils";

interface CarCardProps {
  car: Car & {
    brand: { name: string };
    model: { name: string };
  };
}

export function CarCard({ car }: CarCardProps) {
  const { title, year, kilometers, fuelType, price, currency, slug, brand } =
    car;

  const images: string[] = Array.isArray(car.images)
    ? car.images
    : safeJsonParse<string[]>((car.images as unknown as string) ?? "", []);

  const imageKey = images[0] ?? undefined;

  const badge = getCarBadge(car.status);

  return (
    <Link href={`/autos/${slug}`} className="group block w-full">
      <div className="hover:border-border relative overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900 transition-all duration-500 hover:shadow-[0_8px_30px_-10px_rgba(209,213,219,0.2)]">
        {/* IMAGE */}
        <div className="relative aspect-16/10 overflow-hidden">
          {/* gradient overlay */}
          <div className="absolute bottom-0 left-0 z-10 h-16 w-full bg-linear-to-t from-neutral-900 to-transparent" />

          <CarImage
            imageKey={imageKey}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />

          {/* top hover line */}
          <div className="bg-muted-foreground absolute top-0 left-0 z-20 h-0.5 w-0 transition-all duration-500 group-hover:w-full" />

          <span
            className={`absolute top-3 left-3 z-20 rounded-md px-2 py-0.5 text-xs font-medium uppercase ${badge.className}`}
          >
            {badge.label}
          </span>
        </div>

        {/* CONTENT */}
        <div className="flex flex-col gap-1.5 px-4 pt-3 pb-4">
          {/* TITLE */}
          <h3 className="group-hover:text-muted-foreground text-background truncate text-sm font-medium tracking-tight transition-colors duration-300">
            {title}
          </h3>

          {/* PRICE */}
          <p className="text-muted-foreground text-base font-semibold">
            {formatPrice(price, currency)}
          </p>

          {/* BRAND + YEAR */}
          <div className="flex items-center text-sm text-white/70">
            <span className="font-medium">{brand.name}</span>
            <span className="text-secondary-foreground mx-2">|</span>
            <span>{year}</span>
          </div>

          {/* DIVIDER */}
          <div className="h-px bg-neutral-800 transition-colors duration-300 group-hover:bg-neutral-700" />

          {/* EXTRA INFO */}
          <div className="flex items-center justify-between text-xs tracking-wider text-white/60 uppercase">
            <span className="min-w-0 truncate">
              {formatKm(kilometers)} km • {fuelLabels[fuelType] ?? fuelType}
            </span>

            <div className="flex shrink-0 items-center gap-2">
              <span>Ver</span>

              <div className="group-hover:border-border flex size-7 items-center justify-center rounded-full border border-neutral-600 transition-all duration-300">
                <span className="text-neutral-400 transition-colors group-hover:text-white">
                  →
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
