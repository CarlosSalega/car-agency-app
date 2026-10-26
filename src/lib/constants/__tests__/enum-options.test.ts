import { describe, expect, it } from "vitest";

import { CarType } from "@generated/prisma/enums";
import { CAR_TYPE_OPTIONS } from "../enum-options";

/**
 * A new `CarType` value that never reaches `CAR_TYPE_OPTIONS` silently
 * disappears from the admin car form and the public filter. TypeScript cannot
 * see the gap: the option list is a partial array, not a `Record<CarType, …>`.
 * This test is the only thing that fails when the enum grows and the labels do
 * not.
 */
describe("car type options", () => {
  it("labels every CarType value", () => {
    const labeled = CAR_TYPE_OPTIONS.map((option) => option.value).sort();
    const everyType = Object.values(CarType).sort();

    expect(labeled).toEqual(everyType);
  });

  it("does not repeat a CarType value", () => {
    const values = CAR_TYPE_OPTIONS.map((option) => option.value);

    expect(new Set(values).size).toBe(values.length);
  });
});
