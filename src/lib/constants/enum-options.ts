// Enum values come from `enums.ts`, not `client.ts`. `client.ts` re-exports the
// enums but also the Prisma runtime, whose first import is `node:module`.
// Pulling that into a browser chunk fails the build, so anything that needs an
// enum as a value must come from the dependency-free `enums` module.
import {
  CarType,
  FuelType,
  Transmission,
  Currency,
  CarStatus,
  PaymentMethod,
} from "@generated/prisma/enums";

export const CAR_TYPE_OPTIONS = [
  { value: CarType.SEDAN, label: "Sedán" },
  { value: CarType.SUV, label: "SUV" },
  { value: CarType.HATCHBACK, label: "Hatchback" },
  { value: CarType.PICKUP, label: "Pickup" },
  { value: CarType.VAN, label: "Furgón" },
  { value: CarType.COUPE, label: "Coupé" },
] as const;

export const FUEL_TYPE_OPTIONS = [
  { value: FuelType.GASOLINE, label: "Nafta" },
  { value: FuelType.DIESEL, label: "Diesel" },
  { value: FuelType.ELECTRIC, label: "Eléctrico" },
  { value: FuelType.HYBRID, label: "Híbrido" },
  { value: FuelType.CNG, label: "GNC" },
  { value: FuelType.OTHER, label: "Otro" },
] as const;

export const TRANSMISSION_OPTIONS = [
  { value: Transmission.MANUAL, label: "Manual" },
  { value: Transmission.AUTOMATIC, label: "Automática" },
] as const;

export const CURRENCY_OPTIONS = [
  { value: Currency.ARS, label: "ARS" },
  { value: Currency.USD, label: "USD" },
] as const;

export const CAR_STATUS_OPTIONS = [
  { value: CarStatus.AVAILABLE, label: "Disponible" },
  { value: CarStatus.BY_APPOINTMENT, label: "Con cita previa" },
  { value: CarStatus.RESERVED, label: "Reservado" },
  { value: CarStatus.SOLD, label: "Vendido" },
  { value: CarStatus.INACTIVE, label: "Inactivo" },
] as const;

export const PAYMENT_METHOD_OPTIONS = [
  { value: PaymentMethod.CONTADO, label: "Contado" },
  { value: PaymentMethod.BNA_MAS, label: "BNA+" },
  { value: PaymentMethod.CREDITO_PRENDARIO, label: "Crédito prendario" },
  { value: PaymentMethod.TARJETA_CREDITO, label: "Tarjeta de crédito" },
  { value: PaymentMethod.PERMUTA, label: "Permuta" },
] as const;
