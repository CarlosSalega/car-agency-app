import type { CarStatus } from "@generated/prisma/enums";

import {
  carTypeLabels,
  fuelLabels,
  transmissionLabels,
} from "@/lib/constants/constants";

/**
 * `Vehicle` structured data for a car page.
 *
 * The landing already publishes an `AutoDealer`; this is what makes an
 * individual unit legible to Google's vehicle surfaces, which need the price and
 * the availability to attach to the item rather than to the business.
 *
 * Two rules that are easy to get wrong:
 *
 * 1. **The licence plate (`patent`) is never published.** It identifies a
 *    physical car and its owner, and it has no SEO value. A regression test
 *    guards this.
 * 2. **Availability is derived from the same status the visitor sees.** A
 *    reserved car is not `InStock`: telling Google otherwise produces a click
 *    that ends in "ya está vendido".
 *
 * Labels come from the constants the UI already uses, so the markup and the page
 * say the same thing in the same words.
 */

const SCHEMA = "https://schema.org";

export const AVAILABILITY_BY_STATUS: Record<CarStatus, string> = {
  // On the lot and open to offers.
  AVAILABLE: `${SCHEMA}/InStock`,
  // Visit by appointment: real stock, restricted access.
  BY_APPOINTMENT: `${SCHEMA}/LimitedAvailability`,
  // A deposit is holding it, so it cannot be bought by whoever is reading.
  RESERVED: `${SCHEMA}/OutOfStock`,
  SOLD: `${SCHEMA}/SoldOut`,
  // Withdrawn from sale without being sold.
  INACTIVE: `${SCHEMA}/OutOfStock`,
};

export interface JsonLdCar {
  id: string;
  title: string;
  slug: string;
  images: string[];
  year: number;
  kilometers: number;
  type: string;
  fuelType: string;
  transmission: string;
  currency: string;
  price: number;
  status: CarStatus;
  color?: string | null;
  version?: string | null;
  description?: string | null;
  brand: { name: string };
  model: { name: string };
}

export interface CarJsonLdOptions {
  /** Origin without a trailing slash, e.g. `https://example.com`. */
  siteUrl: string;
  dealerName: string;
  /** Builds an absolute URL for a stored image key. */
  imageUrl: (key: string) => string;
  /** Absolute URL used when the car has no photos. */
  fallbackImageUrl: string;
}

/** `0 km` is the market signal for "never driven"; anything else is used. */
function conditionFor(kilometers: number): string {
  return kilometers === 0
    ? `${SCHEMA}/NewCondition`
    : `${SCHEMA}/UsedCondition`;
}

function absolute(siteUrl: string, path: string): string {
  const base = siteUrl.replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function buildCarJsonLd(
  car: JsonLdCar,
  { siteUrl, dealerName, imageUrl, fallbackImageUrl }: CarJsonLdOptions,
): Record<string, unknown> {
  const url = absolute(siteUrl, `/autos/${car.slug}`);
  const condition = conditionFor(car.kilometers);
  const images =
    car.images.length > 0
      ? car.images.map((key) => imageUrl(key))
      : [fallbackImageUrl];

  return {
    "@context": SCHEMA,
    "@type": "Vehicle",
    name: car.title,
    url,
    // The stored id is stable and public-safe; the plate is not included.
    sku: car.id,
    image: images,
    description:
      car.description?.trim() ||
      `${car.title} ${car.year}, ${car.kilometers.toLocaleString("es-AR")} km, ${fuelLabels[car.fuelType] ?? car.fuelType}.`,
    brand: { "@type": "Brand", name: car.brand.name },
    model: car.model.name,
    vehicleModelDate: String(car.year),
    bodyType: carTypeLabels[car.type] ?? car.type,
    fuelType: fuelLabels[car.fuelType] ?? car.fuelType,
    vehicleTransmission:
      transmissionLabels[car.transmission] ?? car.transmission,
    mileageFromOdometer: {
      "@type": "QuantitativeValue",
      value: car.kilometers,
      // UN/CEFACT code for kilometres.
      unitCode: "KMT",
    },
    ...(car.color ? { color: car.color } : {}),
    ...(car.version ? { vehicleConfiguration: car.version } : {}),
    itemCondition: condition,
    offers: {
      "@type": "Offer",
      price: car.price,
      priceCurrency: car.currency,
      availability: AVAILABILITY_BY_STATUS[car.status],
      itemCondition: condition,
      url,
      seller: { "@type": "AutoDealer", name: dealerName },
    },
  };
}
