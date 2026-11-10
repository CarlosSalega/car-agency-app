import { RateLimitedError } from "@/lib/jobs/types";

import { MELI_API_BASE } from "./config";

/**
 * The one place that speaks HTTP to Mercado Libre.
 *
 * Everything the callers need to survive a marketplace is here and only here:
 *
 * - **The token is fetched per request**, never captured. A refreshed access
 *   token is picked up by the next call without rebuilding the client, which is
 *   the difference between "six hours, then reconnect" and a working integration.
 * - **`429` is not a failure.** It is thrown as the queue's `RateLimitedError`,
 *   so the job is rescheduled without consuming an attempt (rule 3 in
 *   `src/lib/jobs/queue.ts`). ML publishes no numeric limit, only `429` plus
 *   "back off with jitter", so `Retry-After` is honoured when it is there and the
 *   queue's own backoff covers the rest.
 * - **Anything else non-2xx is a typed `MeliApiError`** carrying the status, the
 *   path and a short excerpt of the body. The excerpt is what makes a `400`
 *   diagnosable; the token and the headers are what would make it a leak, so
 *   neither is ever copied into an error.
 * - **Every request has a deadline.** A hung call must not hold a job forever,
 *   and a job that never returns is the one failure nobody notices until the
 *   queue is empty of progress.
 *
 * `fetchImpl`, `baseUrl`, `timeoutMs` and `now` are injected for the same reason
 * as everywhere else in this module: the interesting cases are a rate limit with
 * an HTTP-date header and a request that never answers, and neither needs a real
 * network to test.
 */

/** ML answers normal reads well inside a second; this is the "it is gone" line. */
export const MELI_REQUEST_TIMEOUT_MS = 15_000;

/** How much of a failure body is worth keeping. Enough to read, small enough to log. */
export const MELI_BODY_EXCERPT_LIMIT = 300;

export type MeliQueryValue = string | number | boolean | null | undefined;

/** Parameters are encoded, never concatenated: a title carries `&` and spaces. */
export type MeliQuery = Readonly<Record<string, MeliQueryValue>>;

export interface MeliClientOptions {
  /**
   * Resolved on every request so a refreshed token is used immediately. Throwing
   * here (a revoked account, for instance) aborts the call before it is sent.
   */
  readonly getAccessToken: () => Promise<string> | string;
  readonly fetchImpl?: typeof fetch;
  readonly baseUrl?: string;
  readonly timeoutMs?: number;
  /** Injected for the `Retry-After` HTTP-date form, which is relative to now. */
  readonly now?: () => Date;
}

export interface MeliClient {
  get<T>(path: string, query?: MeliQuery): Promise<T>;
  post<T>(path: string, body: unknown, query?: MeliQuery): Promise<T>;
  put<T>(path: string, body: unknown, query?: MeliQuery): Promise<T>;
}

/** Mercado Libre answered, and the answer was not what we asked for. */
export class MeliApiError extends Error {
  readonly status: number;
  readonly path: string;
  readonly bodyExcerpt: string;

  constructor({
    status,
    path,
    bodyExcerpt,
  }: {
    status: number;
    path: string;
    bodyExcerpt: string;
  }) {
    super(
      `Mercado Libre answered ${status} to ${path}: ${
        bodyExcerpt === "" ? "empty body" : bodyExcerpt
      }`,
    );

    this.name = "MeliApiError";
    this.status = status;
    this.path = path;
    this.bodyExcerpt = bodyExcerpt;
  }
}

/** The call did not finish inside the deadline, so it was aborted. */
export class MeliTimeoutError extends Error {
  readonly path: string;
  readonly timeoutMs: number;

  constructor({ path, timeoutMs }: { path: string; timeoutMs: number }) {
    super(`Mercado Libre did not answer ${path} within ${timeoutMs} ms`);

    this.name = "MeliTimeoutError";
    this.path = path;
    this.timeoutMs = timeoutMs;
  }
}

/** The call never reached an answer: DNS, reset connection, TLS. Transient. */
export class MeliRequestError extends Error {
  readonly path: string;

  constructor({ path, reason }: { path: string; reason: string }) {
    super(`The request to Mercado Libre ${path} did not complete: ${reason}`);

    this.name = "MeliRequestError";
    this.path = path;
  }
}

/**
 * Arms the abort deadline for one request.
 *
 * A plain `AbortController` and `setTimeout` rather than `AbortSignal.timeout`,
 * because the timer has to be cleared on the success path too: a stray timer
 * that fires later would abort an unrelated request on a reused signal.
 */
export interface MeliDeadline {
  readonly signal: AbortSignal;
  readonly timedOut: () => boolean;
  readonly clear: () => void;
}

export function createDeadline(timeoutMs: number): MeliDeadline {
  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    clear: () => clearTimeout(timer),
  };
}

/**
 * `Retry-After` in the two forms the header allows, as milliseconds from `now`.
 *
 * `undefined` when the header is absent, unparseable, or already in the past: a
 * negative delay would mean "retry immediately", which is the one thing a rate
 * limit is asking us not to do.
 */
export function parseRetryAfterMs(
  header: string | null,
  now: Date,
): number | undefined {
  if (header === null) return undefined;

  const value = header.trim();
  if (value === "") return undefined;

  const seconds = Number(value);

  if (Number.isFinite(seconds)) {
    return seconds >= 0 ? seconds * 1000 : undefined;
  }

  const retryAt = Date.parse(value);
  if (Number.isNaN(retryAt)) return undefined;

  const delay = retryAt - now.getTime();

  return delay >= 0 ? delay : undefined;
}

function buildUrl(baseUrl: string, path: string, query?: MeliQuery): string {
  const base = baseUrl.replace(/\/+$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${base}${suffix}`);

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null) continue;
    url.searchParams.set(key, String(value));
  }

  return url.toString();
}

/** Collapses a body to one readable line. Never includes headers or the token. */
function excerptOf(body: string): string {
  return body.replace(/\s+/g, " ").trim().slice(0, MELI_BODY_EXCERPT_LIMIT);
}

function describeTransportError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`.trim().replace(/:$/, "");
  }

  return "unknown transport error";
}

type MeliMethod = "GET" | "POST" | "PUT";

interface MeliRequest {
  readonly method: MeliMethod;
  readonly path: string;
  readonly query?: MeliQuery;
  /** Left out of a GET entirely: `undefined` is not an empty JSON body. */
  readonly payload?: unknown;
}

export function createMeliClient(options: MeliClientOptions): MeliClient {
  const doFetch = options.fetchImpl ?? fetch;
  const baseUrl = options.baseUrl ?? MELI_API_BASE;
  const timeoutMs = options.timeoutMs ?? MELI_REQUEST_TIMEOUT_MS;
  const now = options.now ?? (() => new Date());

  // One pipeline for reads and writes, so `429`, the deadline, the body excerpt
  // and the "never leak the token" rule cannot drift between them.
  async function request<T>({
    method,
    path,
    query,
    payload,
  }: MeliRequest): Promise<T> {
    const url = buildUrl(baseUrl, path, query);
    const token = await options.getAccessToken();
    const deadline = createDeadline(timeoutMs);

    const headers: Record<string, string> = {
      authorization: `Bearer ${token}`,
      accept: "application/json",
    };

    if (payload !== undefined) headers["content-type"] = "application/json";

    try {
      const response = await doFetch(url, {
        method,
        headers,
        ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
        signal: deadline.signal,
        // An authenticated read is not something the framework's fetch cache
        // should keep or replay.
        cache: "no-store",
      });

      // A body that cannot be read is a transport failure, not an empty answer:
      // swallowing it here would turn a deadline hit mid-body into a confusing
      // `MeliApiError` carrying nothing.
      const body = await response.text();

      if (response.status === 429) {
        throw new RateLimitedError(
          `Mercado Libre rate-limited ${path}`,
          parseRetryAfterMs(response.headers.get("retry-after"), now()),
        );
      }

      if (!response.ok) {
        throw new MeliApiError({
          status: response.status,
          path,
          bodyExcerpt: excerptOf(body),
        });
      }

      try {
        return JSON.parse(body) as T;
      } catch {
        throw new MeliApiError({
          status: response.status,
          path,
          bodyExcerpt: excerptOf(body),
        });
      }
    } catch (error) {
      if (deadline.timedOut()) {
        throw new MeliTimeoutError({ path, timeoutMs });
      }

      if (error instanceof MeliApiError || error instanceof RateLimitedError) {
        throw error;
      }

      throw new MeliRequestError({
        path,
        reason: describeTransportError(error),
      });
    } finally {
      deadline.clear();
    }
  }

  return {
    get: (path, query) => request({ method: "GET", path, query }),
    post: (path, body, query) =>
      request({ method: "POST", path, payload: body, query }),
    put: (path, body, query) =>
      request({ method: "PUT", path, payload: body, query }),
  };
}
