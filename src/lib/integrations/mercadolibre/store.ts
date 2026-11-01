import { prisma } from "@/lib/db";

import { openValue, sealValue } from "./crypto";

/**
 * Persistence for the linked account.
 *
 * Tokens are sealed on the way in and opened on the way out, so no caller ever
 * handles ciphertext and no column ever holds a usable credential.
 *
 * A token that cannot be opened (rotated secret, truncated row, tampering)
 * reports `tokens: null` instead of throwing: the caller's job is then to ask for
 * a re-link, not to crash a page.
 */

export interface MeliTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scope?: string | null;
}

export interface LinkedMeliAccount {
  meliUserId: string;
  nickname: string;
  siteId: string | null;
  linkedAt: Date;
  updatedAt: Date;
}

export interface StoredMeliAccount {
  account: LinkedMeliAccount;
  /** `null` when the sealed values cannot be opened. */
  tokens: MeliTokens | null;
}

export async function readLinkedAccount(
  encryptionKey: string,
): Promise<StoredMeliAccount | null> {
  const row = await prisma.meliAccount.findFirst({
    orderBy: { updatedAt: "desc" },
  });

  if (!row) return null;

  const accessToken = openValue(row.accessToken, encryptionKey);
  const refreshToken = openValue(row.refreshToken, encryptionKey);

  const account: LinkedMeliAccount = {
    meliUserId: row.meliUserId,
    nickname: row.nickname,
    siteId: row.siteId,
    linkedAt: row.linkedAt,
    updatedAt: row.updatedAt,
  };

  if (!accessToken || !refreshToken) return { account, tokens: null };

  return {
    account,
    tokens: {
      accessToken,
      refreshToken,
      expiresAt: row.expiresAt,
      scope: row.scope,
    },
  };
}

/**
 * Single tenant, single row: linking an account replaces whatever was linked
 * before, including when it is a different ML user. Keeping two would make "who
 * do we publish as" ambiguous.
 */
export async function saveLinkedAccount({
  meliUserId,
  nickname,
  siteId,
  tokens,
  linkedById,
  encryptionKey,
}: {
  meliUserId: string;
  nickname: string;
  siteId?: string | null;
  tokens: MeliTokens;
  linkedById?: string | null;
  encryptionKey: string;
}): Promise<void> {
  const data = {
    nickname,
    siteId: siteId ?? null,
    accessToken: sealValue(tokens.accessToken, encryptionKey),
    refreshToken: sealValue(tokens.refreshToken, encryptionKey),
    expiresAt: tokens.expiresAt,
    scope: tokens.scope ?? null,
  };

  await prisma.$transaction([
    prisma.meliAccount.deleteMany({
      where: { meliUserId: { not: meliUserId } },
    }),
    prisma.meliAccount.upsert({
      where: { meliUserId },
      create: { meliUserId, linkedById: linkedById ?? null, ...data },
      update: data,
    }),
  ]);
}

export async function clearLinkedAccount(): Promise<void> {
  await prisma.meliAccount.deleteMany();
}
