import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { revalidateCars } from "@/lib/cache";
import {
  IMPORT_COLUMNS,
  IMPORT_MAX_BYTES,
  buildRecords,
  parseCsv,
  validateImportRows,
  type ImportLookups,
  type ImportPreview,
  type NormalizedCar,
} from "@/lib/cars/import-csv";
import { generateSlugBase, generateUniqueSlug } from "@/lib/cars/slug";
import { prisma } from "@/lib/db";
import { ImageService } from "@/lib/images/image-service";

/**
 * Bulk inventory import.
 *
 * Two passes over the same file, and the second one re-parses and re-validates
 * instead of trusting anything the browser sends back: the report an admin
 * approves is produced by the same code that writes the rows, so a tampered
 * preview cannot create a car that never passed validation.
 *
 * `mode` defaults to `dry-run`. Forgetting the flag gives you a report, never a
 * write.
 *
 * Any authenticated user may run it, matching the single-car form: inventory is
 * a shared asset and a collaborator edits their own cars already. Users,
 * configuration and inquiries remain ADMIN-only — a different kind of data than
 * stock.
 */

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_TIMEOUT_MS = 10_000;

type Mode = "dry-run" | "confirm";

function readMode(value: FormDataEntryValue | null): Mode {
  return value === "confirm" ? "confirm" : "dry-run";
}

async function buildLookups(): Promise<ImportLookups> {
  const brands = await prisma.brand.findMany({
    select: {
      id: true,
      name: true,
      models: { select: { id: true, name: true } },
    },
  });

  const brandMap = new Map<string, string>();
  const modelMap = new Map<string, Map<string, string>>();

  for (const brand of brands) {
    const brandKey = brand.name.trim().toLowerCase();
    brandMap.set(brandKey, brand.id);
    modelMap.set(
      brandKey,
      new Map(
        brand.models.map((model) => [
          model.name.trim().toLowerCase(),
          model.id,
        ]),
      ),
    );
  }

  return { brands: brandMap, models: modelMap };
}

/** What the preview table shows: enough to recognise a row, nothing internal. */
function previewPayload(preview: ImportPreview) {
  return {
    total: preview.total,
    validCount: preview.valid.length,
    invalidCount: preview.invalid.length,
    fatal: preview.fatal ?? null,
    valid: preview.valid.map((row) => ({
      line: row.line,
      title: row.car.title,
      brand: row.car.brandName,
      model: row.car.modelName,
      year: row.car.year,
      price: row.car.price,
      currency: row.car.currency,
      images: row.car.imageUrls.length,
    })),
    invalid: preview.invalid,
  };
}

/**
 * Downloads a remote photo and hands it to the image service.
 *
 * Returns `null` instead of throwing: one dead URL must not lose the car, only
 * its photo, and the caller reports how many images were lost.
 */
async function importImage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
      redirect: "follow",
    });

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) return null;

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_IMAGE_BYTES) return null;

    const name = new URL(url).pathname.split("/").pop() || "import.jpg";
    const file = new File([buffer], name, { type: contentType });

    const uploaded = await ImageService.upload(file);
    return uploaded.key ?? null;
  } catch {
    return null;
  }
}

async function createCar(row: NormalizedCar): Promise<string> {
  const slug = await generateUniqueSlug(
    generateSlugBase(
      row.brandName,
      row.modelName,
      row.version ?? "",
      row.year,
      row.kilometers,
    ),
  );

  const car = await prisma.car.create({
    data: {
      title: row.title,
      slug,
      brandId: row.brandId,
      modelId: row.modelId,
      year: row.year,
      kilometers: row.kilometers,
      price: row.price,
      currency: row.currency,
      type: row.type as never,
      fuelType: row.fuelType as never,
      transmission: row.transmission as never,
      status: row.status as never,
      color: row.color ?? null,
      version: row.version ?? null,
      description: row.description ?? null,
    },
    select: { id: true },
  });

  return car.id;
}

/** `GET` returns the template, built from the same column list the parser reads. */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const example = [
    "Volkswagen Taos Highline 2025",
    "Volkswagen",
    "Taos",
    "2025",
    "12000",
    "39500000",
    "ARS",
    "SUV",
    "Nafta",
    "Automático",
    "AVAILABLE",
    "Gris",
    "Highline 1.4 TSI",
    "Único dueño, service oficial",
    "https://ejemplo.com/foto-1.jpg|https://ejemplo.com/foto-2.jpg",
  ].join(",");

  const csv = `${IMPORT_COLUMNS.join(",")}\n${example}\n`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="plantilla-inventario.csv"',
    },
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "No pudimos leer el archivo" },
      { status: 400 },
    );
  }

  const mode = readMode(formData.get("mode"));
  const entry = formData.get("file");

  if (!entry || typeof entry === "string") {
    return NextResponse.json(
      { error: "Adjuntá un archivo CSV" },
      { status: 400 },
    );
  }

  if (entry.size > IMPORT_MAX_BYTES) {
    return NextResponse.json(
      { error: `El archivo supera ${Math.round(IMPORT_MAX_BYTES / 1024)} KB` },
      { status: 400 },
    );
  }

  const text = await entry.text();

  // Excel on Windows often saves "CSV" as ANSI, and the accents arrive mangled.
  const encodingWarning = text.includes("\uFFFD")
    ? "El archivo no parece estar en UTF-8: los acentos pueden verse mal. Guardalo como «CSV UTF-8»."
    : null;

  const { records, fatal } = buildRecords(parseCsv(text));

  if (fatal) {
    return NextResponse.json(
      {
        mode,
        total: 0,
        validCount: 0,
        invalidCount: 0,
        valid: [],
        invalid: [],
        fatal,
        encodingWarning,
      },
      { status: 400 },
    );
  }

  const lookups = await buildLookups();
  const preview = validateImportRows(records, lookups);

  if (preview.fatal) {
    return NextResponse.json(
      { ...previewPayload(preview), mode, encodingWarning },
      { status: 400 },
    );
  }

  if (mode === "dry-run") {
    return NextResponse.json({
      ...previewPayload(preview),
      mode,
      encodingWarning,
    });
  }

  // Confirm pass: one invalid row stops the whole import. Half an inventory is
  // worse than none, because the admin cannot tell what landed.
  if (preview.invalid.length > 0 || preview.valid.length === 0) {
    return NextResponse.json(
      {
        ...previewPayload(preview),
        mode,
        encodingWarning,
        error: "Corregí las filas con problemas antes de importar",
      },
      { status: 400 },
    );
  }

  const created: {
    line: number;
    id: string;
    title: string;
    images: number;
    imagesFailed: number;
  }[] = [];
  const failed: { line: number; title: string; reason: string }[] = [];

  for (const row of preview.valid) {
    try {
      // Photos are downloaded and re-uploaded one by one; a dead URL costs that
      // photo, never the car.
      const keys: string[] = [];
      for (const url of row.car.imageUrls) {
        const key = await importImage(url);
        if (key) keys.push(key);
      }

      const id = await createCar(row.car);

      if (keys.length > 0) {
        await prisma.car.update({ where: { id }, data: { images: keys } });
      }

      await prisma.log.create({
        data: {
          action: "CREATE",
          entity: "Car",
          entityId: id,
          metadata: JSON.stringify({ via: "import", line: row.line }),
          userId: session.user.id,
        },
      });

      created.push({
        line: row.line,
        id,
        title: row.car.title,
        images: keys.length,
        imagesFailed: row.car.imageUrls.length - keys.length,
      });
    } catch (error) {
      failed.push({
        line: row.line,
        title: row.car.title,
        reason: error instanceof Error ? error.message : "error desconocido",
      });
    }
  }

  if (created.length > 0) revalidateCars();

  return NextResponse.json({
    mode,
    created,
    failed,
    encodingWarning,
    total: preview.total,
  });
}
