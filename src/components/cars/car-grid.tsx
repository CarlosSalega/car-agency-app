import type { Car } from "@generated/prisma/client";
import Link from "next/link";
import { SearchX } from "lucide-react";

import { PaginationProps } from "@/components/pagination/pagination";
import { WithPagination } from "@/components/pagination/with-pagination";

import { CarCard } from "@/components/cars";
import { Button } from "@/components/ui/button";

interface CarGridProps {
  cars: (Car & {
    brand: { name: string };
    model: { name: string };
  })[];
  pagination?: PaginationProps;
  currentPage?: number;
  totalPages?: number;
  emptyAction?: { href: string; label: string };
}

export function CarGrid({
  cars,
  pagination,
  currentPage,
  totalPages,
  emptyAction,
}: CarGridProps) {
  const finalPagination =
    pagination ||
    (currentPage && totalPages
      ? {
          currentPage,
          totalPages,
          baseUrl: "?",
        }
      : undefined);

  if (cars.length === 0) {
    return (
      <div
        role="status"
        className="flex min-h-[320px] flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-[#2a2a2a] bg-[#1c1c1c] px-6 py-16 text-center sm:py-20"
      >
        <div className="flex size-12 items-center justify-center rounded-lg border border-[#333333] bg-[#242424]">
          <SearchX className="size-6 text-[#a3a3a3]" aria-hidden="true" />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-lg font-medium text-[#f5f5f5]">
            Sin resultados con esos filtros
          </p>
          <p className="text-sm text-[#a3a3a3]">
            Probá ampliando el precio o quitando algún filtro.
          </p>
        </div>
        {emptyAction ? (
          <Button
            className="rounded-lg font-mono text-xs"
            render={<Link href={emptyAction.href}>{emptyAction.label}</Link>}
          />
        ) : null}
      </div>
    );
  }

  const gridContent = (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {cars.map((car) => (
        <CarCard key={car.id} car={car} />
      ))}
    </div>
  );

  return finalPagination ? (
    <WithPagination
      pagination={finalPagination}
      containerClassName="flex flex-col min-h-[400px]"
      contentClassName="flex-1"
    >
      {gridContent}
    </WithPagination>
  ) : (
    gridContent
  );
}
