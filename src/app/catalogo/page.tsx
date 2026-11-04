import type { Metadata } from "next";

import { activeSite } from "@/site/active";
import { buildPageMetadata } from "@/site/contract";

import { CarGrid } from "@/components/cars/car-grid";
import { CatalogFilterBar } from "@/components/catalog/catalog-filter-bar";
import { getBrandsWithModels } from "@/lib/queries/brands";
import {
  type CarListFilters,
  getPublicCarsCount,
  getPublicCarsList,
} from "@/lib/queries/cars";
import Footer from "../(landing)/components/Footer";
import { SiteHeader } from "../(landing)/components/SiteHeader";

export const revalidate = 300;

/**
 * Una vista filtrada no se indexa: hay tantas combinaciones como URLs, y Google no
 * debería elegir "SUV + Nafta + 2023" como la puerta de entrada al catálogo. La
 * canónica siempre apunta al catálogo limpio.
 */
export async function generateMetadata({
  searchParams,
}: PageProps<"/catalogo">): Promise<Metadata> {
  const params = await searchParams;
  const isFiltered = Object.keys(params).some((key) => key !== "page");

  return {
    ...buildPageMetadata(activeSite, "catalog", "/catalogo"),
    ...(isFiltered ? { robots: { index: false, follow: true } } : {}),
  };
}
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
  if (params.sort) filters.sort = params.sort as string;

  // El buscador del header manda `q`; los filtros del panel mandan `search`.
  const search = params.q ?? params.search;
  if (typeof search === "string" && search.trim()) {
    filters.search = search.trim();
  }
  return filters;
}

export default async function CatalogoPage({
  searchParams,
}: PageProps<"/catalogo">) {
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
      {/* El header es el mismo de la home y es `sticky`, no `fixed`: no necesita
          el `pt-24` que compensaba al navbar anterior. */}
      <SiteHeader />

      <CatalogFilterBar
        params={Object.fromEntries(
          Object.entries(params).map(([key, value]) => [
            key,
            Array.isArray(value) ? value[0] : value,
          ]),
        )}
        brands={brands}
        total={total}
      />

      <div className="mx-auto w-full max-w-[1320px] px-7 py-8">
        <CarGrid
          cars={cars}
          emptyAction={{ href: "/catalogo", label: "Limpiar filtros" }}
          pagination={{ currentPage: page, totalPages, baseUrl }}
        />
      </div>

      <Footer />
    </div>
  );
}
