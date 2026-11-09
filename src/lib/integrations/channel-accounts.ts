import type { Channel, ChannelAccountStatus } from "@generated/prisma/client";

import { prisma } from "@/lib/db";

import type { KeyRing } from "./token-crypto";
import {
  decryptToken,
  encryptToken,
  KeyRingError,
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
 *
 * `remoteNickname` and `siteId` are display data the provider gave us at link
 * time (a Mercado Libre nickname and site, later a Facebook page name). They are
 * optional, and a provider that says nothing stores `null`: an empty string would
 * render as a blank line in the panel.
 */
export async function saveTokens({
  channel,
  remoteUserId,
  remoteNickname,
  siteId,
  accessToken,
  refreshToken,
  expiresAt,
}: {
  channel: Channel;
  remoteUserId: string;
  remoteNickname?: string | null;
  siteId?: string | null;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}): Promise<void> {
  const ring = loadKeyRing(process.env);

  const sealed = {
    accessToken: encryptToken(accessToken, ring),
    refreshToken: encryptToken(refreshToken, ring),
    expiresAt,
    remoteNickname: blankToNull(remoteNickname),
    siteId: blankToNull(siteId),
  };

  await prisma.channelAccount.upsert({
    where: {
      channel_remoteUserId: { channel, remoteUserId },
    },
    create: { channel, remoteUserId, ...sealed },
    update: sealed,
  });
}

/** `null` for "the provider did not tell us", never an empty or blank string. */
function blankToNull(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;

  return value.trim() === "" ? null : value;
}

/** The identity of one linked account, as a panel needs to show it. */
export interface ConnectedChannelAccount {
  readonly id: string;
  readonly remoteUserId: string;
  readonly remoteNickname: string | null;
  readonly siteId: string | null;
  readonly expiresAt: Date;
}

/**
 * The channel's linked account, or `null` when it is not linked.
 *
 * Only `CONNECTED` counts as linked: an `EXPIRED` or `REVOKED` row is a record of
 * what went wrong, and reporting it as "vinculada" would hide the reconnect the
 * admin has to do. Deliberately reads identifiers only and never opens a token,
 * so a page can call it without touching the key ring.
 */
export async function readConnectedAccount(
  channel: Channel,
): Promise<ConnectedChannelAccount | null> {
  const row = await prisma.channelAccount.findFirst({
    where: { channel, status: "CONNECTED" },
    select: {
      id: true,
      remoteUserId: true,
      remoteNickname: true,
      siteId: true,
      expiresAt: true,
    },
  });

  if (row === null) return null;

  // Projected explicitly rather than returned as-is: `select` keeps the sealed
  // columns out of the query, and this keeps them out of the result even if the
  // row ever arrives with more than it should.
  return {
    id: row.id,
    remoteUserId: row.remoteUserId,
    remoteNickname: row.remoteNickname,
    siteId: row.siteId,
    expiresAt: row.expiresAt,
  };
}

/**
 * Whether the stored tokens can still be opened, without changing anything.
 *
 * This is the read-only sibling of `readTokens`, for callers that must report a
 * problem instead of acting on it: a page render that persisted `REVOKED` would
 * make a GET a write. A missing row and an unusable key ring both answer `false`,
 * because from the caller's side both mean "there is nothing readable here".
 */
export async function canReadTokens(accountId: string): Promise<boolean> {
  const stored = await prisma.channelAccount.findUnique({
    where: { id: accountId },
    select: { accessToken: true, refreshToken: true, expiresAt: true },
  });

  if (stored === null) return false;

  try {
    return (
      decryptStoredTokens(stored, loadKeyRing(process.env)).status === "ok"
    );
  } catch (error) {
    // A key ring that cannot be built is a configuration problem, not a row to
    // mark: the page says "reconnect" and the operator fixes the environment.
    if (error instanceof KeyRingError) return false;

    throw error;
  }
}

/**
 * Forgets every account of one channel, which is what "unlink" means: the row
 * holds the only copy of the tokens, so a row left behind is not an unlink.
 */
export async function clearChannelAccounts(channel: Channel): Promise<void> {
  await prisma.channelAccount.deleteMany({ where: { channel } });
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
