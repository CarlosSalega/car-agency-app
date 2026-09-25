import { Prisma } from "@prisma/client";
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
} from "@prisma/client";

export const carWithRelations = Prisma.validator<Prisma.CarDefaultArgs>()({
  include: {
    brand: true,
    model: true,
    seller: true,
  },
});

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

export type CarWithRelations = Prisma.CarGetPayload<typeof carWithRelations>;
export type CreateCarPayload = CarPayload;
export type UpdateCarPayload = Partial<CarPayload>;
