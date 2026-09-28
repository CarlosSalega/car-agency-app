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

/**
 * A car as the edit form receives it: brand and model, and deliberately no owner
 * and no seller.
 *
 * Derived from `adminCarForEditArgs`, the object `getAdminCarForEdit` in
 * `src/lib/queries/cars.ts` actually spreads, so this type and the query cannot
 * drift apart.
 *
 * Prisma 7 removed `Prisma.validator` and `Prisma.<Model>GetPayload`. The payload
 * type is exported per model from the generated model file (`CarGetPayload` from
 * `@generated/prisma/models/Car`), and the argument is constrained with
 * `satisfies Prisma.CarDefaultArgs` instead. Do not reintroduce the removed APIs.
 *
 * Not interchangeable with `CarListItem`: a listing has an owner, a form must not.
 */
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
