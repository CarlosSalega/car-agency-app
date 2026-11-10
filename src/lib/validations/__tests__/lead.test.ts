import { describe, expect, it } from "vitest";

import {
  LEAD_HONEYPOT_FIELD,
  leadStatusUpdateSchema,
  leadSubmitSchema,
} from "../lead";

// Neutral fixture values: the shape is what the schema is about, not the digits.
const valid = { name: "Ana Pérez", phone: "351 555 0123", consent: true };

function errorsFor(payload: unknown) {
  const parsed = leadSubmitSchema.safeParse(payload);
  return parsed.success
    ? []
    : parsed.error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`,
      );
}

describe("leadSubmitSchema", () => {
  it("accepts a minimal submission", () => {
    expect(leadSubmitSchema.safeParse(valid).success).toBe(true);
  });

  it("trims the name instead of rejecting surrounding spaces", () => {
    const parsed = leadSubmitSchema.parse({ ...valid, name: "  Ana Pérez  " });

    expect(parsed.name).toBe("Ana Pérez");
  });

  it.each([
    "351 555 0123",
    "+54 9 351 555-0123",
    "(0351) 5550123",
    "3515550123",
  ])("accepts the phone format %s", (phone) => {
    expect(leadSubmitSchema.safeParse({ ...valid, phone }).success).toBe(true);
  });

  it("rejects a phone with too few digits, however it is punctuated", () => {
    // Six digits is the floor: enough to catch "no tengo" and a lone area code.
    expect(errorsFor({ ...valid, phone: "351 55" })).toEqual([
      "phone: El teléfono debe tener al menos 6 dígitos",
    ]);
  });

  it("rejects a missing name", () => {
    expect(errorsFor({ ...valid, name: "" }).join()).toContain(
      "Decinos tu nombre",
    );
  });

  it("treats empty optional fields as absent, not as invalid", () => {
    const parsed = leadSubmitSchema.parse({
      ...valid,
      email: "",
      message: "",
      carSlug: "",
    });

    expect(parsed.email).toBeUndefined();
    expect(parsed.message).toBeUndefined();
    expect(parsed.carSlug).toBeUndefined();
  });

  it("still validates an email when one is given", () => {
    expect(errorsFor({ ...valid, email: "no-es-un-email" }).join()).toContain(
      "Revisá el email",
    );
    expect(
      leadSubmitSchema.safeParse({ ...valid, email: "ana@ejemplo.com" })
        .success,
    ).toBe(true);
  });

  it("rejects a message over the cap", () => {
    expect(errorsFor({ ...valid, message: "x".repeat(1001) }).join()).toContain(
      "El mensaje es demasiado largo",
    );
  });

  it("requires consent to be explicitly true", () => {
    for (const consent of [undefined, false, "true", 1]) {
      expect(errorsFor({ ...valid, consent }).join()).toContain(
        "Necesitamos tu permiso para contactarte",
      );
    }
  });

  it("does not let a submission claim its own honeypot contract", () => {
    // The honeypot is validated in the route, deliberately outside this schema:
    // a filled trap has to answer as success, not as a validation error.
    const parsed = leadSubmitSchema.safeParse({
      ...valid,
      [LEAD_HONEYPOT_FIELD]: "bot",
    });

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data).not.toHaveProperty(
      LEAD_HONEYPOT_FIELD,
    );
  });
});

describe("leadStatusUpdateSchema", () => {
  it("accepts every status of the enum", () => {
    for (const status of ["NEW", "CONTACTED", "NEGOTIATING", "WON", "LOST"]) {
      expect(leadStatusUpdateSchema.safeParse({ status }).success).toBe(true);
    }
  });

  it("rejects an invented status", () => {
    expect(leadStatusUpdateSchema.safeParse({ status: "SOLD" }).success).toBe(
      false,
    );
  });

  it("treats an empty note as absent", () => {
    const parsed = leadStatusUpdateSchema.parse({
      status: "WON",
      notes: "   ",
    });

    expect(parsed.notes).toBeUndefined();
  });
});
