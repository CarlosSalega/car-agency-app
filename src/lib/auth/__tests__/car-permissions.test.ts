import { describe, expect, it } from "vitest";

import { canManageCar } from "../car-permissions";

/**
 * One rule, three call sites: the car edit page and the two write endpoints.
 * It used to live twice in the API and nowhere in the page, which is how a
 * collaborator ended up looking at somebody else's car in a form that would
 * refuse to save.
 */

const owner = { id: "user-1", role: "COLLABORATOR" } as const;
const colleague = { id: "user-2", role: "COLLABORATOR" } as const;
const admin = { id: "user-admin", role: "ADMIN" } as const;

describe("canManageCar", () => {
  it("lets a collaborator manage a car they created", () => {
    expect(canManageCar({ userId: owner.id }, owner)).toBe(true);
  });

  it("refuses a collaborator somebody else's car", () => {
    expect(canManageCar({ userId: owner.id }, colleague)).toBe(false);
  });

  it("lets an administrator manage any car", () => {
    expect(canManageCar({ userId: owner.id }, admin)).toBe(true);
    expect(canManageCar({ userId: null }, admin)).toBe(true);
  });

  it("treats an unowned car as nobody's, so only an administrator touches it", () => {
    expect(canManageCar({ userId: null }, owner)).toBe(false);
  });

  it("does not let a missing owner match a missing session id", () => {
    // A `null === undefined` slip would hand every ownerless row to anyone.
    expect(
      canManageCar({ userId: null }, { id: "", role: "COLLABORATOR" }),
    ).toBe(false);
  });
});
