/**
 * The catalog's filter state, as URLs.
 *
 * The filter bar is a set of links: no client state, no hidden inputs to keep in
 * sync, and every filtered view is shareable and survives the back button. That
 * makes this module the whole behaviour of the bar, and the reason it is pure.
 *
 * Three rules that are easy to get wrong and are pinned by tests:
 *
 * 1. **Touching the active chip clears it.** A chip is a toggle, so the same link
 *    both sets and unsets.
 * 2. **Changing the brand drops the model.** A Volkswagen model does not exist in
 *    Toyota, and a leftover `model` in the URL filters against nothing.
 * 3. **Any change resets `page`.** Page 3 of a different filter is not a page.
 */

const BASE = "/catalogo";

/** Values that mean "no filter" for the range fields. */
const EMPTY_VALUES = new Set(["", "all", "todas", "todos"]);

function toHref(params: URLSearchParams): string {
  const query = params.toString();
  return query ? `${BASE}?${query}` : BASE;
}

/**
 * Sets a facet to a value, or removes it when the value is empty.
 *
 * `brand` also clears `model`: the dependency is real, and the alternative is a
 * URL that returns zero results with no explanation.
 */
export function withParam(
  current: URLSearchParams,
  key: string,
  value: string,
): string {
  const params = new URLSearchParams(current);

  if (EMPTY_VALUES.has(value.trim())) {
    params.delete(key);
  } else {
    params.set(key, value.trim());
  }

  // `page` siempre, porque cualquier cambio lo invalida. Y el modelo cuando cambia
  // la marca: se limpia **después** de escribir el valor nuevo, nunca la clave
  // recién seteada (el primer intento hacía exactamente eso y borraba el filtro).
  params.delete("page");
  if (key === "brand") params.delete("model");

  return toHref(params);
}

/** A chip: the same value removes it, a different one replaces it. */
export function toggleFacet(
  current: URLSearchParams,
  key: string,
  value: string,
): string {
  const active = current.get(key) === value;
  return withParam(current, key, active ? "" : value);
}

/** Back to the unfiltered catalog, text search included. */
export function clearFilters(current: URLSearchParams): string {
  const params = new URLSearchParams(current);
  for (const key of [...params.keys()]) params.delete(key);
  return toHref(params);
}

/** The filters that are active, for the removable chips row. */
export function activeFilters(current: URLSearchParams): {
  key: string;
  value: string;
  label: string;
  href: string;
}[] {
  const labels: Record<string, string> = {
    type: "Tipo",
    fuel: "Combustible",
    transmission: "Caja",
    brand: "Marca",
    model: "Modelo",
    minYear: "Año desde",
    maxYear: "Año hasta",
    minPrice: "Precio desde",
    maxPrice: "Precio hasta",
    q: "Búsqueda",
  };

  return [...current.entries()]
    .filter(([key]) => key in labels)
    .map(([key, value]) => ({
      key,
      value,
      label: labels[key],
      href: withParam(current, key, ""),
    }));
}
