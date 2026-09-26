import type { CarInput } from "@/lib/validations/car";
import type { CarWithRelations, CarPayload } from "@/types/car-form";
// Enum value, not a type: see the note in `src/lib/constants/enum-options.ts`.
import { PaymentMethod } from "@generated/prisma/enums";

export function carToFormValues(car?: CarWithRelations): Partial<CarInput> {
  if (!car) return getDefaultFormValues();

  return {
    title: car.title || "",
    brandId: car.brandId || "",
    modelId: car.modelId || "",
    sellerId: car.sellerId || "",
    version: car.version || "",
    color: car.color || "",
    year: car.year ?? 0,
    kilometers: car.kilometers ?? 0,
    type: car.type || "SEDAN",
    fuelType: car.fuelType || "GASOLINE",
    transmission: car.transmission || "MANUAL",
    price: car.price ?? 0,
    currency: car.currency || "ARS",
    description: car.description || "",
    images: Array.isArray(car.images) ? car.images : [],
    paymentMethods: Array.isArray(car.paymentMethods) ? car.paymentMethods : [],
    status: car.status || "AVAILABLE",
  };
}

export function formValuesToPayload(data: CarInput): CarPayload {
  return {
    title: data.title,
    brandId: data.brandId,
    modelId: data.modelId,
    sellerId:
      typeof data.sellerId === "string" && data.sellerId.trim()
        ? data.sellerId
        : null,
    version: data.version,
    color: data.color,
    year: data.year,
    kilometers: data.kilometers,
    type: data.type,
    fuelType: data.fuelType,
    transmission: data.transmission,
    price: data.price,
    currency: data.currency,
    description: data.description,
    images: Array.isArray(data.images) ? data.images : [],
    paymentMethods: Array.isArray(data.paymentMethods)
      ? data.paymentMethods
      : [],
    status: data.status,
  };
}

export function getDefaultFormValues(): Partial<CarInput> {
  return {
    type: "SEDAN",
    fuelType: "GASOLINE",
    transmission: "MANUAL",
    currency: "ARS",
    status: "AVAILABLE",
    images: [],
    paymentMethods: [PaymentMethod.CONTADO, PaymentMethod.CREDITO_PRENDARIO],
    title: "",
    brandId: "",
    modelId: "",
    sellerId: "",
    version: "",
    color: "",
    year: 0,
    kilometers: 0,
    price: 0,
    description: "",
  };
}
