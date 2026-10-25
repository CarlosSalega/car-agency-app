// @vitest-environment node
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { describe, expect, it } from "vitest";

/**
 * Guards the one thing that would silently break every login: the seed and the
 * admin user API hash passwords with `better-auth/crypto`, while the sign-in
 * endpoint verifies with better-auth's own scrypt. If those two ever diverge,
 * nobody can log in and nothing else in the suite would notice.
 */
describe("better-auth password hashing", () => {
  it("verifies a hash it just produced", async () => {
    const hash = await hashPassword("admin1234");

    await expect(verifyPassword({ hash, password: "admin1234" })).resolves.toBe(
      true,
    );
  });

  it("rejects the wrong password", async () => {
    const hash = await hashPassword("admin1234");

    await expect(verifyPassword({ hash, password: "admin1235" })).resolves.toBe(
      false,
    );
  });

  it("salts every hash, so equal passwords do not collide", async () => {
    const first = await hashPassword("admin1234");
    const second = await hashPassword("admin1234");

    expect(first).not.toBe(second);
    await expect(
      verifyPassword({ hash: first, password: "admin1234" }),
    ).resolves.toBe(true);
    await expect(
      verifyPassword({ hash: second, password: "admin1234" }),
    ).resolves.toBe(true);
  });
});
