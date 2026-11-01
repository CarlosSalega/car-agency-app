import { carTypeLabels, fuelLabels } from "@/lib/constants/constants";

/**
 * Inventory export with Mercado Libre's vocabulary.
 *
 * Honest about what it is: a handoff file, not a publisher. ML's bulk uploader
 * only accepts a spreadsheet **they generate per category**, so this file is for
 * reviewing the inventory in a spreadsheet, keeping a copy, and pasting values
 * into ML's own template. Nothing here can be uploaded to ML directly.
 *
 * Two details that decide whether a file is usable:
 *
 * 1. **ML caps vehicle titles at 60 characters.** Ours allow 200. Truncating
 *    silently would hide the loss, so the export reports how many rows were cut
 *    and the screen says so before the download.
 * 2. **CSV formula injection is real.** Excel executes a cell that starts with
 *    `=`, `+`, `-` or `@`, and a car title is text a collaborator typed. Those
 *    cells are prefixed with an apostrophe so opening the file cannot run
 *    anything.
 */

export const ML_MAX_TITLE_LENGTH = 60;

/** ML's columns first, in the order their template asks for. */
export const ML_COLUMNS = [
  "Título",
  "Condición",
  "Precio",
  "Moneda",
  "Año",
  "Kilómetros",
  "Marca",
  "Modelo",
  "Versión",
  "Tipo",
  "Combustible",
  "Transmisión",
  "Color",
  "Descripción",
  "Fotos",
] as const;

/** Ours, appended so a human can trace a row back to this site. */
export const EXTRA_COLUMNS = ["Estado", "Slug"] as const;

export interface ExportCar {
  title: string;
  slug: string;
  brandName: string;
  modelName: string;
  year: number;
  kilometers: number;
  price: number;
  currency: string;
  type: string;
  fuelType: string;
  transmission: string;
  color?: string | null;
  version?: string | null;
  description?: string | null;
  images: string[];
  status: string;
}

export interface ExportOptions {
  /** Builds a public absolute URL for a stored image key. */
  imageUrl: (key: string) => string;
}

function escapeCell(value: string): string {
  // A leading = + - @ turns into a formula in Excel and Sheets. Prefixing with
  // an apostrophe keeps it text; the apostrophe is not part of the value.
  const guarded = /^[=+\-@]/.test(value) ? `'${value}` : value;

  if (/[",\n\r]/.test(guarded)) {
    return `"${guarded.replace(/"/g, '""')}"`;
  }

  return guarded;
}

export function toCsv(rows: readonly (readonly string[])[]): string {
  return rows.map((row) => row.map(escapeCell).join(",")).join("\r\n");
}

function conditionFor(car: ExportCar): string {
  // Same rule as the structured data: zero kilometres is the market's "nuevo".
  return car.kilometers === 0 ? "Nuevo" : "Usado";
}

export interface MlExport {
  csv: string;
  rows: number;
  truncatedTitles: number;
  carsWithoutImages: number;
}

export function buildMlExport(
  cars: readonly ExportCar[],
  { imageUrl }: ExportOptions,
): MlExport {
  let truncatedTitles = 0;
  let carsWithoutImages = 0;

  const rows: string[][] = [[...ML_COLUMNS, ...EXTRA_COLUMNS]];

  for (const car of cars) {
    const fullTitle = car.title.trim();
    const title =
      fullTitle.length > ML_MAX_TITLE_LENGTH
        ? fullTitle.slice(0, ML_MAX_TITLE_LENGTH).trimEnd()
        : fullTitle;
    if (title.length < fullTitle.length) truncatedTitles += 1;

    const photos = car.images
      .map((key) => imageUrl(key))
      .filter((url) => /^https?:\/\//i.test(url));
    if (photos.length === 0) carsWithoutImages += 1;

    rows.push([
      title,
      conditionFor(car),
      String(car.price),
      car.currency,
      String(car.year),
      String(car.kilometers),
      car.brandName,
      car.modelName,
      car.version?.trim() ?? "",
      carTypeLabels[car.type] ?? car.type,
      fuelLabels[car.fuelType] ?? car.fuelType,
      car.transmission,
      car.color?.trim() ?? "",
      (car.description?.trim() ?? "").replace(/[\r\n]+/g, " "),
      // ML takes one URL per line inside the cell.
      photos.join("\n"),
      car.status,
      car.slug,
    ]);
  }

  return {
    csv: toCsv(rows),
    rows: cars.length,
    truncatedTitles,
    carsWithoutImages,
  };
}
