import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function setIfParam(
  params: URLSearchParams,
  key: string,
  value?: string | null,
) {
  if (!value) return;
  const trimmedValue = value.toString().trim();
  if (trimmedValue === "" || trimmedValue === "all") return;
  params.set(key, trimmedValue);
}

export function safeJsonParse<T = unknown>(
  input: string | null | undefined,
  fallback: T,
): T {
  if (!input) return fallback;
  try {
    return JSON.parse(input) as T;
  } catch {
    return fallback;
  }
}

export function formatPrice(price: number, currency: string = "ARS") {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(price);
}

export function formatKm(km: number) {
  return new Intl.NumberFormat("es-AR").format(km);
}
