import type { ImageErrorCode } from "../core/errors";
import { describeError } from "../core/errors";
import type { ForbiddenReason } from "../core/messages";
import type { Actor, UploadableFile } from "../core/types";
import type { UploadValidationPolicy } from "../core/validate";
import { validateUploadFile } from "../core/validate";
import type { AuthorizeDelete, GetActor } from "./types";

export interface GuardDenial {
  readonly ok: false;
  readonly code: ImageErrorCode;

  readonly reason?: ForbiddenReason;

  readonly message?: string;

  readonly details?: Record<string, unknown>;
}

export type AuthenticationDecision =
  | { readonly ok: true; readonly actor: Actor }
  | GuardDenial;

export type FileDecision =
  | { readonly ok: true; readonly file: UploadableFile }
  | GuardDenial;

export type DeleteAuthorizationDecision = { readonly ok: true } | GuardDenial;

export async function evaluateAuthentication<Request>(
  request: Request,
  getActor: GetActor<Request>,
): Promise<AuthenticationDecision> {
  const actor = await getActor(request);

  if (!actor || typeof actor.id !== "string" || actor.id.length === 0) {
    return { ok: false, code: "UNAUTHENTICATED" };
  }

  return { ok: true, actor };
}

export function evaluateUploadFile(
  input: unknown,
  policy: UploadValidationPolicy = {},
): FileDecision {
  const validation = validateUploadFile(input, policy);

  if (validation.ok) {
    return { ok: true, file: validation.file };
  }

  return { ok: false, code: validation.code, details: validation.details };
}

export interface EvaluateDeleteArgs<Request> {
  readonly request: Request;
  readonly actor: Actor;
  readonly key: string;
  readonly authorizeDelete?: AuthorizeDelete<Request>;
}

export async function evaluateDelete<Request>({
  request,
  actor,
  key,
  authorizeDelete,
}: EvaluateDeleteArgs<Request>): Promise<DeleteAuthorizationDecision> {
  if (!authorizeDelete) {
    return {
      ok: false,
      code: "FORBIDDEN",
      details: { cause: "authorizeDelete is not configured" },
    };
  }

  let decision: Awaited<ReturnType<AuthorizeDelete<Request>>>;

  try {
    decision = await authorizeDelete({ request, actor, key });
  } catch (error) {
    return {
      ok: false,
      code: "FORBIDDEN",
      details: { error: describeError(error) },
    };
  }

  if (decision.allowed) {
    return { ok: true };
  }

  return {
    ok: false,
    code: "FORBIDDEN",
    ...(decision.reason === undefined ? {} : { reason: decision.reason }),
    ...(decision.message === undefined ? {} : { message: decision.message }),
  };
}
