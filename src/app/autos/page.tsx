import type { Metadata } from "next";

import { CarGrid } from "@/components/cars/car-grid";
import { Badge } from "@/components/ui/badge";

import MobileFiltersSheet from "@/components/mobile-filters-sheet";
import { SearchFilters } from "@/components/search-filters";
import { SearchComponent } from "@/components/search/search-component";
import { getBrandsWithModels } from "@/lib/queries/brands";
import {
  type CarListFilters,
  getPublicCarsCount,
  getPublicCarsList,
} from "@/lib/queries/cars";
import Footer from "../(landing)/components/Footer";
import { NavbarServer } from "../(landing)/components/NavbarServer";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Catálogo de autos usados y 0km en Santa Fe | Car Agency App",
  description:
    "Explorá el catálogo de Car Agency App: autos usados y 0km en Santa Fe con revisión mecánica garantizada y financiación a medida. ¡Encontrá el tuyo hoy!",
  alternates: {
    canonical: "/autos",
  },
};

function buildFilters(params: {
  [key: string]: string | string[] | undefined;
}): CarListFilters {
  const filters: CarListFilters = {};
  if (params.brand && params.brand !== "all")
    filters.brandId = params.brand as string;
  if (params.model && params.model !== "all")
    filters.modelId = params.model as string;
  if (params.type && params.type !== "all")
    filters.type = params.type as string;
  if (params.fuel && params.fuel !== "all")
    filters.fuelType = params.fuel as string;
  if (params.transmission && params.transmission !== "all")
    filters.transmission = params.transmission as string;
  if (params.minYear) filters.minYear = Number(params.minYear);
  if (params.maxYear) filters.maxYear = Number(params.maxYear);
  if (params.minPrice) filters.minPrice = Number(params.minPrice);
  if (params.maxPrice) filters.maxPrice = Number(params.maxPrice);
  if (params.search) filters.search = params.search as string;
  return filters;
}

export default async function AutosPage({ searchParams }: PageProps<"/autos">) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const limit = 12;
  const skip = (page - 1) * limit;
  const filters = buildFilters(params);

  const [cars, total, brands] = await Promise.all([
    getPublicCarsList(filters, skip, limit),
    getPublicCarsCount(filters),
    getBrandsWithModels(),
  ]);

  const totalPages = Math.ceil(total / limit);

  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (key !== "page" && value !== undefined) {
      if (Array.isArray(value)) {
        value.forEach((v) => queryParams.append(key, v));
      } else {
        queryParams.set(key, value);
      }
    }
  });
  const queryString = queryParams.toString();
  const baseUrl = queryString ? `?${queryString}` : "?";

  return (
    <div className="bg-background min-h-screen">
      <div className="pt-24">
        <NavbarServer />
        <SearchComponent />
        <div className="grid gap-x-8 gap-y-4 px-4 py-8 md:px-8 lg:grid-cols-[320px_1fr]">
          <div
            role="status"
            aria-live="polite"
            className="lg:col-start-2 lg:row-start-1"
          >
            <Badge variant="outline" className="border-secondary text-primary">
              {total === 0
                ? "No se encontraron vehículos"
                : total === 1
                  ? "1 vehículo encontrado"
                  : `Mostrando ${total} vehículos`}
            </Badge>
          </div>
          <div className="hidden lg:col-start-1 lg:row-start-2 lg:block">
            <SearchFilters brands={brands} />
          </div>
          <div className="flex min-w-0 flex-col lg:col-start-2 lg:row-start-2">
            <CarGrid
              cars={cars}
              emptyAction={{ href: "/autos", label: "Limpiar filtros" }}
              pagination={{ currentPage: page, totalPages, baseUrl }}
            />
          </div>
        </div>
      </div>
      <MobileFiltersSheet brands={brands} />
      <Footer />
    </div>
  );
}
