import type { Prisma } from "@generated/prisma/client";
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

/**
 * Prisma 7 removed `Prisma.validator` and `Prisma.<Model>GetPayload`. The
 * payload type is now exported per model from the generated model file, and the
 * select/include argument is constrained with `satisfies` instead.
 *
 * The resulting type is unchanged: car plus brand and model.
 */
export const carWithRelations = {
  include: {
    brand: true,
    model: true,
  },
} satisfies Prisma.CarDefaultArgs;

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

export type CarWithRelations = CarGetPayload<typeof carWithRelations>;
export type CreateCarPayload = CarPayload;
export type UpdateCarPayload = Partial<CarPayload>;
