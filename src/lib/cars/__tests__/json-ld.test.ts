import { describe, expect, it } from "vitest";

import type { JsonLdCar } from "../json-ld";
import { AVAILABILITY_BY_STATUS, buildCarJsonLd } from "../json-ld";

const car: JsonLdCar = {
  id: "car-1",
  title: "Volkswagen Taos Highline 2025",
  slug: "volkswagen-taos-2025",
  images: ["taos-1", "taos-2"],
  year: 2025,
  kilometers: 12000,
  type: "SUV",
  fuelType: "GASOLINE",
  transmission: "AUTOMATIC",
  currency: "ARS",
  price: 39500000,
  status: "AVAILABLE",
  color: "Gris",
  version: "Highline 1.4 TSI",
  description: "Único dueño, service oficial.",
  brand: { name: "Volkswagen" },
  model: { name: "Taos" },
};

const options = {
  siteUrl: "https://glautos.ar",
  dealerName: "GL Autos",
  imageUrl: (key: string) => `https://cdn.example/${key}.webp`,
  fallbackImageUrl: "https://glautos.ar/placeholder.webp",
};

function build(overrides: Partial<JsonLdCar> = {}) {
  return buildCarJsonLd({ ...car, ...overrides }, options);
}

describe("buildCarJsonLd", () => {
  it("describes the car as a Vehicle with its identity fields", () => {
    const jsonLd = build();

    expect(jsonLd).toMatchObject({
      "@context": "https://schema.org",
      "@type": "Vehicle",
      name: "Volkswagen Taos Highline 2025",
      sku: "car-1",
      url: "https://glautos.ar/autos/volkswagen-taos-2025",
      brand: { "@type": "Brand", name: "Volkswagen" },
      model: "Taos",
      vehicleModelDate: "2025",
    });
  });

  it("translates the enums into the same words the page shows", () => {
    const jsonLd = build();

    expect(jsonLd.bodyType).toBe("SUV");
    expect(jsonLd.fuelType).toBe("Nafta");
    expect(jsonLd.vehicleTransmission).toBe("Automático");
  });

  it("publishes mileage with the kilometres unit code and an absolute image list", () => {
    const jsonLd = build();

    expect(jsonLd.mileageFromOdometer).toEqual({
      "@type": "QuantitativeValue",
      value: 12000,
      unitCode: "KMT",
    });
    expect(jsonLd.image).toEqual([
      "https://cdn.example/taos-1.webp",
      "https://cdn.example/taos-2.webp",
    ]);
  });

  it("falls back to the placeholder image when the car has no photos", () => {
    expect(build({ images: [] }).image).toEqual([
      "https://glautos.ar/placeholder.webp",
    ]);
  });

  it("carries the price and the currency in the offer", () => {
    expect(build().offers).toMatchObject({
      "@type": "Offer",
      price: 39500000,
      priceCurrency: "ARS",
      seller: { "@type": "AutoDealer", name: "GL Autos" },
    });
  });

  it.each([
    ["AVAILABLE", "https://schema.org/InStock"],
    ["BY_APPOINTMENT", "https://schema.org/LimitedAvailability"],
    ["RESERVED", "https://schema.org/OutOfStock"],
    ["SOLD", "https://schema.org/SoldOut"],
    ["INACTIVE", "https://schema.org/OutOfStock"],
  ] as const)("maps status %s to %s", (status, availability) => {
    expect(build({ status }).offers).toMatchObject({ availability });
  });

  it("covers every status of the enum, so a new one cannot slip through", () => {
    expect(Object.keys(AVAILABILITY_BY_STATUS).sort()).toEqual([
      "AVAILABLE",
      "BY_APPOINTMENT",
      "INACTIVE",
      "RESERVED",
      "SOLD",
    ]);
  });

  it("treats a zero-kilometre car as new and anything else as used", () => {
    expect(build({ kilometers: 0 }).itemCondition).toBe(
      "https://schema.org/NewCondition",
    );
    expect(build({ kilometers: 1 }).itemCondition).toBe(
      "https://schema.org/UsedCondition",
    );
  });

  it("never publishes the licence plate, which identifies a real car and owner", () => {
    // `patent` is a column on Car. If someone ever passes the whole row, this
    // must still not leak it.
    const serialized = JSON.stringify(
      buildCarJsonLd(
        { ...car, ...({ patent: "AB123CD" } as Partial<JsonLdCar>) },
        options,
      ),
    );

    expect(serialized).not.toContain("AB123CD");
    expect(serialized).not.toContain("patent");
  });

  it("omits optional fields instead of publishing nulls", () => {
    const jsonLd = build({ color: null, version: null });
    const serialized = JSON.stringify(jsonLd);

    expect(jsonLd).not.toHaveProperty("color");
    expect(jsonLd).not.toHaveProperty("vehicleConfiguration");
    expect(serialized).not.toContain("null");
  });

  it("writes its own description when the car has none", () => {
    const jsonLd = build({ description: "   " });

    expect(String(jsonLd.description)).toContain("12.000 km");
    expect(String(jsonLd.description)).toContain("Nafta");
  });

  it("does not double the slash when the site url ends with one", () => {
    const jsonLd = buildCarJsonLd(car, {
      ...options,
      siteUrl: "https://glautos.ar/",
    });

    expect(jsonLd.url).toBe("https://glautos.ar/autos/volkswagen-taos-2025");
  });
});
