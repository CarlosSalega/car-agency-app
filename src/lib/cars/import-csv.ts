import {
  carTypeLabels,
  fuelLabels,
  transmissionLabels,
} from "@/lib/constants/constants";

/**
 * Spreadsheet import: parsing and validation, with no database and no HTTP.
 *
 * The shape of this module is deliberate. The route that uses it runs twice over
 * the same file — once to report and once to write — and both passes call these
 * functions, so the report the admin approves is produced by exactly the code
 * that later creates the rows.
 *
 * Everything a human might type is tolerated on purpose: accented labels, either
 * thousands separator, header order, Windows line endings, a BOM. Everything that
 * would silently create a wrong car is rejected instead: `"39.5"` is not read as
 * 395, and an unknown brand is an error rather than a new brand.
 */

export const IMPORT_COLUMNS = [
  "titulo",
  "marca",
  "modelo",
  "anio",
  "kilometros",
  "precio",
  "moneda",
  "tipo",
  "combustible",
  "transmision",
  "estado",
  "color",
  "version",
  "descripcion",
  "imagenes",
] as const;

export type ImportColumn = (typeof IMPORT_COLUMNS)[number];

export const REQUIRED_COLUMNS: readonly ImportColumn[] = [
  "titulo",
  "marca",
  "modelo",
  "anio",
  "kilometros",
  "precio",
];

export const IMPORT_MAX_ROWS = 50;
/** A 50-row CSV is a few KB; anything near this is not the file we asked for. */
export const IMPORT_MAX_BYTES = 1_000_000;
export const IMPORT_MAX_IMAGE_URLS = 10;
export const MAX_TITLE_LENGTH = 200;
export const MAX_DESCRIPTION_LENGTH = 2000;

const CURRENCIES = ["ARS", "USD"] as const;
const STATUSES = [
  "AVAILABLE",
  "BY_APPOINTMENT",
  "RESERVED",
  "SOLD",
  "INACTIVE",
] as const;

export interface ImportIssue {
  field?: string;
  message: string;
}

export interface ImportRecord {
  /** The line in the spreadsheet, 1-based, counting the header as line 1. */
  line: number;
  values: Partial<Record<ImportColumn, string>>;
}

export interface NormalizedCar {
  title: string;
  brandId: string;
  brandName: string;
  modelId: string;
  modelName: string;
  year: number;
  kilometers: number;
  price: number;
  currency: (typeof CURRENCIES)[number];
  type: string;
  fuelType: string;
  transmission: string;
  status: (typeof STATUSES)[number];
  color?: string;
  version?: string;
  description?: string;
  imageUrls: string[];
}

export interface ValidRow {
  line: number;
  car: NormalizedCar;
}

export interface InvalidRow {
  line: number;
  issues: ImportIssue[];
}

export interface ImportPreview {
  total: number;
  valid: ValidRow[];
  invalid: InvalidRow[];
  /** A problem with the file itself, not with a row. Nothing can be imported. */
  fatal?: string;
}

export interface ImportLookups {
  /** Normalised brand name → brand id. */
  brands: Map<string, string>;
  /** Normalised brand name → (normalised model name → model id). */
  models: Map<string, Map<string, string>>;
}

/** Lowercase and strip accents, so "Automática" and "automatica" both match. */
export function normalizeKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** RFC 4180 with the tolerances a real spreadsheet exports. */
export function parseCsv(text: string): string[][] {
  const input = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (inQuotes) {
      if (char === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char === "\r") {
      // Swallow CR; the LF that follows closes the row.
    } else {
      field += char;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

/**
 * Turns raw rows into records, keeping the sheet's line numbers so an error can
 * say "fila 7" and the admin finds it by looking at row 7.
 */
export function buildRecords(rows: string[][]): {
  records: ImportRecord[];
  fatal?: string;
} {
  if (rows.length === 0)
    return { records: [], fatal: "El archivo está vacío." };

  const header = rows[0].map((cell) => normalizeKey(cell));
  const missing = REQUIRED_COLUMNS.filter((column) => !header.includes(column));

  if (missing.length > 0) {
    return {
      records: [],
      fatal: `Faltan columnas obligatorias: ${missing.join(", ")}.`,
    };
  }

  const records: ImportRecord[] = [];

  for (let index = 1; index < rows.length; index += 1) {
    const cells = rows[index];
    if (cells.every((cell) => cell.trim() === "")) continue;

    const values: Partial<Record<ImportColumn, string>> = {};
    header.forEach((name, column) => {
      if (!IMPORT_COLUMNS.includes(name as ImportColumn)) return;
      values[name as ImportColumn] = (cells[column] ?? "").trim();
    });

    records.push({ line: index + 1, values });
  }

  return { records };
}

/**
 * Integers only, tolerating the separators people actually type.
 *
 * `39.500.000` and `39,500,000` are thousands groups and are accepted.
 * `39.5` is rejected rather than read as 395: a price that changes by two orders
 * of magnitude because of a decimal separator is the worst failure this feature
 * could have.
 */
export function parseInteger(
  raw: string | undefined,
): { value: number } | { error: string } {
  const value = (raw ?? "").trim();
  if (value === "") return { error: "es obligatorio" };

  const grouped = /^\d{1,3}([.,]\d{3})+$/;
  const plain = /^\d+$/;

  if (grouped.test(value)) {
    return { value: Number(value.replace(/[.,]/g, "")) };
  }
  if (plain.test(value)) {
    return { value: Number(value) };
  }

  return { error: `"${value}" no es un número entero` };
}

function reverseLabels(labels: Record<string, string>): Map<string, string> {
  const map = new Map<string, string>();
  for (const [value, label] of Object.entries(labels)) {
    map.set(normalizeKey(label), value);
    map.set(normalizeKey(value), value);
  }
  return map;
}

const TYPE_BY_KEY = reverseLabels(carTypeLabels);
const FUEL_BY_KEY = reverseLabels(fuelLabels);
const TRANSMISSION_BY_KEY = reverseLabels(transmissionLabels);

function matchEnum(
  raw: string | undefined,
  map: Map<string, string>,
): string | undefined {
  if (!raw) return undefined;
  return map.get(normalizeKey(raw));
}

function parseImageUrls(raw: string | undefined): string[] {
  if (!raw) return [];

  return (
    raw
      // `|` separates them because a comma inside a quoted CSV cell is common in
      // URLs and would be ambiguous to split.
      .split("|")
      .map((url) => url.trim())
      .filter((url) => url !== "")
      .filter((url) => /^https?:\/\/\S+$/i.test(url))
      .slice(0, IMPORT_MAX_IMAGE_URLS)
  );
}

export function validateImportRows(
  records: readonly ImportRecord[],
  lookups: ImportLookups,
  now: Date = new Date(),
): ImportPreview {
  if (records.length === 0) {
    return {
      total: 0,
      valid: [],
      invalid: [],
      fatal: "No hay filas para importar.",
    };
  }

  if (records.length > IMPORT_MAX_ROWS) {
    return {
      total: records.length,
      valid: [],
      invalid: [],
      fatal: `El archivo tiene ${records.length} filas y el máximo por importación es ${IMPORT_MAX_ROWS}.`,
    };
  }

  const maxYear = now.getFullYear() + 1;
  const valid: ValidRow[] = [];
  const invalid: InvalidRow[] = [];

  for (const record of records) {
    const issues: ImportIssue[] = [];
    const { values } = record;

    const title = values.titulo?.trim() ?? "";
    if (!title) issues.push({ field: "titulo", message: "es obligatorio" });
    else if (title.length > MAX_TITLE_LENGTH) {
      issues.push({
        field: "titulo",
        message: `no puede superar ${MAX_TITLE_LENGTH} caracteres`,
      });
    }

    const brandKey = normalizeKey(values.marca ?? "");
    const brandId = brandKey ? lookups.brands.get(brandKey) : undefined;
    if (!brandKey) issues.push({ field: "marca", message: "es obligatoria" });
    else if (!brandId) {
      issues.push({
        field: "marca",
        message: `"${values.marca}" no existe en el catálogo`,
      });
    }

    const modelKey = normalizeKey(values.modelo ?? "");
    const modelId =
      brandKey && modelKey
        ? lookups.models.get(brandKey)?.get(modelKey)
        : undefined;
    if (!modelKey) issues.push({ field: "modelo", message: "es obligatorio" });
    else if (brandId && !modelId) {
      issues.push({
        field: "modelo",
        message: `"${values.modelo}" no existe para esa marca`,
      });
    }

    const year = parseInteger(values.anio);
    if ("error" in year) issues.push({ field: "anio", message: year.error });
    else if (year.value < 1900 || year.value > maxYear) {
      issues.push({
        field: "anio",
        message: `debe estar entre 1900 y ${maxYear}`,
      });
    }

    const kilometers = parseInteger(values.kilometros);
    if ("error" in kilometers)
      issues.push({ field: "kilometros", message: kilometers.error });

    const price = parseInteger(values.precio);
    if ("error" in price)
      issues.push({ field: "precio", message: price.error });
    else if (price.value <= 0)
      issues.push({ field: "precio", message: "debe ser mayor a 0" });

    const currencyKey = normalizeKey(values.moneda ?? "") || "ars";
    const currency = CURRENCIES.find(
      (code) => normalizeKey(code) === currencyKey,
    );
    if (!currency) {
      issues.push({
        field: "moneda",
        message: `"${values.moneda}" no es ARS ni USD`,
      });
    }

    const type = matchEnum(values.tipo, TYPE_BY_KEY);
    if (!type) {
      issues.push({
        field: "tipo",
        message: `"${values.tipo ?? ""}" no es un tipo válido`,
      });
    }

    const fuelType = matchEnum(values.combustible, FUEL_BY_KEY);
    if (!fuelType) {
      issues.push({
        field: "combustible",
        message: `"${values.combustible ?? ""}" no es un combustible válido`,
      });
    }

    const transmission = matchEnum(values.transmision, TRANSMISSION_BY_KEY);
    if (!transmission) {
      issues.push({
        field: "transmision",
        message: `"${values.transmision ?? ""}" no es una transmisión válida`,
      });
    }

    const statusKey = normalizeKey(values.estado ?? "") || "available";
    const status = STATUSES.find((value) => normalizeKey(value) === statusKey);
    if (!status) {
      issues.push({
        field: "estado",
        message: `"${values.estado}" no es un estado válido`,
      });
    }

    const description = values.descripcion?.trim() || undefined;
    if (description && description.length > MAX_DESCRIPTION_LENGTH) {
      issues.push({
        field: "descripcion",
        message: `no puede superar ${MAX_DESCRIPTION_LENGTH} caracteres`,
      });
    }

    if (
      issues.length > 0 ||
      !brandId ||
      !modelId ||
      "error" in year ||
      "error" in kilometers ||
      "error" in price ||
      !currency ||
      !type ||
      !fuelType ||
      !transmission ||
      !status
    ) {
      invalid.push({ line: record.line, issues });
      continue;
    }

    valid.push({
      line: record.line,
      car: {
        title,
        brandId,
        // Kept so the caller can build the slug and the cache tag without
        // querying the names again.
        brandName: values.marca?.trim() ?? "",
        modelId,
        modelName: values.modelo?.trim() ?? "",
        year: year.value,
        kilometers: kilometers.value,
        price: price.value,
        currency,
        type,
        fuelType,
        transmission,
        status,
        color: values.color?.trim() || undefined,
        version: values.version?.trim() || undefined,
        description,
        imageUrls: parseImageUrls(values.imagenes),
      },
    });
  }

  return { total: records.length, valid, invalid };
}

/** The header line a spreadsheet needs, for the template an admin downloads. */
export const IMPORT_TEMPLATE_HEADER = IMPORT_COLUMNS.join(",");
