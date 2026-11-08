import type { ForbiddenReason } from "../core/messages";
import type { Actor } from "../core/types";

export interface AuthorizeDeleteArgs<Request = unknown> {
  readonly key: string;

  readonly actor: Actor;

  readonly request: Request;
}

export type DeleteDecision =
  | { readonly allowed: true }
  | {
      readonly allowed: false;
      readonly reason?: ForbiddenReason;
      readonly message?: string;
    };

export type GetActor<Request = unknown> = (
  request: Request,
) => Promise<Actor | null | undefined> | Actor | null | undefined;

export type AuthorizeDelete<Request = unknown> = (
  args: AuthorizeDeleteArgs<Request>,
) => Promise<DeleteDecision> | DeleteDecision;
