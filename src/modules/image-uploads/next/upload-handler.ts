import {
  describeError,
  isImageError,
  statusForImageError,
} from "../core/errors";
import type { ImageErrorCode } from "../core/errors";
import { createMessageResolver } from "../core/messages";
import type { MessagesConfig } from "../core/messages";
import { silentLogger } from "../core/types";
import type {
  Actor,
  ImageProvider,
  Logger,
  UploadableFile,
  UploadOptions,
  UploadResult,
} from "../core/types";
import type { UploadValidationPolicy } from "../core/validate";
import {
  evaluateAuthentication,
  evaluateDelete,
  evaluateUploadFile,
} from "../guards/policy";
import type { AuthorizeDelete, GetActor } from "../guards/types";

export interface WebRequestLike {
  readonly headers?: Headers;
  formData(): Promise<FormData>;
  json(): Promise<unknown>;
}

export interface UploadHandlerConfig<
  Request extends WebRequestLike = WebRequestLike,
> {
  readonly provider: ImageProvider;

  readonly getActor: GetActor<Request>;

  readonly validate?: UploadValidationPolicy;

  readonly multipartOverheadBytes?: number;

  readonly authorizeDelete?: AuthorizeDelete<Request>;

  readonly uploadOptions?: (args: {
    readonly actor: Actor;
    readonly file: UploadableFile;
  }) => UploadOptions | undefined;

  readonly onUploaded?: (args: {
    readonly actor: Actor;
    readonly result: UploadResult;
  }) => Promise<void> | void;

  readonly onDeleted?: (args: {
    readonly actor: Actor;
    readonly key: string;
  }) => Promise<void> | void;

  readonly messages?: MessagesConfig;
  readonly logger?: Logger;

  readonly fileField?: string;

  readonly keyField?: string;
}

export interface UploadHandler {
  POST(request: WebRequestLike): Promise<Response>;
  DELETE(request: WebRequestLike): Promise<Response>;
}

export const DEFAULT_MULTIPART_OVERHEAD_BYTES = 65536;

export function createUploadHandler<
  Request extends WebRequestLike = WebRequestLike,
>(config: UploadHandlerConfig<Request>): UploadHandler {
  const messages = createMessageResolver(config.messages);
  const logger = config.logger ?? silentLogger;
  const fileField = config.fileField ?? "file";
  const keyField = config.keyField ?? "key";
  const multipartOverheadBytes =
    config.multipartOverheadBytes ?? DEFAULT_MULTIPART_OVERHEAD_BYTES;

  function errorResponse(
    code: ImageErrorCode,
    message?: string,
    details?: Record<string, unknown>,
  ): Response {
    if (details !== undefined) {
      logger.warn("Image request refused", { code, ...details });
    }

    return Response.json(
      { error: message ?? messages.error(code) },
      { status: statusForImageError(code) },
    );
  }

  async function runHook(
    hook: "onUploaded" | "onDeleted",
    notify: (() => Promise<void> | void) | undefined,
    key: string,
  ): Promise<void> {
    if (notify === undefined) return;

    try {
      await notify();
    } catch (error) {
      logger.error("Image lifecycle hook failed", {
        hook,
        key,
        error: describeError(error),
      });
    }
  }

  async function POST(request: WebRequestLike): Promise<Response> {
    const authentication = await evaluateAuthentication(
      request as Request,
      config.getActor,
    );

    if (!authentication.ok) {
      return errorResponse(authentication.code, undefined, {
        step: "authenticate",
      });
    }

    const maxBytes = config.validate?.maxBytes;
    const declaredLength = readDeclaredLength(request);

    if (
      maxBytes !== undefined &&
      declaredLength !== undefined &&
      declaredLength > maxBytes + multipartOverheadBytes
    ) {
      return errorResponse("TOO_LARGE", undefined, {
        step: "preflight",
        contentLength: declaredLength,
        maxBytes,
      });
    }

    let formData: FormData;

    try {
      formData = await request.formData();
    } catch (error) {
      return errorResponse("NO_FILE", undefined, {
        step: "parse",
        error: describeError(error),
      });
    }

    const fileDecision = evaluateUploadFile(
      formData.get(fileField),
      config.validate,
    );

    if (!fileDecision.ok) {
      return errorResponse(fileDecision.code, undefined, {
        step: "validate",
        ...fileDecision.details,
      });
    }

    try {
      const options = config.uploadOptions?.({
        actor: authentication.actor,
        file: fileDecision.file,
      });
      const result = await config.provider.upload(fileDecision.file, options);
      const onUploaded = config.onUploaded;

      await runHook(
        "onUploaded",
        onUploaded === undefined
          ? undefined
          : () => onUploaded({ actor: authentication.actor, result }),
        result.key,
      );

      return Response.json(
        { success: true, key: result.key, url: result.url },
        { status: 200 },
      );
    } catch (error) {
      logger.error("Image upload failed", { error: describeError(error) });

      return isImageError(error)
        ? errorResponse(error.code)
        : errorResponse("UPLOAD_FAILED");
    }
  }

  async function DELETE(request: WebRequestLike): Promise<Response> {
    const authentication = await evaluateAuthentication(
      request as Request,
      config.getActor,
    );

    if (!authentication.ok) {
      return errorResponse(authentication.code, undefined, {
        step: "authenticate",
      });
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      body = undefined;
    }

    const key = readKey(body, keyField);

    if (key === undefined) {
      return errorResponse("MISSING_KEY", undefined, { step: "parse" });
    }

    const authorization = await evaluateDelete({
      request: request as Request,
      actor: authentication.actor,
      key,
      ...(config.authorizeDelete === undefined
        ? {}
        : { authorizeDelete: config.authorizeDelete }),
    });

    if (!authorization.ok) {
      const message =
        authorization.message ??
        (authorization.reason === undefined
          ? undefined
          : messages.forbidden(authorization.reason));

      return errorResponse(authorization.code, message, {
        step: "authorize",
        key,
        ...authorization.details,
      });
    }

    try {
      const result = await config.provider.delete(key);

      if (!result.success) {
        return errorResponse(
          "DELETE_FAILED",
          result.error ?? messages.error("DELETE_FAILED"),
          { key },
        );
      }

      const onDeleted = config.onDeleted;

      await runHook(
        "onDeleted",
        onDeleted === undefined
          ? undefined
          : () => onDeleted({ actor: authentication.actor, key }),
        key,
      );

      return Response.json({ success: true }, { status: 200 });
    } catch (error) {
      logger.error("Image delete failed", { key, error: describeError(error) });

      return errorResponse("DELETE_FAILED", undefined, { key });
    }
  }

  return { POST, DELETE };
}

function readKey(body: unknown, field: string): string | undefined {
  if (typeof body !== "object" || body === null) return undefined;

  const value = (body as Record<string, unknown>)[field];

  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readDeclaredLength(request: WebRequestLike): number | undefined {
  const raw = request.headers?.get("content-length");

  if (raw === undefined || raw === null) return undefined;

  const trimmed = raw.trim();

  if (trimmed.length === 0) return undefined;

  const parsed = Number(trimmed);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}
