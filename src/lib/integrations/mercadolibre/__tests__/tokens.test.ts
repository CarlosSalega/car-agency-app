import { describe, expect, it } from "vitest";

import {
  DEFAULT_REFRESH_SKEW_MS,
  getValidAccessToken,
  MeliReconnectRequiredError,
  MeliTokenRefreshError,
  refreshAccount,
  type MeliTokenDeps,
  type ReadAccountResult,
  type StoredAccountRow,
  type StoredAccountTokens,
  type TokenStore,
} from "../tokens";
import { fakeFetch, fakeResponse, unreachableFetch } from "./fake-response";

const NOW = new Date("2026-11-05T12:00:00.000Z");
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const REFRESH_URL = "https://auth.example.com/oauth/token";

/** Stands in for the `ChannelAccount` row, with the race made readable. */
class FakeTokenStore implements TokenStore {
  readonly rows = new Map<string, StoredAccountRow>();
  readonly markedRevoked: string[] = [];
  readonly writes: StoredAccountTokens[] = [];
  /** Set when the sealed columns cannot be opened. */
  revoked = false;
  /** Runs after a read, before the caller gets the row: lets a test inject a winner. */
  afterRead: ((readIndex: number) => void) | null = null;
  /** Runs before a conditional write, so a test can let the other process win. */
  beforeWrite: (() => void) | null = null;
  reads = 0;

  seed(
    tokens: StoredAccountTokens,
    updatedAt = new Date("2026-11-05T10:00:00Z"),
  ) {
    this.rows.set("account-1", { accountId: "account-1", tokens, updatedAt });
  }

  setRow(tokens: StoredAccountTokens, updatedAt: Date) {
    this.rows.set("account-1", { accountId: "account-1", tokens, updatedAt });
  }

  async read(accountId: string): Promise<ReadAccountResult> {
    const index = this.reads;
    this.reads += 1;

    const row = this.rows.get(accountId) ?? null;
    this.afterRead?.(index);

    if (this.revoked) return { status: "revoked" };
    if (row === null) return { status: "missing" };

    return { status: "ok", row };
  }

  async saveIfUnchanged({
    accountId,
    expectedUpdatedAt,
    tokens,
  }: {
    accountId: string;
    expectedUpdatedAt: Date;
    tokens: StoredAccountTokens;
  }): Promise<boolean> {
    this.beforeWrite?.();

    const row = this.rows.get(accountId);
    if (row === undefined) return false;
    if (row.updatedAt.getTime() !== expectedUpdatedAt.getTime()) return false;

    this.writes.push(tokens);
    this.rows.set(accountId, {
      accountId,
      tokens,
      updatedAt: new Date(row.updatedAt.getTime() + 1),
    });

    return true;
  }

  async markRevoked(accountId: string): Promise<void> {
    this.markedRevoked.push(accountId);
  }
}

function tokens(
  overrides: Partial<StoredAccountTokens> = {},
): StoredAccountTokens {
  return {
    accessToken: "access-old",
    refreshToken: "refresh-old",
    expiresAt: new Date(NOW.getTime() + SIX_HOURS_MS),
    ...overrides,
  };
}

function deps(
  store: TokenStore,
  fetchImpl: typeof fetch = unreachableFetch().impl,
): MeliTokenDeps {
  return {
    store,
    clientId: "app-id",
    clientSecret: "app-secret",
    tokenUrl: REFRESH_URL,
    fetchImpl,
    now: () => NOW,
  };
}

function refreshSucceeds(
  body: Record<string, unknown> = {
    access_token: "access-new",
    refresh_token: "refresh-new",
    expires_in: 21_600,
  },
) {
  return fakeFetch(() => fakeResponse({ body }));
}

function refreshFails(
  status = 400,
  body: unknown = { error: "invalid_grant" },
) {
  return fakeFetch(() => fakeResponse({ status, body }));
}

describe("a token that is still good", () => {
  it("is returned untouched, without a network call", async () => {
    const store = new FakeTokenStore();
    store.seed(tokens());
    const never = unreachableFetch();

    await expect(
      getValidAccessToken("account-1", deps(store, never.impl)),
    ).resolves.toBe("access-old");
    expect(never.calls).toHaveLength(0);
  });

  it("is still returned just outside the safety window", async () => {
    const store = new FakeTokenStore();
    store.seed(
      tokens({
        expiresAt: new Date(NOW.getTime() + DEFAULT_REFRESH_SKEW_MS + 60_000),
      }),
    );
    const never = unreachableFetch();

    await expect(
      getValidAccessToken("account-1", deps(store, never.impl)),
    ).resolves.toBe("access-old");
    expect(never.calls).toHaveLength(0);
  });
});

describe("a token inside the safety window", () => {
  it("is refreshed ahead of expiry and the new pair is stored", async () => {
    const store = new FakeTokenStore();
    store.seed(tokens({ expiresAt: new Date(NOW.getTime() + 60_000) }));
    const { impl, calls } = refreshSucceeds();

    await expect(
      getValidAccessToken("account-1", deps(store, impl)),
    ).resolves.toBe("access-new");

    expect(calls).toHaveLength(1);
    expect(String(calls[0].url)).toBe(REFRESH_URL);
    expect(store.writes).toEqual([
      {
        accessToken: "access-new",
        refreshToken: "refresh-new",
        expiresAt: new Date(NOW.getTime() + SIX_HOURS_MS),
      },
    ]);
    expect(store.markedRevoked).toEqual([]);
  });

  it("sends the single-use refresh token it read from the row", async () => {
    const store = new FakeTokenStore();
    store.seed(tokens({ expiresAt: new Date(NOW.getTime() + 60_000) }));
    const { impl, calls } = refreshSucceeds();

    await getValidAccessToken("account-1", deps(store, impl));

    const body = new URLSearchParams(String(calls[0].init.body));
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("refresh-old");
  });
});

describe("two processes refreshing at once", () => {
  it("does not fail the loser when the winner already stored a new refresh token", async () => {
    const store = new FakeTokenStore();
    store.seed(tokens({ expiresAt: new Date(NOW.getTime() + 60_000) }));

    // The winner refreshes between our read and our re-read.
    store.afterRead = (index) => {
      if (index === 0) {
        store.setRow(
          {
            accessToken: "access-winner",
            refreshToken: "refresh-winner",
            expiresAt: new Date(NOW.getTime() + SIX_HOURS_MS),
          },
          new Date("2026-11-05T11:59:59.000Z"),
        );
      }
    };

    await expect(
      getValidAccessToken("account-1", deps(store, refreshFails().impl)),
    ).resolves.toBe("access-winner");
    expect(store.markedRevoked).toEqual([]);
  });

  it("uses the winner's tokens when its own conditional write lost the race", async () => {
    const store = new FakeTokenStore();
    store.seed(tokens({ expiresAt: new Date(NOW.getTime() + 60_000) }));

    // The other process writes after we read and before we write.
    store.beforeWrite = () => {
      store.setRow(
        {
          accessToken: "access-winner",
          refreshToken: "refresh-winner",
          expiresAt: new Date(NOW.getTime() + SIX_HOURS_MS),
        },
        new Date("2026-11-05T11:59:59.000Z"),
      );
    };

    await expect(
      getValidAccessToken("account-1", deps(store, refreshSucceeds().impl)),
    ).resolves.toBe("access-winner");
    expect(store.markedRevoked).toEqual([]);
  });
});

describe("a refresh the provider refuses", () => {
  it("marks the account REVOKED when the stored refresh token is still the one that failed", async () => {
    const store = new FakeTokenStore();
    store.seed(tokens({ expiresAt: new Date(NOW.getTime() + 60_000) }));

    const error = await getValidAccessToken(
      "account-1",
      deps(store, refreshFails().impl),
    ).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(MeliReconnectRequiredError);
    expect((error as MeliReconnectRequiredError).status).toBe("REVOKED");
    expect(store.markedRevoked).toEqual(["account-1"]);
    expect(store.writes).toEqual([]);
  });

  it("refuses an account whose stored tokens cannot be opened, without a network call", async () => {
    const store = new FakeTokenStore();
    store.revoked = true;
    const never = unreachableFetch();

    const error = await getValidAccessToken(
      "account-1",
      deps(store, never.impl),
    ).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(MeliReconnectRequiredError);
    expect((error as MeliReconnectRequiredError).status).toBe("REVOKED");
    expect(never.calls).toHaveLength(0);
  });

  it("does not revoke the account when the provider is merely unavailable", async () => {
    const store = new FakeTokenStore();
    store.seed(tokens({ expiresAt: new Date(NOW.getTime() + 60_000) }));
    const down = fakeFetch(() => {
      throw new Error("ECONNRESET");
    });

    const error = await getValidAccessToken(
      "account-1",
      deps(store, down.impl),
    ).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(MeliTokenRefreshError);
    expect(store.markedRevoked).toEqual([]);
    expect(store.writes).toEqual([]);
  });

  it("gives up on a hung refresh instead of holding the job", async () => {
    const store = new FakeTokenStore();
    store.seed(tokens({ expiresAt: new Date(NOW.getTime() + 60_000) }));

    const hung = fakeFetch(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
          });
        }),
    );

    const error = await getValidAccessToken("account-1", {
      ...deps(store, hung.impl),
      timeoutMs: 10,
    }).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(MeliTokenRefreshError);
    expect(store.markedRevoked).toEqual([]);
  });
});

describe("what reaches the surface", () => {
  it("names no token, neither the access one nor the single-use refresh one", async () => {
    const store = new FakeTokenStore();
    store.seed(tokens({ expiresAt: new Date(NOW.getTime() + 60_000) }));

    const error = (await getValidAccessToken(
      "account-1",
      deps(store, refreshFails().impl),
    ).catch((thrown: unknown) => thrown)) as Error;

    const rendered = `${error.message} ${JSON.stringify(
      error,
      Object.getOwnPropertyNames(error),
    )}`;

    expect(rendered).not.toContain("refresh-old");
    expect(rendered).not.toContain("access-old");
  });
});

describe("refreshAccount", () => {
  it("forces the refresh and reports the new expiry", async () => {
    const store = new FakeTokenStore();
    store.seed(tokens());
    const { impl, calls } = refreshSucceeds();

    await expect(
      refreshAccount("account-1", deps(store, impl)),
    ).resolves.toEqual(new Date(NOW.getTime() + SIX_HOURS_MS));
    expect(calls).toHaveLength(1);
  });

  it("reports the winner's expiry when it loses the race", async () => {
    const store = new FakeTokenStore();
    store.seed(tokens());

    const winnerExpiry = new Date("2026-11-05T18:59:59.000Z");
    store.beforeWrite = () => {
      store.setRow(
        {
          accessToken: "access-winner",
          refreshToken: "refresh-winner",
          expiresAt: winnerExpiry,
        },
        new Date("2026-11-05T11:59:59.000Z"),
      );
    };

    await expect(
      refreshAccount("account-1", deps(store, refreshSucceeds().impl)),
    ).resolves.toEqual(winnerExpiry);
  });
});
