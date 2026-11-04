import Link from "next/link";

import {
  CAR_TYPE_OPTIONS,
  FUEL_TYPE_OPTIONS,
  TRANSMISSION_OPTIONS,
} from "@/lib/constants/enum-options";
import {
  activeFilters,
  clearFilters,
  toggleFacet,
  withParam,
} from "@/lib/catalog/filter-url";

import { FilterChip, FilterGroup } from "./filter-chip";

/**
 * The catalog's filter bar: the facets as chips over the results.
 *
 * The whole thing is a server component made of links and one `GET` form, so the
 * filters work without JavaScript, every filtered view is shareable, and there is
 * no state to keep in sync with the URL — the URL *is* the state.
 *
 * The split between the band and "Más filtros" is by input type, not by taste:
 * short facets that fit in a row are chips; ranges (year, price) need two fields
 * and belong in the panel. `marca` is a menu because a dealership carries ten
 * brands and they would push everything else off the row.
 */

const SORT_OPTIONS = [
  { value: "", label: "Recientes" },
  { value: "precio-asc", label: "Menor precio" },
  { value: "precio-desc", label: "Mayor precio" },
  { value: "km-asc", label: "Menor kilometraje" },
] as const;

interface Brand {
  id: string;
  name: string;
  models: { id: string; name: string }[];
}

interface CatalogFilterBarProps {
  params: Record<string, string | undefined>;
  brands: Brand[];
  total: number;
}

export function CatalogFilterBar({
  params: raw,
  brands,
  total,
}: CatalogFilterBarProps) {
  const params = new URLSearchParams(
    Object.entries(raw).filter(([, value]) => value !== undefined) as [
      string,
      string,
    ][],
  );

  const active = params.get("type") ?? "";
  const fuel = params.get("fuel") ?? "";
  const transmission = params.get("transmission") ?? "";
  const brand = params.get("brand") ?? "";
  const model = params.get("model") ?? "";
  const sort = params.get("sort") ?? "";

  const applied = activeFilters(params);
  const currentBrand = brands.find((item) => item.id === brand);

  return (
    <div className="border-line-strong bg-ground border-y">
      <div className="mx-auto w-full max-w-[1320px] px-7 py-5">
        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:gap-x-7">
          {/* Los facets son lo único que se desliza: en mobile es un scroller con
              su propio ancho, y por eso el body deja de arrastrarse de costado. En
              desktop vuelven a fluir y a envolver. */}
          <div className="flex snap-x items-center gap-7 overflow-x-auto [scrollbar-width:none] md:flex-wrap md:overflow-visible [&::-webkit-scrollbar]:hidden">
            <FilterGroup label="Tipo">
              <FilterChip
                label="Todos"
                facet="type"
                value=""
                active={!active}
                params={params}
              />
              {CAR_TYPE_OPTIONS.map((option) => (
                <FilterChip
                  key={option.value}
                  label={option.label}
                  facet="type"
                  value={option.value}
                  active={active === option.value}
                  params={params}
                />
              ))}
            </FilterGroup>

            <FilterGroup label="Combustible">
              <FilterChip
                label="Todos"
                facet="fuel"
                value=""
                active={!fuel}
                params={params}
              />
              {FUEL_TYPE_OPTIONS.map((option) => (
                <FilterChip
                  key={option.value}
                  label={option.label}
                  facet="fuel"
                  value={option.value}
                  active={fuel === option.value}
                  params={params}
                />
              ))}
            </FilterGroup>

            <FilterGroup label="Caja">
              <FilterChip
                label="Todas"
                facet="transmission"
                value=""
                active={!transmission}
                params={params}
              />
              {TRANSMISSION_OPTIONS.map((option) => (
                <FilterChip
                  key={option.value}
                  label={option.label}
                  facet="transmission"
                  value={option.value}
                  active={transmission === option.value}
                  params={params}
                />
              ))}
            </FilterGroup>
          </div>

          <div className="flex items-center gap-2 md:ml-auto">
            {/* Marca: menú porque son muchas y no entran como chips. */}
            <details className="group relative">
              <summary className="border-line-strong text-subtle-foreground hover:border-foreground hover:text-foreground flex cursor-pointer list-none items-center gap-2 border px-2.5 py-1.5 font-mono text-[11px] tracking-[0.04em] transition-colors [&::-webkit-details-marker]:hidden">
                {currentBrand ? currentBrand.name : "Marca: todas"}
                <span aria-hidden="true" className="text-[9px]">
                  ▾
                </span>
              </summary>
              <div className="border-line-strong bg-card absolute top-[calc(100%+6px)] right-0 z-30 max-h-72 w-56 overflow-y-auto border">
                <Link
                  href={toggleFacet(params, "brand", "")}
                  className="text-subtle-foreground hover:bg-accent hover:text-foreground border-border block border-b px-3 py-2 font-mono text-[11px] tracking-[0.04em] last:border-b-0"
                >
                  Todas las marcas
                </Link>
                {brands.map((item) => (
                  <Link
                    key={item.id}
                    href={toggleFacet(params, "brand", item.id)}
                    aria-current={brand === item.id ? "true" : undefined}
                    className={`hover:bg-accent hover:text-foreground border-border block border-b px-3 py-2 font-mono text-[11px] tracking-[0.04em] last:border-b-0 ${
                      brand === item.id
                        ? "text-brand"
                        : "text-subtle-foreground"
                    }`}
                  >
                    {item.name}
                  </Link>
                ))}
              </div>
            </details>

            {/* Más filtros: los rangos, que necesitan dos campos. */}
            <details className="group relative">
              <summary className="border-line-strong text-subtle-foreground hover:border-foreground hover:text-foreground flex cursor-pointer list-none items-center gap-2 border border-dashed px-2.5 py-1.5 font-mono text-[11px] tracking-[0.04em] transition-colors [&::-webkit-details-marker]:hidden">
                Más filtros
                <span aria-hidden="true" className="text-[9px]">
                  ⚙
                </span>
              </summary>
              <div className="border-line-strong bg-card absolute top-[calc(100%+6px)] right-0 z-30 w-80 border p-4">
                <form
                  action="/catalogo"
                  method="get"
                  className="grid gap-3 sm:grid-cols-2"
                >
                  {/* Los filtros activos viajan en campos ocultos: un GET form pisa
                    la query, así que lo que no se muestra se pierde. */}
                  {[...params.entries()]
                    .filter(
                      ([key]) =>
                        ![
                          "minYear",
                          "maxYear",
                          "minPrice",
                          "maxPrice",
                        ].includes(key),
                    )
                    .map(([key, value]) => (
                      <input key={key} type="hidden" name={key} value={value} />
                    ))}

                  <label className="grid gap-1.5">
                    <span className="text-muted-foreground font-mono text-[10px] tracking-[0.14em] uppercase">
                      Año desde
                    </span>
                    <input
                      name="minYear"
                      inputMode="numeric"
                      defaultValue={params.get("minYear") ?? ""}
                      placeholder="2019"
                      className="border-line-strong bg-background text-foreground focus:border-brand h-10 w-full border px-2.5 font-mono text-[13px] focus:outline-none"
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-muted-foreground font-mono text-[10px] tracking-[0.14em] uppercase">
                      Año hasta
                    </span>
                    <input
                      name="maxYear"
                      inputMode="numeric"
                      defaultValue={params.get("maxYear") ?? ""}
                      placeholder="2025"
                      className="border-line-strong bg-background text-foreground focus:border-brand h-10 w-full border px-2.5 font-mono text-[13px] focus:outline-none"
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-muted-foreground font-mono text-[10px] tracking-[0.14em] uppercase">
                      Precio desde
                    </span>
                    <input
                      name="minPrice"
                      inputMode="numeric"
                      defaultValue={params.get("minPrice") ?? ""}
                      placeholder="15000000"
                      className="border-line-strong bg-background text-foreground focus:border-brand h-10 w-full border px-2.5 font-mono text-[13px] focus:outline-none"
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-muted-foreground font-mono text-[10px] tracking-[0.14em] uppercase">
                      Precio hasta
                    </span>
                    <input
                      name="maxPrice"
                      inputMode="numeric"
                      defaultValue={params.get("maxPrice") ?? ""}
                      placeholder="60000000"
                      className="border-line-strong bg-background text-foreground focus:border-brand h-10 w-full border px-2.5 font-mono text-[13px] focus:outline-none"
                    />
                  </label>

                  <div className="border-border col-span-2 mt-1 flex items-center justify-between gap-3 border-t pt-3">
                    <Link
                      href={clearFilters(params)}
                      className="text-muted-foreground hover:text-foreground font-mono text-[10px] tracking-[0.14em] uppercase"
                    >
                      Limpiar
                    </Link>
                    <button
                      type="submit"
                      className="bg-primary text-primary-foreground hover:bg-primary/90 h-10 shrink-0 cursor-pointer px-4 font-mono text-[10px] font-bold tracking-[0.16em] uppercase"
                    >
                      Aplicar
                    </button>
                  </div>
                </form>
              </div>
            </details>

            {applied.length > 0 ? (
              <Link
                href={clearFilters(params)}
                className="text-brand font-mono text-[10px] tracking-[0.16em] uppercase hover:underline"
              >
                Limpiar
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      {/* Modelo: sólo cuando hay marca, porque un modelo suelto no significa nada. */}
      {currentBrand && currentBrand.models.length > 0 ? (
        <div className="border-border border-t">
          <div className="mx-auto flex w-full max-w-[1320px] flex-wrap items-center gap-x-3 gap-y-2 px-7 py-2.5">
            <FilterGroup label="Modelo">
              <FilterChip
                label="Todos"
                facet="model"
                value=""
                active={!model}
                params={params}
              />
              {currentBrand.models.map((item) => (
                <FilterChip
                  key={item.id}
                  label={item.name}
                  facet="model"
                  value={item.id}
                  active={model === item.id}
                  params={params}
                />
              ))}
            </FilterGroup>
          </div>
        </div>
      ) : null}

      {/* Filtros aplicados, como chips removibles. */}
      {applied.length > 0 ? (
        <div className="border-border border-t">
          <div className="mx-auto flex w-full max-w-[1320px] flex-wrap items-center gap-2 px-7 py-2.5">
            <span className="text-muted-foreground font-mono text-[10px] tracking-[0.16em] uppercase">
              Filtros
            </span>
            {applied.map((filter) => (
              <Link
                key={`${filter.key}-${filter.value}`}
                href={filter.href}
                className="border-line-strong bg-card text-subtle-foreground hover:text-foreground flex items-center gap-2 border px-2.5 py-1 font-mono text-[10px] tracking-[0.08em] uppercase transition-colors"
              >
                {filter.label}
                <span aria-hidden="true" className="text-brand">
                  ×
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {/* Resultado y orden */}
      <div className="border-border border-t">
        <div className="mx-auto flex w-full max-w-[1320px] items-center justify-between gap-4 px-7 py-3">
          <p
            role="status"
            aria-live="polite"
            className="text-muted-foreground m-0 font-mono text-[11px] tracking-[0.14em] uppercase"
          >
            {total === 0
              ? "Sin resultados"
              : total === 1
                ? "1 vehículo"
                : `${total} vehículos`}
          </p>

          <details className="relative">
            <summary className="border-line-strong text-subtle-foreground hover:border-foreground hover:text-foreground flex cursor-pointer list-none items-center gap-2 border px-2.5 py-1.5 font-mono text-[11px] tracking-[0.04em] transition-colors [&::-webkit-details-marker]:hidden">
              <span className="text-muted-foreground">Ordenar:</span>
              {SORT_OPTIONS.find((o) => o.value === sort)?.label ?? "Recientes"}
              <span aria-hidden="true" className="text-[9px]">
                ▾
              </span>
            </summary>
            <div className="border-line-strong bg-card absolute top-[calc(100%+6px)] right-0 z-30 w-48 border">
              {SORT_OPTIONS.map((option) => (
                <Link
                  key={option.value || "recent"}
                  href={withParam(params, "sort", option.value)}
                  aria-current={
                    (sort || "") === option.value ? "true" : undefined
                  }
                  className={`hover:bg-accent hover:text-foreground border-border block border-b px-3 py-2 font-mono text-[11px] tracking-[0.04em] last:border-b-0 ${
                    (sort || "") === option.value
                      ? "text-brand"
                      : "text-subtle-foreground"
                  }`}
                >
                  {option.label}
                </Link>
              ))}
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
