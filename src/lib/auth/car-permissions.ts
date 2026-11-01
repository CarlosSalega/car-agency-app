/**
 * Who may edit a car.
 *
 * This rule existed twice — once in `PUT` and once in `DELETE` in the API — and
 * nowhere in the edit page, which is how a collaborator could open somebody
 * else's car in the form and only discover the limit when saving. One function,
 * used by every layer, is what keeps the page and the endpoint from drifting
 * apart again.
 *
 * The rule: an administrator manages any car; a collaborator manages the ones
 * they created. A car with no owner is nobody's, so only an administrator can
 * touch it.
 */

export type CarManager = {
  id: string;
  role: "ADMIN" | "COLLABORATOR";
};

export function canManageCar(
  car: { userId: string | null },
  user: CarManager,
): boolean {
  if (user.role === "ADMIN") return true;

  return car.userId !== null && car.userId === user.id;
}

/**
 * The same question for a page that must answer before rendering.
 * Kept next to the rule so the copy of the message cannot drift either.
 */
export const CAR_FORBIDDEN_MESSAGE =
  "No tienes permiso para editar este vehículo";
