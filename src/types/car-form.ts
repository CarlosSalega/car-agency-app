import type {
  Brand,
  Model,
  Seller,
  CarType,
  FuelType,
  Transmission,
  Currency,
  CarStatus,
  PaymentMethod,
} from "@generated/prisma/client";
import type { CarGetPayload } from "@generated/prisma/models/Car";
import type { adminCarForEditArgs } from "@/lib/queries/cars";

/**
 * Prisma 7 removed `Prisma.validator` and `Prisma.<Model>GetPayload`. The
 * payload type is now exported per model from the generated model file, and the
 * select/include argument is constrained with `satisfies` instead.
 *
 * The argument is not a parallel declaration: `getAdminCarForEdit` in
 * `src/lib/queries/cars.ts` spreads the very object this type is derived from,
 * so the type and the query cannot drift apart. The resulting type is
 * unchanged: car plus brand and model.
 */

export interface BrandWithModels extends Brand {
  models: Model[];
}

export interface CarPayload {
  title: string;
  brandId: string;
  modelId: string;
  sellerId?: string | null;
  version?: string;
  color?: string;
  year: number;
  kilometers: number;
  type: CarType;
  fuelType: FuelType;
  transmission: Transmission;
  price: number;
  currency: Currency;
  description: string;
  images: string[];
  paymentMethods: PaymentMethod[];
  status: CarStatus;
}

export type SellerOption = Pick<
  Seller,
  "id" | "firstName" | "lastName" | "phone" | "email" | "isActive"
>;

export type CarForEdit = CarGetPayload<typeof adminCarForEditArgs>;
export type CreateCarPayload = CarPayload;
export type UpdateCarPayload = Partial<CarPayload>;

/** Compile-time assertion helper: fails the build unless `T` is `true`. */
export type Assert<T extends true> = T;

/**
 * The edit form contract is exactly car + brand and model. These assertions fail
 * the build if `getAdminCarForEdit` ever grows a relation the form does not need
 * (the regression that shipped a dead `seller` relation to production).
 */
export type _ForEditHasNoUser = Assert<
  "user" extends keyof CarForEdit ? false : true
>;
export type _ForEditHasNoSeller = Assert<
  "seller" extends keyof CarForEdit ? false : true
>;
