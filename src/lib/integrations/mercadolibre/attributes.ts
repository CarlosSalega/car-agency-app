import type { CategoryAttribute } from "./categories";

/**
 * The bridge between a vehicle row and the attribute array an item needs.
 *
 * Pure on purpose: no network, no database, no clock. The rule that shapes it is
 * **never invent a value**. Mercado Libre rejects a `list`-typed attribute whose
 * value is not one of the category's allowed values, and the rejection is an
 * opaque `400` naming an attribute id. A guessed "SUV" for a `VEHICLE_TYPE` that
 * spells it "Camioneta" is therefore worse than no value at all: it costs a
 * failed publish instead of a clear message.
 *
 * So the output is driven entirely by what the category requires. Each required
 * attribute either has a mapping to a field the vehicle really has, or it is
 * reported in `missing` with the reason, and the caller decides whether that
 * blocks publication. Dropping it silently produces the publish that fails at
 * the API; inventing it produces a wrong listing.
 *
 * The mapping table is short because it only contains what this model can answer
 * unambiguously:
 *
 * | Mercado Libre   | Source        |
 * | --------------- | ------------- |
 * | `BRAND`         | brand name    |
 * | `MODEL`         | model name    |
 * | `TRIM`          | `Car.version` |
 * | `VEHICLE_YEAR`  | `Car.year`    |
 *
 * `Car` also has `color`, `type`, `fuelType`, `transmission`, `kilometers` and
 * `price`, and none of them is mapped here. Their ML counterparts are
 * category-specific enumerated attributes (`COLOR`, `VEHICLE_TYPE`,
 * `FUEL_TYPE`, `TRANSMISSION`, `KILOMETERS`) whose allowed values are not our
 * enum names, so mapping them needs the category's allowed values first. Until
 * then they land in `missing` instead of being stringified into a rejection.
 */

/** The vehicle fields this module reads. `Car` is assignable to it. */
export interface VehicleAttributeSource {
  readonly year: number;
  readonly version?: string | null;
}

/** One entry of the `attributes` array ML accepts on an item. */
export interface MeliAttribute {
  readonly id: string;
  readonly value_name: string;
}

/** Why a required attribute could not be answered. */
export type MissingAttributeReason =
  /** No mapping exists for this attribute id. */
  | "unsupported"
  /** A mapping exists, but the vehicle has no value for it. */
  | "no-value";

export interface MissingAttribute {
  readonly id: string;
  readonly name: string;
  readonly valueType: string | null;
  readonly reason: MissingAttributeReason;
}

export interface BuiltAttributes {
  readonly attributes: MeliAttribute[];
  readonly missing: MissingAttribute[];
}

interface MappingInput {
  readonly car: VehicleAttributeSource;
  readonly brandName: string;
  readonly modelName: string;
}

type AttributeMapper = (input: MappingInput) => string | null;

/** Trimmed, or `null`: a value of spaces is not a value. */
function text(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();

  return trimmed === "" ? null : trimmed;
}

/**
 * Attribute id → the vehicle field that answers it.
 *
 * Keyed by ML's uppercase ids. Adding an entry means proving the value is one ML
 * accepts for that attribute, not merely that a field with a similar name exists.
 */
export const MELI_ATTRIBUTE_MAPPERS: ReadonlyMap<string, AttributeMapper> =
  new Map<string, AttributeMapper>([
    ["BRAND", ({ brandName }) => text(brandName)],
    ["MODEL", ({ modelName }) => text(modelName)],
    ["TRIM", ({ car }) => text(car.version)],
    [
      "VEHICLE_YEAR",
      ({ car }) =>
        Number.isInteger(car.year) && car.year > 0 ? String(car.year) : null,
    ],
  ]);

/**
 * Builds the `attributes` array and the list of requirements it cannot meet.
 *
 * An attribute the category listed twice is sent once: ML rejects a duplicated
 * id, and a category payload with a duplicate is a defect on their side, not
 * ours to propagate.
 */
export function buildAttributes({
  car,
  brandName,
  modelName,
  required,
}: {
  readonly car: VehicleAttributeSource;
  readonly brandName: string;
  readonly modelName: string;
  readonly required: readonly CategoryAttribute[];
}): BuiltAttributes {
  const attributes: MeliAttribute[] = [];
  const missing: MissingAttribute[] = [];
  const seen = new Set<string>();

  for (const attribute of required) {
    if (seen.has(attribute.id)) continue;
    seen.add(attribute.id);

    const mapper = MELI_ATTRIBUTE_MAPPERS.get(attribute.id.toUpperCase());

    if (mapper === undefined) {
      missing.push({
        id: attribute.id,
        name: attribute.name,
        valueType: attribute.valueType,
        reason: "unsupported",
      });
      continue;
    }

    const valueName = mapper({ car, brandName, modelName });

    if (valueName === null) {
      missing.push({
        id: attribute.id,
        name: attribute.name,
        valueType: attribute.valueType,
        reason: "no-value",
      });
      continue;
    }

    attributes.push({ id: attribute.id, value_name: valueName });
  }

  return { attributes, missing };
}
