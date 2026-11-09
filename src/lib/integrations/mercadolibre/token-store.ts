import { prisma } from "@/lib/db";

import { decryptStoredTokens, markAccountStatus } from "../channel-accounts";
import { encryptToken, loadKeyRing } from "../token-crypto";
import type {
  ReadAccountResult,
  StoredAccountTokens,
  TokenStore,
} from "./tokens";

/**
 * The production store behind `tokens.ts`, for the `ChannelAccount` row.
 *
 * Three decisions live in the shared modules and are reused rather than
 * re-implemented here:
 *
 * - `decryptStoredTokens` — the "both tokens must open, or the account is
 *   unusable" rule.
 * - `encryptToken` / `loadKeyRing` — all crypto, so no cipher is touched here.
 * - `markAccountStatus` — how a state is persisted, so the panel keeps reading
 *   one shape.
 *
 * What is specific to this module is the conditional write. `saveTokens` upserts
 * on `[channel, remoteUserId]` and cannot express "only if nobody refreshed in
 * between", which is the entire protection against two processes burning the
 * single-use refresh token. The compare is on `updatedAt` because the sealed
 * columns cannot be compared: a fresh IV per write means the same plaintext is
 * stored differently every time.
 *
 * A successful write also clears a stale `REVOKED`: a refresh that just worked is
 * proof that the account is usable again.
 */
export function createChannelTokenStore(): TokenStore {
  return {
    async read(accountId: string): Promise<ReadAccountResult> {
      const row = await prisma.channelAccount.findUnique({
        where: { id: accountId },
        select: {
          accessToken: true,
          refreshToken: true,
          expiresAt: true,
          updatedAt: true,
        },
      });

      if (row === null) return { status: "missing" };

      const stored = decryptStoredTokens(row, loadKeyRing(process.env));

      if (stored.status === "revoked") return { status: "revoked" };

      return {
        status: "ok",
        row: {
          accountId,
          tokens: stored.tokens,
          updatedAt: row.updatedAt,
        },
      };
    },

    async saveIfUnchanged({
      accountId,
      expectedUpdatedAt,
      tokens,
    }: {
      readonly accountId: string;
      readonly expectedUpdatedAt: Date;
      readonly tokens: StoredAccountTokens;
    }): Promise<boolean> {
      const ring = loadKeyRing(process.env);

      const { count } = await prisma.channelAccount.updateMany({
        where: { id: accountId, updatedAt: expectedUpdatedAt },
        data: {
          accessToken: encryptToken(tokens.accessToken, ring),
          refreshToken: encryptToken(tokens.refreshToken, ring),
          expiresAt: tokens.expiresAt,
          status: "CONNECTED",
        },
      });

      // Zero means the row moved on: another process refreshed first, and its
      // token pair is the live one.
      return count === 1;
    },

    async markRevoked(accountId: string): Promise<void> {
      await markAccountStatus(accountId, "REVOKED");
    },
  };
}
