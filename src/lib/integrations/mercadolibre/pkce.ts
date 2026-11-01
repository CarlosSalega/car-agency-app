import crypto from "node:crypto";

/**
 * PKCE and CSRF protection for the OAuth dance.
 *
 * Mercado Libre's documented authorization URL takes `code_challenge` and
 * `code_challenge_method`, so the verifier is part of the flow rather than an
 * extra. It proves that the client redeeming the code is the one that started the
 * flow, which matters here because the callback is a public URL.
 *
 * `state` is the anti-CSRF half: without it, an attacker could hand an admin a
 * callback URL carrying *their* code and silently link the wrong ML account.
 */

/** RFC 7636 allows 43-128 characters; 32 random bytes encode to 43. */
export function createCodeVerifier(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/** S256 only: `plain` is allowed by the RFC but pointless. */
export function createCodeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

export function createState(): string {
  return crypto.randomBytes(24).toString("base64url");
}

/** Constant-time comparison, so a callback cannot be brute-forced byte by byte. */
export function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);

  if (a.length !== b.length) return false;

  return crypto.timingSafeEqual(a, b);
}
