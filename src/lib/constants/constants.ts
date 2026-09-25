export const FALLBACK_IMAGE = "/placeholder.webp";

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
