// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The import screen is the only place an admin sees, before anything is
 * written, which rows of a spreadsheet will become cars and which will not.
 *
 * The three behaviours pinned here are the ones that make that promise real:
 * the report must show the rows that need fixing with their reason, a file with
 * any invalid row must not be confirmable, and the confirmation must send the
 * very same file back so the server can re-validate it (spec S2/S3) instead of
 * trusting a preview the browser could have tampered with.
 */

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { CarImport } from "@/components/cars/car-import";

const CSV_FILE = new File(
  [
    "titulo,marca,modelo,anio,kilometros,precio\n" +
      "Volkswagen Taos Highline 2025,Volkswagen,Taos,2025,12000,39500000\n",
  ],
  "inventario.csv",
  { type: "text/csv" },
);

const VALID_ROW = {
  line: 2,
  title: "Volkswagen Taos Highline 2025",
  brand: "Volkswagen",
  model: "Taos",
  year: 2025,
  price: 39500000,
  currency: "ARS",
  images: 2,
};

const DRY_RUN_WITH_INVALID_ROW = {
  mode: "dry-run",
  total: 2,
  validCount: 1,
  invalidCount: 1,
  fatal: null,
  valid: [VALID_ROW],
  invalid: [
    {
      line: 3,
      issues: [{ field: "marca", message: '"Fiat" no existe en el catálogo' }],
    },
  ],
  encodingWarning:
    "El archivo no parece estar en UTF-8: los acentos pueden verse mal. Guardalo como «CSV UTF-8».",
};

const DRY_RUN_ALL_VALID = {
  mode: "dry-run",
  total: 2,
  validCount: 2,
  invalidCount: 0,
  fatal: null,
  valid: [
    VALID_ROW,
    {
      line: 3,
      title: "Toyota Hilux SRV 2022",
      brand: "Toyota",
      model: "Hilux",
      year: 2022,
      price: 48000000,
      currency: "ARS",
      images: 1,
    },
  ],
  invalid: [],
  encodingWarning: null,
};

const CONFIRM_PAYLOAD = {
  mode: "confirm",
  created: [
    {
      line: 2,
      id: "car_1",
      title: "Renault Sandero Stepway 2024",
      images: 2,
      imagesFailed: 0,
    },
  ],
  failed: [],
  total: 2,
  encodingWarning: null,
};

const fetchMock = vi.fn();

function jsonResponse(payload: unknown, ok = true) {
  return { ok, status: ok ? 200 : 400, json: async () => payload };
}

function selectCsv(file: File = CSV_FILE) {
  fireEvent.change(screen.getByLabelText("Planilla CSV"), {
    target: { files: [file] },
  });
}

function confirmButton() {
  return screen.getByRole("button", {
    name: "Confirmar importación",
  }) as HTMLButtonElement;
}

beforeEach(() => {
  fetchMock.mockReset();
  refresh.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CarImport dry-run report", () => {
  it("shows the counts, the invalid rows with their reason, and blocks confirmation", async () => {
    fetchMock.mockResolvedValue(jsonResponse(DRY_RUN_WITH_INVALID_ROW));

    render(<CarImport />);
    selectCsv();

    expect(
      await screen.findByText(
        "Filas válidas: 1 · Filas con problemas: 1 · Total: 2",
      ),
    ).toBeTruthy();

    // The valid row is recognisable: line, title, brand, model, year, price.
    expect(screen.getByText("Volkswagen Taos Highline 2025")).toBeTruthy();
    expect(screen.getByText("Taos")).toBeTruthy();
    expect(screen.getByText("2025")).toBeTruthy();
    expect(screen.getByText(/39\.500\.000/)).toBeTruthy();

    // The invalid row is grouped by its spreadsheet line and names the field.
    expect(screen.getByText("Fila 3")).toBeTruthy();
    expect(
      screen.getByText('marca: "Fiat" no existe en el catálogo'),
    ).toBeTruthy();

    // An encoding problem is a notice, not a blocker: the rows still validate.
    expect(
      screen.getByText(
        "El archivo no parece estar en UTF-8: los acentos pueden verse mal. Guardalo como «CSV UTF-8».",
      ),
    ).toBeTruthy();

    // One bad row is enough to stop the write.
    expect(confirmButton().disabled).toBe(true);

    // The preview pass is a dry run and carries the file the admin picked.
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");
    const body = init.body as FormData;
    expect(body.get("mode")).toBe("dry-run");
    expect(body.get("file")).toBe(CSV_FILE);
  });

  it("enables confirmation when no row has a problem", async () => {
    fetchMock.mockResolvedValue(jsonResponse(DRY_RUN_ALL_VALID));

    render(<CarImport />);
    selectCsv();

    expect(
      await screen.findByText(
        "Filas válidas: 2 · Filas con problemas: 0 · Total: 2",
      ),
    ).toBeTruthy();

    expect(confirmButton().disabled).toBe(false);
  });

  it("shows a fatal file error as one blocking message", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          mode: "dry-run",
          total: 0,
          validCount: 0,
          invalidCount: 0,
          valid: [],
          invalid: [],
          fatal: "Faltan columnas obligatorias: marca, modelo.",
          encodingWarning: null,
        },
        false,
      ),
    );

    render(<CarImport />);
    selectCsv();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(
      "Faltan columnas obligatorias: marca, modelo.",
    );

    // A fatal file problem leaves nothing confirmable.
    expect(
      screen.queryByRole("button", { name: "Confirmar importación" }),
    ).toBeNull();
  });
});

describe("CarImport confirmation", () => {
  it("confirms with the same file and reports what was created", async () => {
    fetchMock.mockImplementation((_url, init) => {
      const body = (init as RequestInit).body as FormData;
      return Promise.resolve(
        jsonResponse(
          body.get("mode") === "confirm" ? CONFIRM_PAYLOAD : DRY_RUN_ALL_VALID,
        ),
      );
    });

    const file = new File(["titulo,marca,modelo"], "inventario-valido.csv", {
      type: "text/csv",
    });

    render(<CarImport />);
    selectCsv(file);

    await screen.findByText(
      "Filas válidas: 2 · Filas con problemas: 0 · Total: 2",
    );
    fireEvent.click(confirmButton());

    await waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });

    const [, confirmInit] = fetchMock.mock.calls[1];
    const body = (confirmInit as RequestInit).body as FormData;
    expect(body.get("mode")).toBe("confirm");
    // The same object, not a copy rebuilt from the report: the server re-parses
    // and re-validates it (S3).
    expect(body.get("file")).toBe(file);

    expect(screen.getByText("Creados: 1 · Fallidos: 0")).toBeTruthy();
    expect(screen.getByText("Renault Sandero Stepway 2024")).toBeTruthy();
  });
});
