import type { Actor, DeleteDecision } from "@/modules/image-uploads";

/**
 * Who may delete a stored image, with the data access injected.
 *
 * The route supplies the Prisma queries; this module owns only the decision,
 * so the rule is testable without a database and cannot drift from the guard
 * order: ADMIN → owner of a car using the key → uploader of a key no car
 * uses → refuse.
 *
 * The car always decides when one uses the key. An upload record on its own
 * must never authorise deleting a photo already published on a vehicle.
 */
export interface CarUsingKey {
  readonly userId: string | null;
}

export interface UploadRecord {
  readonly userId: string;
}

export interface AuthorizeDeleteDeps {
  findCarsUsingKey(key: string): Promise<readonly CarUsingKey[]>;

  findUploadByKey(key: string): Promise<UploadRecord | null>;
}

export type AuthorizeDeleteForKey = (args: {
  readonly key: string;
  readonly actor: Actor;
}) => Promise<DeleteDecision>;

export function createAuthorizeDelete(
  deps: AuthorizeDeleteDeps,
): AuthorizeDeleteForKey {
  return async ({ key, actor }) => {
    const cars = await deps.findCarsUsingKey(key);

    if (cars.length > 0) {
      if (actor.role === "ADMIN") return { allowed: true };

      return cars.some((car) => car.userId === actor.id)
        ? { allowed: true }
        : { allowed: false, reason: "OTHER_OWNER" };
    }

    if (actor.role === "ADMIN") return { allowed: true };

    const upload = await deps.findUploadByKey(key);

    if (upload === null) return { allowed: false, reason: "NOT_OWNED" };

    return upload.userId === actor.id
      ? { allowed: true }
      : { allowed: false, reason: "OTHER_OWNER" };
  };
}
