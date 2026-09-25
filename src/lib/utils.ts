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

export function getPublicIdFromUrl(url: string): string {
  if (!url || !url.includes("res.cloudinary.com")) {
    return "placeholder";
  }

  try {
    const urlObject = new URL(url);
    const pathParts = urlObject.pathname.split("/").filter(Boolean);

    const uploadIndex = pathParts.indexOf("upload");
    if (uploadIndex === -1 || uploadIndex >= pathParts.length - 1) {
      return "placeholder";
    }

    let publicIdPath = pathParts.slice(uploadIndex + 1).join("/");

    if (publicIdPath.startsWith("v")) {
      const versionMatch = publicIdPath.match(/^v\d+\/(.+)$/);
      if (versionMatch) {
        publicIdPath = versionMatch[1];
      }
    }

    const publicId = publicIdPath.replace(/\.[^.]+$/, "");

    return publicId || "placeholder";
  } catch {
    return "placeholder";
  }
}
