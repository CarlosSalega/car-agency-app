import type { MeliConfig } from "./config";
import {
  clearLinkedAccount,
  readLinkedAccount,
  saveLinkedAccount,
} from "./store";
import {
  createTokenManager,
  type AccessTokenResult,
  type TokenManager,
} from "./token";

/**
 * Production wiring for the token manager.
 *
 * Kept apart from `token.ts` so the rules stay importable without Prisma: a test
 * or a future caller that only needs `needsRefresh` should not drag a database
 * adapter along with it.
 *
 * The manager is cached per client id so the single-flight lock is shared across
 * requests within one instance, which is the whole point of the lock.
 */
let singleton: { config: MeliConfig; manager: TokenManager } | null = null;

export function getMeliTokenManager(config: MeliConfig): TokenManager {
  if (singleton?.config.clientId === config.clientId) return singleton.manager;

  const manager = createTokenManager({
    config,
    read: () => readLinkedAccount(config.encryptionKey),
    save: async (tokens) => {
      const current = await readLinkedAccount(config.encryptionKey);
      if (!current) return;

      await saveLinkedAccount({
        meliUserId: current.account.meliUserId,
        nickname: current.account.nickname,
        siteId: current.account.siteId,
        tokens,
        encryptionKey: config.encryptionKey,
      });
    },
    clear: clearLinkedAccount,
  });

  singleton = { config, manager };
  return manager;
}

export async function getMeliAccessToken(
  config: MeliConfig,
): Promise<AccessTokenResult> {
  return getMeliTokenManager(config).getAccessToken();
}
