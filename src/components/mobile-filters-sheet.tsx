"use client";

import { Filter as FilterIcon, X as XIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import React from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import { SearchFilters } from "./search-filters";

type BrandForFilters = {
  id: string;
  name: string;
  models: Array<{ id: string; name: string }>;
};

export function MobileFiltersSheet({ brands }: { brands: BrandForFilters[] }) {
  const [open, setOpen] = React.useState(false);
  const searchParams = useSearchParams();

  const activeFilters = React.useMemo(() => {
    if (!searchParams) return 0;

    const keys = [
      "brand",
      "model",
      "type",
      "fuel",
      "transmission",
      "minYear",
      "maxYear",
      "minPrice",
      "maxPrice",
      "search",
    ];

    let count = 0;

    for (const k of keys) {
      const v = searchParams.get(k);
      if (v && v !== "" && v !== "all") count++;
    }

    return count;
  }, [searchParams]);

  return (
    <div className="lg:hidden">
      <div className="fixed right-6 bottom-6 z-50">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={
              <Button
                variant="default"
                className="bg-secondary text-primary hover:bg-secondary/90 relative rounded-full p-3 shadow-lg"
                aria-label={`Abrir filtros${activeFilters ? `, ${activeFilters} aplicados` : ""}`}
              >
                <FilterIcon className="size-5" />

                {activeFilters > 0 && (
                  <span className="bg-destructive text-destructive-foreground absolute -top-1 -right-1 inline-flex h-5 w-5 animate-pulse items-center justify-center rounded-full text-xs">
                    {activeFilters}
                  </span>
                )}

                <span className="sr-only">Abrir filtros</span>
              </Button>
            }
          />

          <SheetContent
            side="top"
            className="mx-auto max-h-dvh w-full max-w-md overflow-y-auto rounded-lg [&>button]:hidden"
          >
            <SheetHeader className="p-0">
              <SheetTitle className="sr-only">Filtros de búsqueda</SheetTitle>
            </SheetHeader>

            <div className="px-4 pb-6">
              <SearchFilters
                brands={brands}
                onApply={() => setOpen(false)}
                headerAction={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-none"
                    aria-label="Cerrar filtros"
                    onClick={() => setOpen(false)}
                  >
                    <XIcon className="size-5" />
                  </Button>
                }
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}

export default MobileFiltersSheet;
