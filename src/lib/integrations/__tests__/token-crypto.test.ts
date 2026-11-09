import crypto from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  KeyRingError,
  TokenDecryptionError,
  TOKEN_KEYS_ENV,
  decryptToken,
  encryptToken,
  loadKeyRing,
  readPayloadVersion,
} from "../token-crypto";

/**
 * Every key in this file is generated at runtime. Nothing here reads the
 * environment, `.env` or a fixture: a test that needed the deployment's real
 * key would be untestable in CI and would risk printing a credential.
 */
function randomKey(): string {
  return crypto.randomBytes(32).toString("base64");
}

function ringOf(entries: Record<number, string>): string {
  return Object.entries(entries)
    .map(([version, key]) => `v${version}:${key}`)
    .join(",");
}

function tamper(payload: string): string {
  const [version, iv, tag, ciphertext] = payload.split(":");
  const bytes = Buffer.from(ciphertext, "base64");
  bytes[0] ^= 0x01;

  return [version, iv, tag, bytes.toString("base64")].join(":");
}

describe("loadKeyRing", () => {
  it("accepts a single version and reports it as current", () => {
    const key = randomKey();
    const ring = loadKeyRing({ [TOKEN_KEYS_ENV]: ringOf({ 1: key }) });

    expect(ring.currentVersion).toBe(1);
    expect(ring.keys.size).toBe(1);
    expect(ring.keys.get(1)?.toString("base64")).toBe(key);
  });

  it("keeps every listed version and encrypts with the highest", () => {
    const ring = loadKeyRing({
      [TOKEN_KEYS_ENV]: ringOf({ 1: randomKey(), 2: randomKey() }),
    });

    expect(ring.currentVersion).toBe(2);
    expect([...ring.keys.keys()].sort()).toEqual([1, 2]);
    expect(encryptToken("token", ring).startsWith("v2:")).toBe(true);
  });

  it("picks the highest version regardless of the order in the list", () => {
    const ring = loadKeyRing({
      [TOKEN_KEYS_ENV]: ringOf({ 7: randomKey(), 3: randomKey() }),
    });

    expect(ring.currentVersion).toBe(7);
  });

  it("ignores surrounding whitespace on entries", () => {
    const ring = loadKeyRing({
      [TOKEN_KEYS_ENV]: ` v1:${randomKey()} , v2:${randomKey()} `,
    });

    expect(ring.currentVersion).toBe(2);
  });

  it("rejects a missing variable", () => {
    expect(() => loadKeyRing({})).toThrow(KeyRingError);
    expect(() => loadKeyRing({})).toThrow(/TOKEN_ENCRYPTION_KEYS.*not set/);
  });

  it("rejects a blank variable instead of treating it as no encryption", () => {
    expect(() => loadKeyRing({ [TOKEN_KEYS_ENV]: "   " })).toThrow(/not set/);
  });

  it("rejects an entry without a version prefix", () => {
    const key = randomKey();

    expect(() => loadKeyRing({ [TOKEN_KEYS_ENV]: key })).toThrow(
      /entry 1 is malformed/,
    );
  });

  it("rejects an entry whose version is not v<number>", () => {
    expect(() =>
      loadKeyRing({ [TOKEN_KEYS_ENV]: `version1:${randomKey()}` }),
    ).toThrow(/entry 1 is malformed/);
    expect(() => loadKeyRing({ [TOKEN_KEYS_ENV]: `v:${randomKey()}` })).toThrow(
      /entry 1 is malformed/,
    );
  });

  it("rejects a key that is not 32 bytes after decoding", () => {
    const short = crypto.randomBytes(16).toString("base64");

    expect(() => loadKeyRing({ [TOKEN_KEYS_ENV]: `v1:${short}` })).toThrow(
      /decodes to 16 bytes, not 32/,
    );
  });

  it("rejects a duplicate version", () => {
    expect(() =>
      loadKeyRing({
        [TOKEN_KEYS_ENV]:
          ringOf({ 1: randomKey() }) + "," + `v1:${randomKey()}`,
      }),
    ).toThrow(/lists v1 more than once/);
  });

  it("rejects an empty entry produced by a trailing comma", () => {
    expect(() =>
      loadKeyRing({ [TOKEN_KEYS_ENV]: `v1:${randomKey()},` }),
    ).toThrow(/entry 2 is empty/);
  });

  it("never echoes key material in its errors", () => {
    const short = crypto.randomBytes(16).toString("base64");
    const full = randomKey();

    for (const value of [
      `v1:${short}`,
      `not-a-key:${full}`,
      `v1:${full},v1:${full}`,
    ]) {
      let message = "";

      try {
        loadKeyRing({ [TOKEN_KEYS_ENV]: value });
      } catch (error) {
        message = error instanceof Error ? error.message : String(error);
      }

      expect(message).not.toBe("");
      expect(message).not.toContain(short);
      expect(message).not.toContain(full);
    }
  });
});

describe("encryptToken / decryptToken", () => {
  const ring = () =>
    loadKeyRing({ [TOKEN_KEYS_ENV]: ringOf({ 1: randomKey() }) });

  it("round-trips an access token", () => {
    const current = ring();
    const payload = encryptToken("APP_USR-abc-123", current);

    expect(decryptToken(payload, current)).toBe("APP_USR-abc-123");
  });

  it("round-trips an empty string and non-ASCII text", () => {
    const current = ring();

    expect(decryptToken(encryptToken("", current), current)).toBe("");
    expect(
      decryptToken(encryptToken("contraseña-ñ-🔐", current), current),
    ).toBe("contraseña-ñ-🔐");
  });

  it("stores the version and four base64 segments", () => {
    const current = ring();
    const payload = encryptToken("token", current);
    const segments = payload.split(":");

    expect(segments).toHaveLength(4);
    expect(segments[0]).toBe("v1");
    expect(Buffer.from(segments[1], "base64")).toHaveLength(12);
    expect(Buffer.from(segments[2], "base64")).toHaveLength(16);
  });

  it("uses a fresh IV per call, so equal plaintext never yields equal payloads", () => {
    const current = ring();
    const first = encryptToken("same-token", current);
    const second = encryptToken("same-token", current);

    expect(first).not.toBe(second);
    expect(first.split(":")[1]).not.toBe(second.split(":")[1]);
  });

  it("never puts the plaintext in the payload", () => {
    const current = ring();

    expect(encryptToken("super-secret-token", current)).not.toContain(
      "super-secret-token",
    );
  });

  it("throws when one byte of the ciphertext is tampered with", () => {
    const current = ring();
    const payload = encryptToken("token", current);

    expect(() => decryptToken(tamper(payload), current)).toThrow(
      TokenDecryptionError,
    );
  });

  it("throws when the tag is tampered with", () => {
    const current = ring();
    const [version, iv, tag, ciphertext] = encryptToken("token", current).split(
      ":",
    );
    const bytes = Buffer.from(tag, "base64");
    bytes[0] ^= 0x01;

    expect(() =>
      decryptToken(
        [version, iv, bytes.toString("base64"), ciphertext].join(":"),
        current,
      ),
    ).toThrow(TokenDecryptionError);
  });

  it("throws for a payload whose key version is not in the ring", () => {
    const current = ring();
    const future = loadKeyRing({
      [TOKEN_KEYS_ENV]: ringOf({ 1: randomKey(), 2: randomKey() }),
    });
    const payload = encryptToken("token", future);

    expect(payload.startsWith("v2:")).toBe(true);
    expect(() => decryptToken(payload, current)).toThrow(/v2/);
    expect(() => decryptToken(payload, current)).toThrow(TokenDecryptionError);
  });

  it("reports malformed payloads separately from authentication failures", () => {
    const current = ring();

    for (const payload of ["", "token", "v1:a:b", "v1:a:b:c:d"]) {
      try {
        decryptToken(payload, current);
        expect.unreachable("a malformed payload must throw");
      } catch (error) {
        expect(error).toBeInstanceOf(TokenDecryptionError);
        expect((error as TokenDecryptionError).reason).toBe("malformed");
      }
    }
  });

  it("does not pretend to tell a wrong key from a tampered payload", () => {
    // GCM cannot distinguish the two: both fail the tag check. The reason is the
    // same on purpose, so callers do not build a lie into their retry logic.
    const current = ring();
    const other = ring();
    const payload = encryptToken("token", current);

    let wrongKey: TokenDecryptionError | undefined;
    let tampered: TokenDecryptionError | undefined;

    try {
      decryptToken(payload, other);
    } catch (error) {
      wrongKey = error as TokenDecryptionError;
    }

    try {
      decryptToken(tamper(payload), current);
    } catch (error) {
      tampered = error as TokenDecryptionError;
    }

    expect(wrongKey?.reason).toBe("authentication-failed");
    expect(tampered?.reason).toBe("authentication-failed");
  });

  it("never puts the plaintext or the key in an error message", () => {
    const current = ring();
    const payload = encryptToken("APP_USR-secret", current);

    for (const candidate of [tamper(payload), "v9:AAAA:BBBB:CCCC", "garbage"]) {
      let message = "";

      try {
        decryptToken(candidate, current);
      } catch (error) {
        message = error instanceof Error ? error.message : String(error);
      }

      expect(message).not.toBe("");
      expect(message).not.toContain("APP_USR-secret");
      expect(message).not.toContain(
        current.keys.get(1)?.toString("base64") ?? "",
      );
    }
  });
});

describe("readPayloadVersion", () => {
  it("reads the version of a real payload", () => {
    const current = loadKeyRing({
      [TOKEN_KEYS_ENV]: ringOf({ 3: randomKey() }),
    });

    expect(readPayloadVersion(encryptToken("token", current))).toBe(3);
  });

  it("returns null for anything that is not a versioned payload", () => {
    for (const payload of ["", "token", "v:a:b:c", "1:a:b:c", "v1:a:b"]) {
      expect(readPayloadVersion(payload)).toBeNull();
    }
  });
});

describe("rotation", () => {
  it("decrypts a v1 payload after v2 is added, and re-encrypts under v2", () => {
    const v1Key = randomKey();
    const v2Key = randomKey();
    const v1Ring = loadKeyRing({ [TOKEN_KEYS_ENV]: ringOf({ 1: v1Key }) });
    const v2Ring = loadKeyRing({
      [TOKEN_KEYS_ENV]: ringOf({ 1: v1Key, 2: v2Key }),
    });

    const sealedUnderV1 = encryptToken("APP_USR-refresh", v1Ring);

    expect(decryptToken(sealedUnderV1, v2Ring)).toBe("APP_USR-refresh");

    const reencrypted = encryptToken(
      decryptToken(sealedUnderV1, v2Ring),
      v2Ring,
    );

    expect(reencrypted.startsWith("v2:")).toBe(true);
    expect(decryptToken(reencrypted, v2Ring)).toBe("APP_USR-refresh");
  });

  it("still decrypts a v1 payload from a ring that keeps v1 after removing it from service", () => {
    const v1Key = randomKey();
    const v1Ring = loadKeyRing({ [TOKEN_KEYS_ENV]: ringOf({ 1: v1Key }) });
    const v2Only = loadKeyRing({
      [TOKEN_KEYS_ENV]: ringOf({ 2: randomKey() }),
    });

    expect(() => decryptToken(encryptToken("token", v1Ring), v2Only)).toThrow(
      /v1/,
    );
  });
});
