import { describe, expect, it } from "vitest";

import {
  IMPORT_MAX_ROWS,
  buildRecords,
  normalizeKey,
  parseCsv,
  parseInteger,
  validateImportRows,
  type ImportLookups,
} from "../import-csv";

const HEADER =
  "titulo,marca,modelo,anio,kilometros,precio,moneda,tipo,combustible,transmision,estado,color,version,descripcion,imagenes";

const lookups: ImportLookups = {
  brands: new Map([
    ["volkswagen", "brand-vw"],
    ["toyota", "brand-toyota"],
  ]),
  models: new Map([
    ["volkswagen", new Map([["taos", "model-taos"]])],
    ["toyota", new Map([["hilux", "model-hilux"]])],
  ]),
};

const NOW = new Date("2026-11-05T12:00:00.000Z");

function importText(...lines: string[]) {
  const { records, fatal } = buildRecords(
    parseCsv([HEADER, ...lines].join("\n")),
  );
  return { records, fatal };
}

function validate(...lines: string[]) {
  const { records, fatal } = importText(...lines);
  if (fatal) throw new Error(fatal);
  return validateImportRows(records, lookups, NOW);
}

const VALID_ROW = `Taos Highline,Volkswagen,Taos,2025,12000,39500000,ARS,SUV,Nafta,Automático,AVAILABLE,Gris,Highline,Único dueño,https://cdn.example/a.jpg|https://cdn.example/b.jpg`;

describe("parseCsv", () => {
  it("splits plain rows", () => {
    expect(parseCsv("a,b\nc,d")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("keeps commas inside quoted fields", () => {
    expect(parseCsv('a,"b,c",d')).toEqual([["a", "b,c", "d"]]);
  });

  it("reads doubled quotes as one quote", () => {
    expect(parseCsv('a,"dijo ""hola""",c')).toEqual([
      ["a", 'dijo "hola"', "c"],
    ]);
  });

  it("handles Windows line endings and a BOM", () => {
    expect(parseCsv("\uFEFFa,b\r\nc,d\r\n")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("keeps a trailing empty field", () => {
    expect(parseCsv("a,b,")).toEqual([["a", "b", ""]]);
  });

  it("returns nothing for an empty string", () => {
    expect(parseCsv("")).toEqual([]);
  });
});

describe("normalizeKey", () => {
  it("ignores accents, case and extra spaces", () => {
    expect(normalizeKey("  Automática ")).toBe("automatica");
    expect(normalizeKey("VOLKSWAGEN")).toBe("volkswagen");
  });
});

describe("buildRecords", () => {
  it("accepts the header in any order and any case", () => {
    const { records } = buildRecords(
      parseCsv(
        "MARCA,Titulo,modelo,anio,kilometros,precio\nVolkswagen,Taos,Taos,2025,1,100",
      ),
    );

    expect(records[0].values.marca).toBe("Volkswagen");
    expect(records[0].values.titulo).toBe("Taos");
  });

  it("names the missing required columns", () => {
    const { fatal } = buildRecords(parseCsv("titulo,marca\nTaos,Volkswagen"));

    expect(fatal).toContain("modelo");
    expect(fatal).toContain("precio");
  });

  it("skips blank lines but keeps the spreadsheet line numbers", () => {
    const { records } = buildRecords(
      parseCsv(`${HEADER}\n${VALID_ROW}\n\n,,,`),
    );

    expect(records).toHaveLength(1);
    // The header is line 1, so the first data row is line 2 — the number the
    // admin sees in their spreadsheet.
    expect(records[0].line).toBe(2);
  });
});

describe("parseInteger", () => {
  it("accepts a plain integer", () => {
    expect(parseInteger("39500000")).toEqual({ value: 39500000 });
  });

  it.each(["39.500.000", "39,500,000", "39500000"])(
    "accepts the thousands form %s",
    (raw) => {
      expect(parseInteger(raw)).toEqual({ value: 39500000 });
    },
  );

  it.each(["39.5", "39,5", "abc", "", "1e5"])(
    "rejects %s instead of guessing a magnitude",
    (raw) => {
      expect(parseInteger(raw)).toHaveProperty("error");
    },
  );
});

describe("validateImportRows", () => {
  it("turns a good row into a car with resolved ids and normalised enums", () => {
    const preview = validate(VALID_ROW);

    expect(preview.invalid).toEqual([]);
    expect(preview.valid[0].car).toMatchObject({
      title: "Taos Highline",
      brandId: "brand-vw",
      modelId: "model-taos",
      year: 2025,
      kilometers: 12000,
      price: 39500000,
      currency: "ARS",
      type: "SUV",
      fuelType: "GASOLINE",
      transmission: "AUTOMATIC",
      status: "AVAILABLE",
      color: "Gris",
      version: "Highline",
    });
    expect(preview.valid[0].car.imageUrls).toEqual([
      "https://cdn.example/a.jpg",
      "https://cdn.example/b.jpg",
    ]);
  });

  it("accepts the stored enum values as well as the Spanish labels", () => {
    const row = `X,Volkswagen,Taos,2025,0,100,USD,HATCHBACK,GASOLINE,AUTOMATIC,RESERVED,,,,`;

    expect(validate(row).valid[0].car).toMatchObject({
      type: "HATCHBACK",
      fuelType: "GASOLINE",
      transmission: "AUTOMATIC",
      status: "RESERVED",
      currency: "USD",
    });
  });

  it("defaults the currency to ARS and the status to AVAILABLE", () => {
    const row = `X,Volkswagen,Taos,2025,0,100,,SUV,Nafta,Manual,,,,,`;

    expect(validate(row).valid[0].car).toMatchObject({
      currency: "ARS",
      status: "AVAILABLE",
    });
  });

  it("rejects an unknown brand and names the value the admin typed", () => {
    const row = VALID_ROW.replace(",Volkswagen,", ",VW,");
    const preview = validate(row);

    expect(preview.valid).toEqual([]);
    expect(preview.invalid[0].issues).toEqual([
      { field: "marca", message: '"VW" no existe en el catálogo' },
    ]);
  });

  it("rejects a model that does not belong to the brand", () => {
    const row = VALID_ROW.replace(",Volkswagen,Taos,", ",Volkswagen,Hilux,");
    const preview = validate(row);

    expect(preview.invalid[0].issues).toEqual([
      { field: "modelo", message: '"Hilux" no existe para esa marca' },
    ]);
  });

  it("collects every problem of a row instead of stopping at the first", () => {
    const row = `,,,1800,abc,0,ARS,AVION,Naftero,Robot,,, ,`;
    const preview = validate(row);

    const fields = preview.invalid[0].issues.map((issue) => issue.field);
    expect(fields).toEqual(
      expect.arrayContaining([
        "titulo",
        "marca",
        "modelo",
        "anio",
        "kilometros",
        "precio",
        "tipo",
        "combustible",
        "transmision",
      ]),
    );
  });

  it("rejects a price of zero", () => {
    const row = VALID_ROW.replace(",39500000,", ",0,");
    const preview = validate(row);

    expect(preview.invalid[0].issues).toEqual([
      { field: "precio", message: "debe ser mayor a 0" },
    ]);
  });

  it("rejects a future year beyond the next one", () => {
    const row = VALID_ROW.replace(",2025,", ",2099,");
    const preview = validate(row);

    expect(preview.invalid[0].issues[0].field).toBe("anio");
  });

  it("skips a line of nothing but commas instead of reporting it as invalid", () => {
    const preview = validate(VALID_ROW, ",,,,,,,,,,,,,,");

    expect(preview.total).toBe(1);
    expect(preview.invalid).toEqual([]);
  });

  it("drops image entries that are not http urls and keeps the rest", () => {
    // Built from the column order instead of a hand-typed comma run: one column
    // short silently shifts every value, and this test exists to catch that.
    const row = [
      "X",
      "Volkswagen",
      "Taos",
      "2025",
      "0",
      "100",
      "ARS",
      "SUV",
      "Nafta",
      "Manual",
      "",
      "",
      "",
      "",
      '"ftp://a.jpg|https://ok/a.jpg"',
    ].join(",");
    const preview = validate(row);

    expect(preview.valid[0].car.imageUrls).toEqual(["https://ok/a.jpg"]);
  });

  it("refuses a file over the row cap instead of half importing it", () => {
    const lines = Array.from({ length: IMPORT_MAX_ROWS + 1 }, () => VALID_ROW);
    const preview = validate(...lines);

    expect(preview.fatal).toContain(`${IMPORT_MAX_ROWS}`);
    expect(preview.valid).toEqual([]);
  });

  it("reports the totals the admin sees", () => {
    // A row of nothing but commas is treated as blank and skipped, the way a
    // spreadsheet leaves trailing empty rows. This one has a title, so it is a
    // real row that fails.
    const preview = validate(VALID_ROW, "Solo un título");

    expect(preview.total).toBe(2);
    expect(preview.valid).toHaveLength(1);
    expect(preview.invalid).toHaveLength(1);
    expect(preview.invalid[0].line).toBe(3);
  });
});
