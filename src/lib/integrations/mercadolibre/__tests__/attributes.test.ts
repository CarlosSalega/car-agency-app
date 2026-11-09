import { describe, expect, it } from "vitest";

import { buildAttributes } from "../attributes";
import type { CategoryAttribute } from "../categories";

const CAR = {
  year: 2019,
  version: "1.6 Highline",
};

const BRAND: CategoryAttribute = {
  id: "BRAND",
  name: "Marca",
  valueType: "string",
};
const MODEL: CategoryAttribute = {
  id: "MODEL",
  name: "Modelo",
  valueType: "string",
};
const TRIM: CategoryAttribute = {
  id: "TRIM",
  name: "Versión",
  valueType: "string",
};
const VEHICLE_YEAR: CategoryAttribute = {
  id: "VEHICLE_YEAR",
  name: "Año",
  valueType: "number",
};

describe("buildAttributes", () => {
  it("maps the attributes the vehicle can answer", () => {
    const { attributes, missing } = buildAttributes({
      car: CAR,
      brandName: "Volkswagen",
      modelName: "Golf",
      required: [BRAND, MODEL, TRIM, VEHICLE_YEAR],
    });

    expect(attributes).toEqual([
      { id: "BRAND", value_name: "Volkswagen" },
      { id: "MODEL", value_name: "Golf" },
      { id: "TRIM", value_name: "1.6 Highline" },
      { id: "VEHICLE_YEAR", value_name: "2019" },
    ]);
    expect(missing).toEqual([]);
  });

  it("sends the version as TRIM, on its own", () => {
    const { attributes } = buildAttributes({
      car: { year: 2021, version: "GTI" },
      brandName: "Volkswagen",
      modelName: "Golf",
      required: [TRIM],
    });

    expect(attributes).toEqual([{ id: "TRIM", value_name: "GTI" }]);
  });

  it("puts a required attribute the vehicle has no value for in missing", () => {
    const { attributes, missing } = buildAttributes({
      car: { year: 2019, version: null },
      brandName: "Volkswagen",
      modelName: "Golf",
      required: [BRAND, TRIM],
    });

    expect(attributes).toEqual([{ id: "BRAND", value_name: "Volkswagen" }]);
    expect(missing).toEqual([{ ...TRIM, reason: "no-value" }]);
  });

  it("puts a required attribute it has no mapping for in missing instead of inventing one", () => {
    const doors: CategoryAttribute = {
      id: "DOORS",
      name: "Puertas",
      valueType: "number",
    };

    const { attributes, missing } = buildAttributes({
      car: CAR,
      brandName: "Volkswagen",
      modelName: "Golf",
      required: [BRAND, doors],
    });

    expect(attributes).toEqual([{ id: "BRAND", value_name: "Volkswagen" }]);
    expect(missing).toEqual([{ ...doors, reason: "unsupported" }]);
  });

  it("returns nothing to send when the category requires nothing", () => {
    const { attributes, missing } = buildAttributes({
      car: CAR,
      brandName: "Volkswagen",
      modelName: "Golf",
      required: [],
    });

    expect(attributes).toEqual([]);
    expect(missing).toEqual([]);
  });

  it("does not repeat an attribute the category listed twice", () => {
    const { attributes } = buildAttributes({
      car: CAR,
      brandName: "Volkswagen",
      modelName: "Golf",
      required: [BRAND, BRAND],
    });

    expect(attributes).toEqual([{ id: "BRAND", value_name: "Volkswagen" }]);
  });

  it("treats a blank name as no value rather than sending spaces", () => {
    const { attributes, missing } = buildAttributes({
      car: { year: 2019, version: "   " },
      brandName: "",
      modelName: "Golf",
      required: [BRAND, TRIM],
    });

    expect(attributes).toEqual([]);
    expect(missing.map((entry) => entry.id)).toEqual(["BRAND", "TRIM"]);
  });
});
