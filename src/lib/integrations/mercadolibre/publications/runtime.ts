import { prisma } from "@/lib/db";
import {
  readConnectedAccount,
  type ConnectedChannelAccount,
} from "@/lib/integrations/channel-accounts";
import { resolveImageUrl as resolveAppImageUrl } from "@/lib/images/resolve-image-url";
import type { JobRegistry } from "@/lib/jobs/types";

import { predictCategory, getRequiredAttributes } from "../categories";
import { createCategoryAttributeCacheStore } from "../category-cache";
import { createMeliClient } from "../client";
import { createMeliItemsApi } from "../items";
import { readMeliConfig } from "../config";
import { createChannelTokenStore } from "../token-store";
import { getValidAccessToken } from "../tokens";
import { createMeliJobRegistry } from "./index";
import { MeliRuntimeError } from "./errors";
import {
  createPrismaPublicationStore,
  ensurePrismaPublication,
  findPrismaPublication,
  type EnsuredPublication,
} from "./store";
import type {
  PublicationChannel,
  PublicationDeps,
  PublicationImageVariant,
  PublicationStore,
} from "./types";

/**
 * The production wiring: the only file that reads the database, the environment
 * and the app's image resolver to build the handlers.
 *
 * The channel is built **per account and per call**, not once at startup, for
 * two reasons: the access token belongs to the account, and the token manager
 * must be handed the account it is refreshing; and a drainer started while the
 * account needs reconnecting must still be able to run, failing each job with a
 * sentence instead of refusing to start.
 *
 * Everything here is imported lazily by the two scripts, because `@/lib/db`
 * builds a Prisma client while it is evaluated — `--help` must work with no
 * environment at all.
 */

/** A configuration problem a person can fix, phrased for that person. */
export { MeliRuntimeError } from "./errors";

export interface MeliRuntime {
  readonly publications: PublicationStore;
  readonly registry: JobRegistry;
  /** The linked account, or a sentence explaining there is none. */
  readAccount(): Promise<ConnectedChannelAccount>;
  /** Read-only: a dry run must not create the row it describes. */
  findPublication(input: {
    readonly carId: string;
    readonly accountId: string;
  }): Promise<EnsuredPublication | null>;
  ensurePublication(input: {
    readonly carId: string;
    readonly accountId: string;
  }): Promise<EnsuredPublication>;
}

interface RuntimeOptions {
  readonly env?: Record<string, string | undefined>;
}

export function createMeliRuntime(options: RuntimeOptions = {}): MeliRuntime {
  const env = options.env ?? process.env;
  const tokenStore = createChannelTokenStore();
  const categoryCache = createCategoryAttributeCacheStore();

  /**
   * Resolved on every request through the client, so a refreshed access token
   * is picked up without rebuilding anything.
   */
  function channelFor(accountId: string): PublicationChannel {
    const config = readMeliConfig(env);

    if (!config.ok) {
      throw new MeliRuntimeError(
        `Falta configurar Mercado Libre: ${config.missing.join(", ")}. Cargá esas variables en el despliegue.`,
      );
    }

    const client = createMeliClient({
      getAccessToken: () =>
        getValidAccessToken(accountId, {
          store: tokenStore,
          clientId: config.config.clientId,
          clientSecret: config.config.clientSecret,
        }),
    });

    return {
      items: createMeliItemsApi(client),
      catalog: {
        predictCategory: ({ title, site }) =>
          predictCategory({ client, title, site: site ?? "MLA" }),
        getRequiredAttributes: (categoryId) =>
          getRequiredAttributes(categoryId, {
            client,
            store: categoryCache,
          }),
      },
    };
  }

  const deps: PublicationDeps = {
    store: createPrismaPublicationStore(prisma),
    channelFor,
    // 800×600, above ML's 500 px minimum. Not the 1200×1200 variant: that is T7.
    resolveImageUrl: (key: string, variant: PublicationImageVariant) =>
      resolveAppImageUrl(key, variant),
  };

  return {
    publications: deps.store,
    registry: createMeliJobRegistry(deps),

    async readAccount() {
      const account = await readConnectedAccount("MERCADOLIBRE");

      if (account === null) {
        throw new MeliRuntimeError(
          "No hay una cuenta de Mercado Libre vinculada. Vinculala en Configuración → Mercado Libre y volvé a intentar.",
        );
      }

      return account;
    },

    findPublication: (input) => findPrismaPublication(prisma, input),
    ensurePublication: (input) => ensurePrismaPublication(prisma, input),
  };
}
