"use client";

import type { Car } from "@generated/prisma/client";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

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
  const { title, year, kilometers, fuelType, price, currency, slug } = car;

  const images: string[] = Array.isArray(car.images)
    ? car.images
    : safeJsonParse<string[]>((car.images as unknown as string) ?? "", []);

  const imageKey = images[0] ?? undefined;

  const badge = getCarBadge(car.status);

  return (
    <Link href={`/autos/${slug}`} className="group block w-full">
      {/* A hairline makes the edge deliberate: without it the card is a light
        photo against a #121212 page and the rounded corner anti-aliases into a
        grey smudge, which reads as a dirty border rather than a card edge. */}
      <article className="bg-card border-border relative aspect-4/3 overflow-hidden rounded-xl border">
        {/* IMAGE */}
        <CarImage
          imageKey={imageKey}
          alt={title}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* GRADIENT: neutro, sin tintes de color (design system) */}
        <div className="from-background via-background/80 pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-linear-to-t to-transparent" />

        {badge ? (
          <span
            className={`absolute top-3 left-3 z-10 rounded-sm px-2 py-0.5 font-mono text-[10px] font-semibold tracking-[0.08em] uppercase ${badge.className}`}
          >
            {badge.label}
          </span>
        ) : null}

        {/* CONTENT OVERLAY */}
        <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-2.5 p-3.5">
          <div className="flex flex-col gap-0.5">
            <h3 className="text-foreground truncate text-base leading-6 font-semibold tracking-tight">
              {title}
            </h3>
            <p className="text-subtle-foreground truncate text-xs leading-[18px] tracking-[0.01em]">
              {year} · {fuelLabels[fuelType] ?? fuelType} ·{" "}
              {formatKm(kilometers)} km
            </p>
          </div>

          <div className="border-border flex items-center justify-between gap-3 border-t pt-2.5">
            <div className="flex min-w-0 items-baseline gap-1">
              <span className="text-foreground truncate font-mono text-lg leading-6 font-bold tracking-[-0.02em]">
                {formatPrice(price, currency)}
              </span>
              <span className="text-muted-foreground font-mono text-[10px] font-medium">
                {currency}
              </span>
            </div>

            <span className="border-input bg-background/80 text-foreground group-hover:border-brand-foreground group-hover:bg-primary group-hover:text-primary-foreground flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-xs font-medium whitespace-nowrap backdrop-blur-md transition-colors">
              Ver
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
