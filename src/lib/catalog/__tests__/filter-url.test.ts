import { describe, expect, it } from "vitest";

import { clearFilters, toggleFacet, withParam } from "@/lib/catalog/filter-url";

/**
 * The filter bar is a set of links, so the URL is the only state the catalog has.
 * That makes this module the whole behaviour: what a chip does when you touch it
 * again, what happens to the model when the brand changes, and what "limpiar"
 * means. It is pure on purpose — the component just renders links.
 */

const params = (query: string) => new URLSearchParams(query);

describe("toggleFacet", () => {
  it("adds the value when the facet is empty", () => {
    expect(toggleFacet(params(""), "type", "SUV")).toBe("/catalogo?type=SUV");
  });

  it("removes the value when it is already active", () => {
    expect(toggleFacet(params("type=SUV"), "type", "SUV")).toBe("/catalogo");
  });

  it("replaces the value instead of adding a second one", () => {
    expect(toggleFacet(params("type=SUV"), "type", "Pickup")).toBe(
      "/catalogo?type=Pickup",
    );
  });

  it("keeps the other facets untouched", () => {
    expect(toggleFacet(params("fuel=Nafta&type=SUV"), "type", "Pickup")).toBe(
      "/catalogo?fuel=Nafta&type=Pickup",
    );
  });

  it("drops the model when the brand changes", () => {
    // Un modelo de Volkswagen no existe en Toyota: dejarlo filtraría por nada.
    expect(toggleFacet(params("brand=vw&model=taos"), "brand", "toyota")).toBe(
      "/catalogo?brand=toyota",
    );
  });

  it("resets the page, because page 3 of another filter is not a page", () => {
    expect(toggleFacet(params("type=SUV&page=3"), "type", "Pickup")).toBe(
      "/catalogo?type=Pickup",
    );
  });

  it("keeps the text search", () => {
    expect(toggleFacet(params("q=hilux"), "type", "Pickup")).toBe(
      "/catalogo?q=hilux&type=Pickup",
    );
  });
});

describe("withParam", () => {
  it("sets a value", () => {
    expect(withParam(params("type=SUV"), "minYear", "2020")).toBe(
      "/catalogo?type=SUV&minYear=2020",
    );
  });

  it("removes the param when the value is empty", () => {
    expect(withParam(params("type=SUV&minYear=2020"), "minYear", "")).toBe(
      "/catalogo?type=SUV",
    );
  });

  it("removes the param when the value is the all-value", () => {
    expect(withParam(params("maxPrice=30000000"), "maxPrice", "all")).toBe(
      "/catalogo",
    );
  });

  it("resets the page", () => {
    expect(withParam(params("page=4"), "minYear", "2020")).toBe(
      "/catalogo?minYear=2020",
    );
  });
});

describe("clearFilters", () => {
  it("goes back to the bare catalog", () => {
    expect(
      clearFilters(params("brand=vw&model=taos&type=SUV&q=hilux&page=2")),
    ).toBe("/catalogo");
  });

  it("does not leave a trailing question mark", () => {
    expect(clearFilters(params(""))).toBe("/catalogo");
  });
});
