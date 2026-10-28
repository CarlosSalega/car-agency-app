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
  const { title, year, kilometers, fuelType, price, currency, slug, brand } =
    car;

  const images: string[] = Array.isArray(car.images)
    ? car.images
    : safeJsonParse<string[]>((car.images as unknown as string) ?? "", []);

  const imageKey = images[0] ?? undefined;

  const badge = getCarBadge(car.status);

  return (
    <Link href={`/autos/${slug}`} className="group block h-full w-full">
      <article className="flex h-full flex-col overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#1c1c1c] transition-all duration-300 group-hover:border-[#444444]">
        {/* IMAGE */}
        <div className="relative aspect-16/10 w-full overflow-hidden bg-[#141414]">
          <CarImage
            imageKey={imageKey}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />

          {badge ? (
            <span
              className={`absolute top-3 left-3 z-10 rounded-sm px-2 py-0.5 font-mono text-[10px] font-semibold tracking-[0.08em] uppercase ${badge.className}`}
            >
              {badge.label}
            </span>
          ) : null}
        </div>

        {/* CONTENT */}
        <div className="flex flex-1 flex-col justify-between gap-4 p-5">
          <div className="flex flex-col gap-1.5">
            {/* EYEBROW: marca + año */}
            <div className="flex items-center justify-between font-mono text-[10px] leading-[14px] font-semibold tracking-[0.08em] text-[#a3a3a3] uppercase">
              <span className="min-w-0 truncate">{brand.name}</span>
              <span className="shrink-0">{year}</span>
            </div>

            {/* TITLE */}
            <h3 className="truncate text-[18px] leading-6 font-semibold tracking-tight text-[#f5f5f5] transition-colors group-hover:text-white">
              {title}
            </h3>

            {/* SPECS */}
            <p className="pt-0.5 text-xs leading-[18px] tracking-[0.01em] text-[#a3a3a3]">
              {formatKm(kilometers)} km · {fuelLabels[fuelType] ?? fuelType}
            </p>
          </div>

          <div className="flex flex-col gap-3 border-t border-[#2a2a2a] pt-4">
            {/* PRICE */}
            <div className="flex items-baseline justify-between gap-2">
              <div className="flex items-baseline gap-1">
                <span className="font-mono text-2xl leading-7 font-bold tracking-[-0.02em] text-[#f5f5f5]">
                  {formatPrice(price, currency)}
                </span>
                <span className="font-mono text-xs font-medium text-[#a3a3a3]">
                  {currency}
                </span>
              </div>
            </div>

            {/* CTA (visual: el Link ya envuelve toda la card) */}
            <span className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#333333] bg-[#242424] px-4 py-2.5 font-mono text-xs font-medium tracking-[0.02em] text-[#f5f5f5] transition-colors group-hover:border-white group-hover:bg-white group-hover:text-[#121212]">
              Ver vehículo
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
