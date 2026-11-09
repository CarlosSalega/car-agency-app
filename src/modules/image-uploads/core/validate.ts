import type { UploadableFile } from "./types";

export interface UploadValidationPolicy {
  readonly maxBytes?: number;

  readonly mimePrefixes?: readonly string[];

  readonly allowedMimeTypes?: readonly string[];

  readonly blockedMimeTypes?: readonly string[];
}

export type FileRejectionCode = "NO_FILE" | "INVALID_TYPE" | "TOO_LARGE";

export interface FileRejection {
  readonly ok: false;
  readonly code: FileRejectionCode;
  readonly details: Record<string, unknown>;
}

export type FileValidation =
  | { readonly ok: true; readonly file: UploadableFile }
  | FileRejection;

export const DEFAULT_MIME_PREFIXES: readonly string[] = ["image/"];

export const DEFAULT_BLOCKED_MIME_TYPES: readonly string[] = ["image/svg+xml"];

export function isUploadableFile(value: unknown): value is UploadableFile {
  if (typeof value !== "object" || value === null) return false;

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate["arrayBuffer"] === "function" &&
    typeof candidate["size"] === "number" &&
    typeof candidate["type"] === "string"
  );
}

export function validateUploadFile(
  input: unknown,
  policy: UploadValidationPolicy = {},
): FileValidation {
  if (!isUploadableFile(input)) {
    return {
      ok: false,
      code: "NO_FILE",
      details: { received: input === null ? "null" : typeof input },
    };
  }

  const requestedType = input.type.toLowerCase();
  const accepted = policy.allowedMimeTypes
    ? [...policy.allowedMimeTypes]
    : [...(policy.mimePrefixes ?? DEFAULT_MIME_PREFIXES)];
  const normalised = accepted.map((entry) => entry.toLowerCase());
  const blocked = policy.blockedMimeTypes ?? DEFAULT_BLOCKED_MIME_TYPES;
  const blockedNormalised = blocked.map((entry) => entry.toLowerCase());

  if (blockedNormalised.includes(requestedType)) {
    return {
      ok: false,
      code: "INVALID_TYPE",
      details: { type: input.type, accepted },
    };
  }

  const typeAccepted = policy.allowedMimeTypes
    ? normalised.includes(requestedType)
    : normalised.some(
        (prefix) =>
          requestedType.length > 0 && requestedType.startsWith(prefix),
      );

  if (!typeAccepted) {
    return {
      ok: false,
      code: "INVALID_TYPE",
      details: { type: input.type, accepted },
    };
  }

  if (policy.maxBytes !== undefined && input.size > policy.maxBytes) {
    return {
      ok: false,
      code: "TOO_LARGE",
      details: { size: input.size, maxBytes: policy.maxBytes },
    };
  }

  return { ok: true, file: input };
}
