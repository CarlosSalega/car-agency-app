import { createDeadline, MELI_REQUEST_TIMEOUT_MS } from "./client";
import { MELI_TOKEN_URL } from "./config";

/**
 * The access-token lifecycle, as optimistic concurrency instead of a lock.
 *
 * Mercado Libre's refresh token is **single-use**: the moment one refresh
 * succeeds, every other copy of the old one is dead, and only the last token
 * issued works. That makes two concurrent refreshes a data-loss event in the
 * naive implementation — the loser gets `invalid_grant`, concludes the account is
 * broken, and asks a human to reconnect an account that is working fine.
 *
 * A lock would fix it inside one process and fail across processes: two
 * drainers, a drainer and a web request, two serverless instances. This module
 * assumes the race happens and makes every outcome recoverable:
 *
 * 1. Read the row. If the access token is not close to expiring, return it
 *    untouched and never call the network.
 * 2. Otherwise remember the refresh token and the row's `updatedAt`, and try to
 *    refresh with that refresh token.
 * 3. On success, write the new pair **only if `updatedAt` has not changed**. The
 *    sealed ciphertext cannot be the compare token: a fresh IV per write means
 *    the same plaintext produces a different column value every time.
 * 4. Losing that write is not an error. Re-read and use the winner's tokens: its
 *    refresh token is the only live one, and its access token is newer than
 *    anything we could produce.
 * 5. On failure, **re-read before concluding anything**. If the stored refresh
 *    token is no longer the one that just failed, a concurrent refresh already
 *    won — use its access token. Only when the stored token is still the one
 *    that failed is the account genuinely unusable, and then it is marked
 *    `REVOKED` so the panel can ask for a reconnect.
 *
 * A transport failure is treated differently from a refusal: an unreachable
 * provider has not told us the grant is dead, and revoking an account over a
 * network blip costs a human a reconnect. The queue retries.
 *
 * Store, clock and `fetch` are injected, so the whole race is exercised in
 * `__tests__/tokens.test.ts` without a database.
 */

/** Refresh this long before expiry: an access token lasts six hours. */
export const DEFAULT_REFRESH_SKEW_MS = 5 * 60 * 1000;

/** ML documents six hours; used when the response omits `expires_in`. */
const DEFAULT_EXPIRES_IN_SECONDS = 21_600;

export interface StoredAccountTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: Date;
}

export interface StoredAccountRow {
  readonly accountId: string;
  readonly tokens: StoredAccountTokens;
  /** The optimistic-concurrency token: it changes on every write. */
  readonly updatedAt: Date;
}

export type ReadAccountResult =
  | { readonly status: "ok"; readonly row: StoredAccountRow }
  /** No such account: it was never linked. */
  | { readonly status: "missing" }
  /** The sealed columns cannot be opened, so the next refresh cannot happen. */
  | { readonly status: "revoked" };

/**
 * What this module needs from storage.
 *
 * Deliberately narrower than Prisma's delegate: three operations, each one a
 * decision this module makes. `saveIfUnchanged` exists precisely because a plain
 * `save` cannot express "only if nobody refreshed in between".
 */
export interface TokenStore {
  read(accountId: string): Promise<ReadAccountResult>;
  /** Returns whether the write landed; `false` means somebody else wrote first. */
  saveIfUnchanged(input: {
    readonly accountId: string;
    readonly expectedUpdatedAt: Date;
    readonly tokens: StoredAccountTokens;
  }): Promise<boolean>;
  markRevoked(accountId: string): Promise<void>;
}

export interface MeliTokenDeps {
  readonly store: TokenStore;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => Date;
  readonly tokenUrl?: string;
  readonly skewMs?: number;
  readonly timeoutMs?: number;
}

export type MeliReconnectReason =
  | "not-linked"
  | "unreadable-tokens"
  | "refresh-rejected";

/**
 * The account cannot be used until somebody links it again.
 *
 * `status` mirrors the account state the panel shows, so a caller can decide
 * "reconnect needed" without matching on message strings.
 */
export class MeliReconnectRequiredError extends Error {
  readonly status = "REVOKED" as const;
  readonly accountId: string;
  readonly reason: MeliReconnectReason;

  constructor(accountId: string, reason: MeliReconnectReason) {
    super(
      `The Mercado Libre account ${accountId} needs to be reconnected (${reason})`,
    );

    this.name = "MeliReconnectRequiredError";
    this.accountId = accountId;
    this.reason = reason;
  }
}

/** Transient: the provider did not answer, or answered "later". Retry the job. */
export class MeliTokenRefreshError extends Error {
  readonly accountId: string;
  readonly status: number | null;

  constructor(accountId: string, status: number | null) {
    super(
      `Refreshing the Mercado Libre tokens for account ${accountId} failed${
        status === null ? "" : ` (HTTP ${status})`
      }. The account is unchanged and the refresh can be retried.`,
    );

    this.name = "MeliTokenRefreshError";
    this.accountId = accountId;
    this.status = status;
  }
}

export function needsRefresh(
  expiresAt: Date,
  now: Date,
  skewMs: number = DEFAULT_REFRESH_SKEW_MS,
): boolean {
  return expiresAt.getTime() - now.getTime() <= skewMs;
}

type RefreshOutcome =
  | {
      readonly kind: "ok";
      readonly accessToken: string;
      readonly refreshToken: string;
      readonly expiresInSeconds: number;
    }
  /** The provider refused the grant: 400/401/403 or an auth error code. */
  | {
      readonly kind: "rejected";
      readonly status: number;
      readonly code: string | null;
    }
  /** 429, 5xx, an unserialisable body or no connection at all. */
  | { readonly kind: "transient"; readonly status: number | null };

interface RefreshResponseBody {
  readonly access_token?: unknown;
  readonly refresh_token?: unknown;
  readonly expires_in?: unknown;
  readonly error?: unknown;
}

const AUTH_FAILURE_CODES = new Set(["invalid_grant", "invalid_client"]);

function clockOf(deps: MeliTokenDeps): Date {
  return deps.now?.() ?? new Date();
}

async function readUsableRow(
  accountId: string,
  deps: MeliTokenDeps,
): Promise<StoredAccountRow> {
  const stored = await deps.store.read(accountId);

  if (stored.status === "ok") return stored.row;

  throw new MeliReconnectRequiredError(
    accountId,
    stored.status === "revoked" ? "unreadable-tokens" : "not-linked",
  );
}

/** One refresh exchange. It never throws: the caller decides what a failure means. */
async function requestRefresh(
  refreshToken: string,
  deps: MeliTokenDeps,
): Promise<RefreshOutcome> {
  const doFetch = deps.fetchImpl ?? fetch;
  const deadline = createDeadline(deps.timeoutMs ?? MELI_REQUEST_TIMEOUT_MS);

  let response: Response;

  try {
    response = await doFetch(deps.tokenUrl ?? MELI_TOKEN_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: deps.clientId,
        client_secret: deps.clientSecret,
        refresh_token: refreshToken,
      }),
      signal: deadline.signal,
      cache: "no-store",
    });
  } catch {
    return { kind: "transient", status: null };
  } finally {
    deadline.clear();
  }

  const body = (await response
    .json()
    .catch(() => null)) as RefreshResponseBody | null;

  if (!response.ok) {
    // Only `error` is read from the body. `error_description` is free text and
    // the message ends up in a job row and a log line: nothing from a token
    // exchange is worth copying there.
    const code = typeof body?.error === "string" ? body.error : null;

    if (
      response.status === 400 ||
      response.status === 401 ||
      response.status === 403 ||
      (code !== null && AUTH_FAILURE_CODES.has(code))
    ) {
      return { kind: "rejected", status: response.status, code };
    }

    return { kind: "transient", status: response.status };
  }

  const accessToken = body?.access_token;
  const nextRefreshToken = body?.refresh_token;

  if (typeof accessToken !== "string" || typeof nextRefreshToken !== "string") {
    // A 200 without a token pair is a broken contract, not a dead grant.
    return { kind: "transient", status: response.status };
  }

  const expiresIn = body?.expires_in;

  return {
    kind: "ok",
    accessToken,
    refreshToken: nextRefreshToken,
    expiresInSeconds:
      typeof expiresIn === "number" && expiresIn > 0
        ? expiresIn
        : DEFAULT_EXPIRES_IN_SECONDS,
  };
}

/**
 * Refreshes and reports which tokens are now live.
 *
 * Returns the stored tokens of whoever won, not necessarily the pair this call
 * obtained: that is the whole point of steps 3–5 above.
 */
async function refreshOnce(
  accountId: string,
  row: StoredAccountRow,
  deps: MeliTokenDeps,
): Promise<StoredAccountTokens> {
  const usedRefreshToken = row.tokens.refreshToken;
  const outcome = await requestRefresh(usedRefreshToken, deps);

  if (outcome.kind === "ok") {
    const tokens: StoredAccountTokens = {
      accessToken: outcome.accessToken,
      refreshToken: outcome.refreshToken,
      expiresAt: new Date(
        clockOf(deps).getTime() + outcome.expiresInSeconds * 1000,
      ),
    };

    const saved = await deps.store.saveIfUnchanged({
      accountId,
      expectedUpdatedAt: row.updatedAt,
      tokens,
    });

    if (saved) return tokens;

    // Somebody wrote between our read and our write. Their refresh token is the
    // live one, so ours must be discarded, not retried.
    return (await readUsableRow(accountId, deps)).tokens;
  }

  const after = await deps.store.read(accountId);

  if (after.status === "revoked") {
    throw new MeliReconnectRequiredError(accountId, "unreadable-tokens");
  }

  if (
    after.status === "ok" &&
    after.row.tokens.refreshToken !== usedRefreshToken
  ) {
    // The concurrent refresh already landed. Its access token is newer and the
    // refresh token we consumed is expected to be dead: this is success.
    return after.row.tokens;
  }

  if (outcome.kind === "transient") {
    throw new MeliTokenRefreshError(accountId, outcome.status);
  }

  await deps.store.markRevoked(accountId);

  throw new MeliReconnectRequiredError(accountId, "refresh-rejected");
}

/**
 * A usable access token for the account.
 *
 * Throws `MeliReconnectRequiredError` (with `status: "REVOKED"`) when the account
 * has to be linked again, and `MeliTokenRefreshError` when the provider is
 * merely unavailable.
 */
export async function getValidAccessToken(
  accountId: string,
  deps: MeliTokenDeps,
): Promise<string> {
  const row = await readUsableRow(accountId, deps);

  if (
    !needsRefresh(
      row.tokens.expiresAt,
      clockOf(deps),
      deps.skewMs ?? DEFAULT_REFRESH_SKEW_MS,
    )
  ) {
    return row.tokens.accessToken;
  }

  return (await refreshOnce(accountId, row, deps)).accessToken;
}

/**
 * Forces a refresh, for the reconnect-and-verify path an admin triggers.
 *
 * Same contract and the same race handling as `getValidAccessToken`; it returns
 * the expiry of whichever token pair is stored afterwards.
 */
export async function refreshAccount(
  accountId: string,
  deps: MeliTokenDeps,
): Promise<Date> {
  const row = await readUsableRow(accountId, deps);

  return (await refreshOnce(accountId, row, deps)).expiresAt;
}
