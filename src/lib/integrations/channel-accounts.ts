import type { Channel, ChannelAccountStatus } from "@generated/prisma/client";

import { prisma } from "@/lib/db";

import type { KeyRing } from "./token-crypto";
import {
  decryptToken,
  encryptToken,
  loadKeyRing,
  TokenDecryptionError,
} from "./token-crypto";

/**
 * Storage for per-channel credentials.
 *
 * Thin on purpose: route handlers and the future sync call these three functions
 * and never handle ciphertext. Everything about how a token is sealed lives in
 * `token-crypto.ts`; everything about how it is stored lives here.
 *
 * The key ring is read from the environment on each call rather than captured at
 * import time, so a rotation only needs a restart, not a rebuild, and a test can
 * set its own keys.
 */

export interface ChannelAccountTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: Date;
}

/** The sealed columns as they come out of the database. */
export interface StoredTokenColumns {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: Date;
}

export type ReadTokensResult =
  | { readonly status: "ok"; readonly tokens: ChannelAccountTokens }
  /** The account cannot be used until somebody reconnects it. */
  | { readonly status: "revoked" };

/**
 * The pure part of `readTokens`: both tokens decrypt, or the account is unusable.
 *
 * Extracted so the decision is testable without a database, and because it is
 * genuinely the rule: a refresh token that cannot be opened means the next
 * refresh fails, so a readable access token alone buys nothing.
 */
export function decryptStoredTokens(
  stored: StoredTokenColumns,
  ring: KeyRing,
): ReadTokensResult {
  try {
    return {
      status: "ok",
      tokens: {
        accessToken: decryptToken(stored.accessToken, ring),
        refreshToken: decryptToken(stored.refreshToken, ring),
        expiresAt: stored.expiresAt,
      },
    };
  } catch (error) {
    if (error instanceof TokenDecryptionError) return { status: "revoked" };

    throw error;
  }
}

/**
 * Seals both tokens and stores them, replacing whatever the account had.
 *
 * Upsert on `[channel, remoteUserId]`: re-linking an account refreshes the
 * tokens instead of leaving a second row that the sync could pick up.
 */
export async function saveTokens({
  channel,
  remoteUserId,
  accessToken,
  refreshToken,
  expiresAt,
}: {
  channel: Channel;
  remoteUserId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}): Promise<void> {
  const ring = loadKeyRing(process.env);

  const sealed = {
    accessToken: encryptToken(accessToken, ring),
    refreshToken: encryptToken(refreshToken, ring),
    expiresAt,
  };

  await prisma.channelAccount.upsert({
    where: {
      channel_remoteUserId: { channel, remoteUserId },
    },
    create: { channel, remoteUserId, ...sealed },
    update: sealed,
  });
}

/**
 * Opens the account's tokens.
 *
 * `null` means the account does not exist. A `revoked` result is persisted as
 * `status: REVOKED` before it is returned, so the panel can show "reconnect
 * needed" instead of an account that looks linked and silently fails.
 */
export async function readTokens(
  accountId: string,
): Promise<ReadTokensResult | null> {
  const stored = await prisma.channelAccount.findUnique({
    where: { id: accountId },
    select: { accessToken: true, refreshToken: true, expiresAt: true },
  });

  if (stored === null) return null;

  const result = decryptStoredTokens(stored, loadKeyRing(process.env));

  if (result.status === "revoked") {
    await markAccountStatus(accountId, "REVOKED");
  }

  return result;
}

export async function markAccountStatus(
  accountId: string,
  status: ChannelAccountStatus,
): Promise<void> {
  await prisma.channelAccount.update({
    where: { id: accountId },
    data: { status },
  });
}
