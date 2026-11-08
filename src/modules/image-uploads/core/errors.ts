export const IMAGE_ERROR_STATUS = {
  UNAUTHENTICATED: 401,

  FORBIDDEN: 403,

  NO_FILE: 400,

  INVALID_TYPE: 400,

  TOO_LARGE: 413,

  MISSING_KEY: 400,

  PATH_MISSING: 400,

  NOT_FOUND: 404,

  PROVIDER_UNKNOWN: 500,

  MISCONFIGURED: 500,

  UPLOAD_FAILED: 500,

  DELETE_FAILED: 500,

  UPSTREAM_FAILED: 500,

  TIMEOUT: 504,
} as const;

export type ImageErrorCode = keyof typeof IMAGE_ERROR_STATUS;

export function statusForImageError(code: ImageErrorCode): number {
  return IMAGE_ERROR_STATUS[code];
}

export interface ImageErrorOptions {
  readonly message?: string;

  readonly details?: Record<string, unknown>;
  readonly cause?: unknown;
}

export class ImageError extends Error {
  readonly code: ImageErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: ImageErrorCode, options: ImageErrorOptions = {}) {
    super(
      options.message ?? code,
      options.cause === undefined ? undefined : { cause: options.cause },
    );
    this.name = "ImageError";
    this.code = code;
    if (options.details !== undefined) this.details = options.details;
  }

  get status(): number {
    return statusForImageError(this.code);
  }
}

export function isImageError(value: unknown): value is ImageError {
  return value instanceof ImageError;
}

export function describeError(error: unknown): string {
  if (error instanceof DOMException) return `${error.name}: ${error.message}`;
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;

  const named = describeNamedFailure(error);
  if (named !== undefined) return named;

  try {
    return JSON.stringify(error) ?? String(error);
  } catch {
    return String(error);
  }
}

function describeNamedFailure(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null) return undefined;

  try {
    const candidate = value as { name?: unknown; message?: unknown };

    if (
      typeof candidate.name !== "string" ||
      typeof candidate.message !== "string"
    )
      return undefined;

    return `${candidate.name}: ${candidate.message}`;
  } catch {
    return undefined;
  }
}
