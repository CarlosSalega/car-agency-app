import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The real `@/lib/db` throws while it is evaluated unless DATABASE_URL is set,
 * and this suite must not touch a database. The fake below is the module's only
 * dependency on storage, so the decisions under test — what gets encrypted, when
 * an account is marked REVOKED — stay reachable without one.
 */
const db = vi.hoisted(() => ({
  upsert: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: { channelAccount: { ...db } },
}));

import {
  decryptStoredTokens,
  markAccountStatus,
  readTokens,
  saveTokens,
} from "../channel-accounts";
import { encryptToken, loadKeyRing, TOKEN_KEYS_ENV } from "../token-crypto";

function randomKey(): string {
  return crypto.randomBytes(32).toString("base64");
}

const EXPIRES_AT = new Date("2026-11-10T12:00:00.000Z");

beforeEach(() => {
  db.upsert.mockReset();
  db.findUnique.mockReset();
  db.update.mockReset();
  db.upsert.mockResolvedValue({});
  db.update.mockResolvedValue({});
});

describe("saveTokens", () => {
  it("encrypts both tokens and upserts on the channel + remote user unique", async () => {
    process.env[TOKEN_KEYS_ENV] = `v1:${randomKey()}`;

    await saveTokens({
      channel: "MERCADOLIBRE",
      remoteUserId: "123456789",
      accessToken: "APP_USR-access",
      refreshToken: "TG-REFRESH",
      expiresAt: EXPIRES_AT,
    });

    expect(db.upsert).toHaveBeenCalledTimes(1);

    const args = db.upsert.mock.calls[0][0];
    expect(args.where).toEqual({
      channel_remoteUserId: {
        channel: "MERCADOLIBRE",
        remoteUserId: "123456789",
      },
    });
    expect(args.create.channel).toBe("MERCADOLIBRE");
    expect(args.create.remoteUserId).toBe("123456789");
    expect(args.create.expiresAt).toEqual(EXPIRES_AT);

    const serialized = JSON.stringify(args);
    expect(serialized).not.toContain("APP_USR-access");
    expect(serialized).not.toContain("TG-REFRESH");
    expect(args.create.accessToken.startsWith("v1:")).toBe(true);
    expect(args.create.refreshToken.startsWith("v1:")).toBe(true);
  });

  it("seals the same token differently on save, so equal values are not obvious", async () => {
    process.env[TOKEN_KEYS_ENV] = `v1:${randomKey()}`;

    const save = () =>
      saveTokens({
        channel: "MERCADOLIBRE",
        remoteUserId: "123456789",
        accessToken: "APP_USR-access",
        refreshToken: "TG-REFRESH",
        expiresAt: EXPIRES_AT,
      });

    await save();
    await save();

    const first = db.upsert.mock.calls[0][0].create.accessToken;
    const second = db.upsert.mock.calls[1][0].create.accessToken;

    expect(first).not.toBe(second);
  });
});

describe("readTokens", () => {
  it("returns decrypted tokens for a stored account", async () => {
    process.env[TOKEN_KEYS_ENV] = `v1:${randomKey()}`;
    const ring = loadKeyRing(process.env);

    db.findUnique.mockResolvedValue({
      id: "account-1",
      accessToken: encryptToken("APP_USR-access", ring),
      refreshToken: encryptToken("TG-REFRESH", ring),
      expiresAt: EXPIRES_AT,
    });

    await expect(readTokens("account-1")).resolves.toEqual({
      status: "ok",
      tokens: {
        accessToken: "APP_USR-access",
        refreshToken: "TG-REFRESH",
        expiresAt: EXPIRES_AT,
      },
    });
    expect(db.update).not.toHaveBeenCalled();
  });

  it("marks the account REVOKED and reports it when decryption fails", async () => {
    process.env[TOKEN_KEYS_ENV] = `v1:${randomKey()}`;
    // Sealed under a key that is not in the ring: the shape a rotated or lost
    // key leaves behind.
    const foreign = loadKeyRing({ [TOKEN_KEYS_ENV]: `v1:${randomKey()}` });

    db.findUnique.mockResolvedValue({
      id: "account-1",
      accessToken: encryptToken("APP_USR-access", foreign),
      refreshToken: encryptToken("TG-REFRESH", foreign),
      expiresAt: EXPIRES_AT,
    });

    await expect(readTokens("account-1")).resolves.toEqual({
      status: "revoked",
    });

    expect(db.update).toHaveBeenCalledTimes(1);
    expect(db.update).toHaveBeenCalledWith({
      where: { id: "account-1" },
      data: { status: "REVOKED" },
    });
  });

  it("returns null for an account that does not exist", async () => {
    process.env[TOKEN_KEYS_ENV] = `v1:${randomKey()}`;
    db.findUnique.mockResolvedValue(null);

    await expect(readTokens("missing")).resolves.toBeNull();
    expect(db.update).not.toHaveBeenCalled();
  });

  it("never returns the ciphertext or the key in a revoked result", async () => {
    process.env[TOKEN_KEYS_ENV] = `v1:${randomKey()}`;
    const foreign = loadKeyRing({ [TOKEN_KEYS_ENV]: `v1:${randomKey()}` });
    const sealed = encryptToken("APP_USR-access", foreign);

    db.findUnique.mockResolvedValue({
      id: "account-1",
      accessToken: sealed,
      refreshToken: sealed,
      expiresAt: EXPIRES_AT,
    });

    const result = await readTokens("account-1");

    expect(JSON.stringify(result)).not.toContain(sealed);
  });
});

describe("markAccountStatus", () => {
  it("writes the status and nothing else", async () => {
    await markAccountStatus("account-1", "EXPIRED");

    expect(db.update).toHaveBeenCalledWith({
      where: { id: "account-1" },
      data: { status: "EXPIRED" },
    });
  });
});

describe("decryptStoredTokens", () => {
  const ring = () => loadKeyRing({ [TOKEN_KEYS_ENV]: `v1:${randomKey()}` });

  it("is the pure decision behind readTokens: open when both tokens decrypt", () => {
    const current = ring();

    expect(
      decryptStoredTokens(
        {
          accessToken: encryptToken("access", current),
          refreshToken: encryptToken("refresh", current),
          expiresAt: EXPIRES_AT,
        },
        current,
      ),
    ).toEqual({
      status: "ok",
      tokens: {
        accessToken: "access",
        refreshToken: "refresh",
        expiresAt: EXPIRES_AT,
      },
    });
  });

  it("gives up when either token is unreadable, not only the access token", () => {
    const current = ring();
    const foreign = ring();

    expect(
      decryptStoredTokens(
        {
          accessToken: encryptToken("access", foreign),
          refreshToken: encryptToken("refresh", current),
          expiresAt: EXPIRES_AT,
        },
        current,
      ),
    ).toEqual({ status: "revoked" });
    expect(
      decryptStoredTokens(
        {
          accessToken: encryptToken("access", current),
          refreshToken: encryptToken("refresh", foreign),
          expiresAt: EXPIRES_AT,
        },
        current,
      ),
    ).toEqual({ status: "revoked" });
  });
});
