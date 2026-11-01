import { describe, expect, it } from "vitest";

import {
  EXTRA_COLUMNS,
  ML_COLUMNS,
  ML_MAX_TITLE_LENGTH,
  buildMlExport,
  toCsv,
  type ExportCar,
} from "../export-csv";

const car: ExportCar = {
  title: "Volkswagen Taos Highline 2025",
  slug: "volkswagen-taos-2025",
  brandName: "Volkswagen",
  modelName: "Taos",
  year: 2025,
  kilometers: 12000,
  price: 39500000,
  currency: "ARS",
  type: "SUV",
  fuelType: "GASOLINE",
  transmission: "Automático",
  color: "Gris",
  version: "Highline 1.4 TSI",
  description: "Único dueño",
  images: ["taos-1", "taos-2"],
  status: "AVAILABLE",
};

const options = {
  imageUrl: (key: string) => `https://cdn.example/${key}.jpg`,
};

function parseFirstDataRow(csv: string): string[] {
  // The header is line one; a row with a newline inside a cell would need a real
  // parser, and the cases that do are asserted through `toCsv` directly.
  return csv.split("\r\n")[1].split(",");
}

describe("toCsv", () => {
  it("writes a header and rows separated by CRLF", () => {
    expect(
      toCsv([
        ["a", "b"],
        ["c", "d"],
      ]),
    ).toBe("a,b\r\nc,d");
  });

  it("quotes cells containing a comma, a quote or a newline", () => {
    expect(toCsv([["a,b"]])).toBe('"a,b"');
    expect(toCsv([['dijo "hola"']])).toBe('"dijo ""hola"""');
    expect(toCsv([["linea1\nlinea2"]])).toBe('"linea1\nlinea2"');
  });

  it("neutralises a cell Excel would run as a formula", () => {
    // A car title is text a collaborator typed; opening the file must not
    // execute anything.
    expect(toCsv([["=1+1"]])).toBe("'=1+1");
    expect(toCsv([["+54 342 5777646"]])).toBe("'+54 342 5777646");
    expect(toCsv([["-descuento"]])).toBe("'-descuento");
    expect(toCsv([["@usuario"]])).toBe("'@usuario");
  });

  it("leaves a normal value untouched", () => {
    expect(toCsv([["Volkswagen Taos"]])).toBe("Volkswagen Taos");
  });
});

describe("buildMlExport", () => {
  it("writes ML's columns first and ours last", () => {
    const { csv } = buildMlExport([car], options);
    const header = csv.split("\r\n")[0];

    expect(header).toBe([...ML_COLUMNS, ...EXTRA_COLUMNS].join(","));
    expect(
      header.startsWith("Título,Condición,Precio,Moneda,Año,Kilómetros"),
    ).toBe(true);
    expect(header.endsWith("Estado,Slug")).toBe(true);
  });

  it("fills the row with the car, translating the enums to Spanish", () => {
    const row = parseFirstDataRow(buildMlExport([car], options).csv);

    expect(row[0]).toBe("Volkswagen Taos Highline 2025");
    expect(row[1]).toBe("Usado");
    expect(row[2]).toBe("39500000");
    expect(row[3]).toBe("ARS");
    expect(row[4]).toBe("2025");
    expect(row[5]).toBe("12000");
    expect(row[6]).toBe("Volkswagen");
    expect(row[7]).toBe("Taos");
    expect(row[9]).toBe("SUV");
    expect(row[10]).toBe("Nafta");
  });

  it("calls a zero-kilometre car Nuevo, the same rule as the structured data", () => {
    const row = parseFirstDataRow(
      buildMlExport([{ ...car, kilometers: 0 }], options).csv,
    );

    expect(row[1]).toBe("Nuevo");
  });

  it("counts the titles it had to cut to ML's 60 characters", () => {
    const long = { ...car, title: "x".repeat(90) };
    const result = buildMlExport([long, car], options);

    expect(result.truncatedTitles).toBe(1);
    const firstRowTitle = result.csv.split("\r\n")[1].split(",")[0];
    expect(firstRowTitle).toHaveLength(ML_MAX_TITLE_LENGTH);
  });

  it("puts each photo on its own line inside the cell", () => {
    const { csv } = buildMlExport([car], options);

    expect(csv).toContain(
      '"https://cdn.example/taos-1.jpg\nhttps://cdn.example/taos-2.jpg"',
    );
  });

  it("drops image urls that are not absolute, and counts the car as photoless", () => {
    const result = buildMlExport([{ ...car, images: ["missing"] }], {
      imageUrl: () => "/placeholder.webp",
    });

    expect(result.carsWithoutImages).toBe(1);
    expect(result.csv).not.toContain("/placeholder.webp");
  });

  it("flattens a multi-line description so a row stays one row", () => {
    const result = buildMlExport(
      [{ ...car, description: "linea1\nlinea2" }],
      options,
    );

    expect(result.csv.split("\r\n")).toHaveLength(2);
    expect(result.csv).toContain("linea1 linea2");
  });

  it("reports the number of cars even when there are none", () => {
    const result = buildMlExport([], options);

    expect(result.rows).toBe(0);
    expect(result.csv.split("\r\n")).toHaveLength(1);
  });
});
