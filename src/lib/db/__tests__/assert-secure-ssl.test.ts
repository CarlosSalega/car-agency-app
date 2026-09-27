import { describe, expect, it } from "vitest";

import { findInsecureSslMode } from "@/lib/db/assert-secure-ssl";

const connectionString = (query?: string) =>
  `postgres://user:password@pooled.db.prisma.io:5432/postgres${query ?? ""}`;

describe("findInsecureSslMode", () => {
  it("reports the pg aliases that lose their meaning in pg v9", () => {
    for (const mode of ["require", "prefer", "verify-ca"]) {
      expect(findInsecureSslMode(connectionString(`?sslmode=${mode}`))).toBe(
        mode,
      );
    }
  });

  it("reports the modes that never encrypted the connection", () => {
    for (const mode of ["allow", "disable"]) {
      expect(findInsecureSslMode(connectionString(`?sslmode=${mode}`))).toBe(
        mode,
      );
    }
  });

  it("reports a missing sslmode, which requests no encryption at all", () => {
    expect(findInsecureSslMode(connectionString())).toBe("<missing>");
    expect(findInsecureSslMode(connectionString("?schema=public"))).toBe(
      "<missing>",
    );
  });

  it("accepts verify-full", () => {
    expect(
      findInsecureSslMode(connectionString("?sslmode=verify-full")),
    ).toBeNull();
  });

  it("accepts verify-full among other query parameters", () => {
    expect(
      findInsecureSslMode(
        connectionString("?sslmode=verify-full&connection_limit=5"),
      ),
    ).toBeNull();
  });

  it("refuses a differently cased verify-full instead of guessing", () => {
    expect(findInsecureSslMode(connectionString("?sslmode=VERIFY-FULL"))).toBe(
      "VERIFY-FULL",
    );
  });

  it("refuses an empty sslmode", () => {
    expect(findInsecureSslMode(connectionString("?sslmode="))).toBe("");
  });

  it("refuses a connection string that is not a URL", () => {
    expect(findInsecureSslMode("not a connection string")).toBe(
      "<unparseable>",
    );
  });
});
