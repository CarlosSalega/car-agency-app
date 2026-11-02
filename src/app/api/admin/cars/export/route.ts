import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { buildMlExport, type ExportCar } from "@/lib/cars/export-csv";
import { activeSite } from "@/site/active";
import { prisma } from "@/lib/db";
import { resolveImageUrl } from "@/lib/images/resolve-image-url";

/**
 * Inventory as a spreadsheet, with Mercado Libre's column names.
 *
 * A download, not a publication: ML's bulk uploader only accepts a spreadsheet it
 * generates per category, so this file is for reviewing the inventory, keeping a
 * copy, and pasting into ML's own template.
 *
 * `scope=public` (the default) exports exactly what the sitemap sends to Google,
 * which is what you would offer for sale. `scope=all` includes sold, reserved and
 * inactive units, for a full-review file.
 *
 * The counts in the `X-Export-*` headers are a bonus for anything that reads this
 * over fetch; the plain download link cannot show them, so the screen states the
 * truncation rule up front instead.
 */

function todayStamp(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function absoluteImageUrl(key: string): string {
  const resolved = resolveImageUrl(key, "detail");

  // `resolveImageUrl` falls back to a local path when the CDN is not configured.
  // A relative URL is useless in a marketplace file, so make it absolute instead
  // of dropping it.
  if (/^https?:\/\//i.test(resolved)) return resolved;

  const base = activeSite.url.replace(/\/$/, "");
  return `${base}${resolved.startsWith("/") ? resolved : `/${resolved}`}`;
}

export async function GET(request: NextRequest) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const scope =
    request.nextUrl.searchParams.get("scope") === "all" ? "all" : "public";

  const cars = await prisma.car.findMany({
    where:
      scope === "public"
        ? { status: { in: ["AVAILABLE", "BY_APPOINTMENT"] }, deletedAt: null }
        : { deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      title: true,
      slug: true,
      year: true,
      kilometers: true,
      price: true,
      currency: true,
      type: true,
      fuelType: true,
      transmission: true,
      color: true,
      version: true,
      description: true,
      images: true,
      status: true,
      brand: { select: { name: true } },
      model: { select: { name: true } },
    },
  });

  const rows: ExportCar[] = cars.map((car) => ({
    title: car.title,
    slug: car.slug,
    brandName: car.brand.name,
    modelName: car.model.name,
    year: car.year,
    kilometers: car.kilometers,
    price: car.price,
    currency: car.currency,
    type: car.type,
    fuelType: car.fuelType,
    transmission: car.transmission,
    color: car.color,
    version: car.version,
    description: car.description,
    images: Array.isArray(car.images) ? car.images : [],
    status: car.status,
  }));

  const result = buildMlExport(rows, { imageUrl: absoluteImageUrl });

  // The BOM makes Excel open UTF-8 with the accents intact instead of guessing
  // ANSI, which is what turns "Único dueño" into mojibake.
  const body = `\uFEFF${result.csv}`;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="inventario-${todayStamp(new Date())}.csv"`,
      "X-Export-Rows": String(result.rows),
      "X-Export-Truncated-Titles": String(result.truncatedTitles),
      "X-Export-Cars-Without-Images": String(result.carsWithoutImages),
    },
  });
}
