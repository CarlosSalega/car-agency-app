import { CAR_TYPE_OPTIONS } from "./enum-options";

export const FALLBACK_IMAGE = "/placeholder.webp";

/**
 * Derived from `CAR_TYPE_OPTIONS` so the enum, the admin form and the public
 * detail page cannot drift apart.
 */
export const carTypeLabels: Record<string, string> = Object.fromEntries(
  CAR_TYPE_OPTIONS.map((option) => [option.value, option.label]),
);

export const fuelLabels: Record<string, string> = {
  GASOLINE: "Nafta",
  DIESEL: "Diesel",
  ELECTRIC: "Eléctrico",
  HYBRID: "Híbrido",
  CNG: "GNC",
};

export const transmissionLabels: Record<string, string> = {
  AUTOMATIC: "Automático",
  MANUAL: "Manual",
};

export const statusColors: Record<string, string> = {
  AVAILABLE: "bg-badge",
  RESERVED: "bg-warning",
  SOLD: "bg-danger",
  INACTIVE: "bg-info",
};
