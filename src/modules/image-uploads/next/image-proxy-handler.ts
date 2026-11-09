import { describeError, statusForImageError } from "../core/errors";
import type { ImageErrorCode } from "../core/errors";
import { createMessageResolver } from "../core/messages";
import type { MessagesConfig } from "../core/messages";
import { silentLogger } from "../core/types";
import type { Logger } from "../core/types";

export interface ImageProxySource {
  readonly baseUrl: string;
}

export interface ImageProxyConfig<Context = unknown> {
  readonly provider: string;
  readonly sources: Readonly<Record<string, ImageProxySource>>;

  readonly getPath: (
    request: Request,
    context: Context,
  ) => readonly string[] | Promise<readonly string[]>;

  readonly cacheSeconds?: number;

  readonly revalidateSeconds?: number;
  readonly userAgent?: string;

  readonly contentSecurityPolicy?: string | null;

  readonly fetchImpl?: typeof fetch;
  readonly messages?: MessagesConfig;
  readonly logger?: Logger;

  readonly timeoutMs?: number;
}

export interface ImageProxyHandler<Context = unknown> {
  GET(request: Request, context: Context): Promise<Response>;
}

export const DEFAULT_IMAGE_CACHE_SECONDS = 604_800;

export const DEFAULT_IMAGE_CONTENT_SECURITY_POLICY =
  "default-src 'none'; style-src 'unsafe-inline'; sandbox";

export const DEFAULT_IMAGE_PROXY_TIMEOUT_MS = 10000;

interface AbortSignalStatics {
  any?: (signals: AbortSignal[]) => AbortSignal;
  timeout?: (milliseconds: number) => AbortSignal;
}

function createTimeoutSignal(timeoutMs: number): AbortSignal | undefined {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return undefined;

  const statics = AbortSignal as unknown as AbortSignalStatics;

  if (typeof statics.timeout === "function")
    return statics.timeout.call(AbortSignal, timeoutMs);

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(
      new DOMException("The operation timed out.", "TimeoutError"),
    );
  }, timeoutMs);

  (timer as { unref?: () => void }).unref?.();

  return controller.signal;
}

function combineSignals(
  requestSignal: AbortSignal,
  timeoutSignal: AbortSignal | undefined,
): AbortSignal {
  if (timeoutSignal === undefined) return requestSignal;

  const statics = AbortSignal as unknown as AbortSignalStatics;

  if (typeof statics.any === "function")
    return statics.any.call(AbortSignal, [requestSignal, timeoutSignal]);

  return timeoutSignal;
}

function abortable<Value>(
  work: Promise<Value>,
  signal: AbortSignal,
): Promise<Value> {
  return new Promise<Value>((resolve, reject) => {
    const onAbort = (): void => {
      reject(signal.reason);
    };

    if (signal.aborted) {
      onAbort();
      return;
    }

    signal.addEventListener("abort", onAbort, { once: true });

    work.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

function isTimeoutError(error: unknown): boolean {
  if (error instanceof Error || error instanceof DOMException)
    return error.name === "TimeoutError";

  return false;
}

export function createImageProxyHandler<Context = unknown>(
  config: ImageProxyConfig<Context>,
): ImageProxyHandler<Context> {
  const messages = createMessageResolver(config.messages);
  const logger = config.logger ?? silentLogger;
  const cacheSeconds = config.cacheSeconds ?? DEFAULT_IMAGE_CACHE_SECONDS;
  const timeoutMs = config.timeoutMs ?? DEFAULT_IMAGE_PROXY_TIMEOUT_MS;
  const contentSecurityPolicy =
    config.contentSecurityPolicy === undefined
      ? DEFAULT_IMAGE_CONTENT_SECURITY_POLICY
      : config.contentSecurityPolicy;
  const doFetch = config.fetchImpl ?? fetch;

  function errorResponse(code: ImageErrorCode): Response {
    return Response.json(
      { error: messages.error(code) },
      { status: statusForImageError(code) },
    );
  }

  async function GET(request: Request, context: Context): Promise<Response> {
    const timeoutSignal = createTimeoutSignal(timeoutMs);

    try {
      const segments = (await config.getPath(request, context)).filter(
        (segment) => segment.length > 0,
      );
      const imagePath = segments.join("/");

      if (imagePath.length === 0) {
        return errorResponse("PATH_MISSING");
      }

      const source = config.sources[config.provider];

      if (source === undefined || source.baseUrl.length === 0) {
        logger.error("Image proxy has no source configured", {
          provider: config.provider,
        });
        return errorResponse("UPSTREAM_FAILED");
      }

      const imageUrl = `${source.baseUrl.replace(/\/+$/, "")}/${imagePath}`;
      const signal = combineSignals(request.signal, timeoutSignal);
      const init: RequestInit = {
        headers: {
          "User-Agent": config.userAgent ?? "Mozilla/5.0",
          Accept: "image/*",
        },
        signal,
      };

      if (config.revalidateSeconds !== undefined) {
        (init as RequestInit & { next: { revalidate: number } }).next = {
          revalidate: config.revalidateSeconds,
        };
      }

      const upstream = await abortable(doFetch(imageUrl, init), signal);

      if (!upstream.ok) {
        return errorResponse("NOT_FOUND");
      }

      const upstreamType = upstream.headers.get("content-type");
      const contentType =
        upstreamType?.startsWith("image/") === true
          ? upstreamType
          : "image/webp";

      const headers = new Headers({
        "Content-Type": contentType,
        "Cache-Control": `public, max-age=${cacheSeconds}, immutable, stale-while-revalidate=${cacheSeconds}`,
        "X-Content-Type-Options": "nosniff",
        "CDN-Cache-Control": `public, max-age=${cacheSeconds}`,
      });

      if (contentSecurityPolicy !== null) {
        headers.set("Content-Security-Policy", contentSecurityPolicy);
      }

      return new Response(upstream.body, { status: 200, headers });
    } catch (error) {
      logger.error("Image proxy failed", { error: describeError(error) });

      if (isTimeoutError(error)) return errorResponse("TIMEOUT");

      return errorResponse("UPSTREAM_FAILED");
    }
  }

  return { GET };
}
