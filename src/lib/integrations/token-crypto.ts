import crypto from "node:crypto";

/**
 * Sealing for channel credentials.
 *
 * An access or refresh token lets anyone publish as the agency on the
 * marketplace, so it never reaches the database in the clear: a dump, a backup or
 * a screenshot of the table is not enough to use it.
 *
 * Cipher: AES-256-GCM, one random 12-byte IV per record, authenticated. The
 * stored payload is `v<version>:<iv>:<tag>:<ciphertext>`, every segment in
 * base64. The version prefix is what makes rotation possible: the highest
 * version in the key ring encrypts, and any version still listed decrypts, so a
 * key can be replaced without a migration that cannot read the old rows.
 *
 * The key material never appears in an error message here. Errors name the
 * version or the position in the list, which is enough to fix a configuration
 * and useless to whoever reads a log.
 *
 * Blocking detail: GCM cannot tell a wrong key from a tampered payload — both
 * fail the same tag check. `TokenDecryptionError.reason` therefore reports
 * `authentication-failed` for both instead of inventing a distinction the cipher
 * does not make.
 */

export const TOKEN_KEYS_ENV = "TOKEN_ENCRYPTION_KEYS";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;
const SEPARATOR = ":";
const VERSION_PREFIX = /^v(\d+)$/;

export interface KeyRing {
  /** The version new payloads are sealed with. */
  readonly currentVersion: number;
  /** Every version that can still be opened, keyed by version number. */
  readonly keys: ReadonlyMap<number, Buffer>;
}

/** A key ring that cannot be built. Always a configuration problem. */
export class KeyRingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KeyRingError";
  }
}

export type TokenDecryptionReason =
  | "malformed"
  | "unknown-version"
  | "authentication-failed";

/**
 * A payload that cannot be opened. Callers treat it as "the account needs to be
 * reconnected", never as a crash: one unreadable token must not take a page or a
 * sync run down.
 */
export class TokenDecryptionError extends Error {
  readonly reason: TokenDecryptionReason;

  constructor(reason: TokenDecryptionReason, message: string) {
    super(message);
    this.name = "TokenDecryptionError";
    this.reason = reason;
  }
}

/**
 * Parses `TOKEN_ENCRYPTION_KEYS`: a comma-separated list of
 * `v<number>:<base64 32 bytes>`.
 *
 * Every rejection names the problem. None echoes the entry, because an entry is
 * key material.
 */
export function loadKeyRing(
  source: Record<string, string | undefined>,
): KeyRing {
  const raw = source[TOKEN_KEYS_ENV];

  if (raw === undefined || raw.trim() === "") {
    throw new KeyRingError(
      `${TOKEN_KEYS_ENV} is not set. Add at least one v<number>:<base64 32 bytes> entry so tokens can be sealed.`,
    );
  }

  const keys = new Map<number, Buffer>();

  raw.split(",").forEach((rawEntry, index) => {
    const position = index + 1;
    const entry = rawEntry.trim();

    if (entry === "") {
      throw new KeyRingError(
        `${TOKEN_KEYS_ENV} entry ${position} is empty. Remove the extra comma.`,
      );
    }

    const separator = entry.indexOf(SEPARATOR);
    const versionMatch =
      separator === -1 ? null : VERSION_PREFIX.exec(entry.slice(0, separator));
    const keyPart = separator === -1 ? "" : entry.slice(separator + 1);

    if (versionMatch === null || separator === -1 || keyPart === "") {
      throw new KeyRingError(
        `${TOKEN_KEYS_ENV} entry ${position} is malformed: expected v<number>:<base64 32 bytes>.`,
      );
    }

    const version = Number.parseInt(versionMatch[1], 10);

    if (keys.has(version)) {
      throw new KeyRingError(
        `${TOKEN_KEYS_ENV} lists v${version} more than once. Keep exactly one key per version.`,
      );
    }

    const key = Buffer.from(keyPart, "base64");

    if (key.length !== KEY_BYTES) {
      throw new KeyRingError(
        `${TOKEN_KEYS_ENV} entry ${position} (v${version}) decodes to ${key.length} bytes, not ${KEY_BYTES}. The key must be a base64-encoded 32-byte value, e.g. the output of "openssl rand -base64 32".`,
      );
    }

    keys.set(version, key);
  });

  if (keys.size === 0) {
    throw new KeyRingError(
      `${TOKEN_KEYS_ENV} has no usable entries. Add at least one v<number>:<base64 32 bytes> entry so tokens can be sealed.`,
    );
  }

  return {
    currentVersion: Math.max(...keys.keys()),
    keys,
  };
}

/** Seals `plain` with the ring's current version. */
export function encryptToken(plain: string, ring: KeyRing): string {
  const key = ring.keys.get(ring.currentVersion);

  if (key === undefined) {
    throw new KeyRingError(
      `The current key version v${ring.currentVersion} is missing from the key ring.`,
    );
  }

  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);

  return [
    `v${ring.currentVersion}`,
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    ciphertext.toString("base64"),
  ].join(SEPARATOR);
}

/** Opens `payload` with whichever version it names. */
export function decryptToken(payload: string, ring: KeyRing): string {
  const parsed = parsePayload(payload);

  if (parsed === null) {
    throw new TokenDecryptionError(
      "malformed",
      "The stored token is not a valid sealed payload: expected v<version>:<iv>:<tag>:<ciphertext> in base64.",
    );
  }

  const key = ring.keys.get(parsed.version);

  if (key === undefined) {
    throw new TokenDecryptionError(
      "unknown-version",
      `The stored token was sealed with key version v${parsed.version}, which is not in ${TOKEN_KEYS_ENV}. Re-add that key to read it, or reconnect the account.`,
    );
  }

  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, key, parsed.iv);
    decipher.setAuthTag(parsed.tag);

    return Buffer.concat([
      decipher.update(parsed.ciphertext),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new TokenDecryptionError(
      "authentication-failed",
      "The stored token failed its integrity check, so it was sealed with a different key or has been modified. Reconnect the account.",
    );
  }
}

/**
 * The version a payload was sealed with, without opening it. `null` for anything
 * that is not a versioned payload.
 *
 * Exists for the rotation script: it has to count what is outdated before it
 * decides anything, and it must not need a readable token to do it.
 */
export function readPayloadVersion(payload: string): number | null {
  const parsed = parsePayload(payload);

  return parsed === null ? null : parsed.version;
}

interface ParsedPayload {
  readonly version: number;
  readonly iv: Buffer;
  readonly tag: Buffer;
  readonly ciphertext: Buffer;
}

function parsePayload(payload: string): ParsedPayload | null {
  const segments = payload.split(SEPARATOR);

  if (segments.length !== 4) return null;

  const [versionPart, ivPart, tagPart, ciphertextPart] = segments;
  const versionMatch = VERSION_PREFIX.exec(versionPart);

  if (versionMatch === null || tagPart === "" || ivPart === "") return null;

  const iv = Buffer.from(ivPart, "base64");

  if (iv.length !== IV_BYTES) return null;

  const tag = Buffer.from(tagPart, "base64");

  if (tag.length !== TAG_BYTES) return null;

  return {
    version: Number.parseInt(versionMatch[1], 10),
    iv,
    tag,
    // An empty plaintext seals to an empty ciphertext, which is valid.
    ciphertext: Buffer.from(ciphertextPart, "base64"),
  };
}
