import type { Role } from "@generated/prisma/client";
import type { CarGetPayload } from "@generated/prisma/models/Car";
import type { adminCarsListArgs } from "@/lib/queries/cars";
import type { Assert, CarForEdit } from "@/types/car-form";

/**
 * A car as it appears in the admin listing: brand, model, and a narrowed owner.
 *
 * Derived from `adminCarsListArgs`, the object `getAdminCarsList` actually
 * spreads, so this type cannot drift away from the query that produces it.
 * `CarGetPayload` yields the *item* type, and the query returns an array.
 *
 * This is deliberately NOT merged with `CarForEdit`: a listing has an owner, an
 * edit form must not, and merging would force one of the queries to over-fetch.
 */
export type CarListItem = CarGetPayload<typeof adminCarsListArgs>;

/** The exact owner projection the listing query selects. */
type ListItemUser = NonNullable<CarListItem["user"]>;

/**
 * Compile-time guards for the listing contract. They fail the build if the
 * query's `user` select is widened (re-leaking `hashedPassword`) or removed.
 */
export type _ListItemUserIsExactlyFourFields = Assert<
  Exclude<keyof ListItemUser, "id" | "name" | "email" | "role"> extends never
    ? true
    : false
>;
export type _ListItemUserIsNarrowed = Assert<
  ListItemUser extends {
    id: string;
    name: string | null;
    email: string;
    role: Role;
  }
    ? true
    : false
>;

/**
 * The two contracts are not interchangeable. A form payload is missing the
 * owner, so it is not a listing item; merging them (or feeding a form payload
 * into the listing) must fail to compile rather than silently over-fetch.
 */
export type _FormPayloadIsNotAListItem = Assert<
  CarForEdit extends CarListItem ? false : true
>;
