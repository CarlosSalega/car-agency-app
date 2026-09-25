import {
  CarType,
  FuelType,
  Transmission,
  Currency,
  CarStatus,
  PaymentMethod,
} from "@prisma/client";
import { z } from "zod";

const CarTypeEnum = z.nativeEnum(CarType);
const FuelTypeEnum = z.nativeEnum(FuelType);
const TransmissionEnum = z.nativeEnum(Transmission);
const CurrencyEnum = z.nativeEnum(Currency);
const CarStatusEnum = z.nativeEnum(CarStatus);
const PaymentMethodEnum = z.nativeEnum(PaymentMethod);

export const carSchema = z.object({
  title: z
    .string()
    .min(1, "El título es requerido")
    .max(200, "El título no puede exceder 200 caracteres"),
  brandId: z.string().min(1, "La marca es requerida"),
  modelId: z.string().min(1, "El modelo es requerido"),
  sellerId: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z.union([z.string().min(1), z.literal(""), z.null()]).optional(),
  ),
  version: z.string().optional(),
  color: z.string().optional(),
  price: z
    .number()
    .int("El precio debe ser un número entero")
    .gt(0, "El precio debe ser mayor a 0"),
  year: z
    .number()
    .int()
    .min(1900, "Introduce un año válido")
    .max(new Date().getFullYear() + 1),
  kilometers: z.number().int().min(0, "Los km deben ser mayor o igual a 0"),
  type: CarTypeEnum,
  fuelType: FuelTypeEnum,
  transmission: TransmissionEnum,
  currency: CurrencyEnum,
  description: z
    .string()
    .min(1, "La descripción es requerida")
    .min(10, "La descripción debe tener al menos 10 caracteres"),
  images: z
    .array(z.string().min(1, "Cada imagen debe tener un identificador válido"))
    .min(1, "Debes agregar al menos una imagen"),
  paymentMethods: PaymentMethodEnum.array().min(
    1,
    "Selecciona al menos una forma de pago",
  ),
  status: CarStatusEnum,
});

export type CarInput = z.infer<typeof carSchema>;
