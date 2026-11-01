import crypto from "node:crypto";

/**
 * Sealing for Mercado Libre tokens.
 *
 * A refresh token is a credential that can publish on the dealership's behalf,
 * so it never reaches the database in the clear: a dump, a backup or a screenshot
 * of the table is not enough to use it.
 *
 * AES-256-GCM gives confidentiality and detects tampering. The key is derived
 * from the configured secret instead of being used raw, so a short secret still
 * yields a 256-bit key.
 */

const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";
const KEY_SALT = "meli-token-v1";
const IV_BYTES = 12;

function deriveKey(secret: string): Buffer {
  // scrypt with a fixed salt is deliberate: the same secret must derive the same
  // key across processes and restarts, or every stored token becomes unreadable.
  return crypto.scryptSync(secret, KEY_SALT, 32);
}

export function sealValue(plaintext: string, secret: string): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, deriveKey(secret), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

/**
 * Returns `null` for anything unreadable — a rotated secret, a truncated column,
 * a tampered value. Callers treat that as "re-link the account" rather than as a
 * crash, because a broken token must not take a page down.
 */
export function openValue(sealed: string, secret: string): string | null {
  const parts = sealed.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) return null;

  const [, ivPart, tagPart, dataPart] = parts;

  try {
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      deriveKey(secret),
      Buffer.from(ivPart, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));

    return Buffer.concat([
      decipher.update(Buffer.from(dataPart, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}
