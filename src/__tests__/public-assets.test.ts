import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guards every reference from `src/` to a file in `public/`.
 *
 * Two real 404s shipped before this test existed: the navbar pointed at
 * `/logo-2.png` after that file was replaced, and the floating WhatsApp button
 * kept pointing at `/whatsapp-fixed.svg` after it was renamed to
 * `/whatsapp.svg`. Neither broke a build, a type check or a rendering test --
 * a missing public file is invisible until someone looks at the page, and by
 * then the image is already blank for every visitor.
 *
 * Only paths with a media/file extension are considered, so route strings like
 * `/autos` or `/api/cars` are out of scope by construction.
 *
 * `prisma/seed` is swept too, and that is not scope creep: a testimonial's photo
 * arrives as a database column now, so a typo in the seed's review data ships as
 * a blank avatar exactly the way the navbar one did, while nothing in `src/` ever
 * mentions the path. `prisma/generated` is a build output and stays out.
 */
const SRC = path.resolve(__dirname, "..");
const SEED = path.resolve(__dirname, "../../prisma/seed");
const PUBLIC = path.resolve(__dirname, "../../public");

const ASSET_EXTENSION = /\.(png|jpe?g|svg|webp|avif|gif|ico)$/i;
// A quoted or template-literal absolute path, e.g. src="/logo.png".
const ASSET_REFERENCE =
  /["'`](\/[A-Za-z0-9._@/-]+\.(?:png|jpe?g|svg|webp|avif|gif|ico))["'`]/gi;

function collectSourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__" || entry.name === "node_modules") continue;
      collectSourceFiles(full, found);
    } else if (
      /\.(ts|tsx)$/.test(entry.name) &&
      !/\.test\.(ts|tsx)$/.test(entry.name)
    ) {
      found.push(full);
    }
  }
  return found;
}

interface Reference {
  from: string;
  line: number;
  asset: string;
}

function collectReferences(): Reference[] {
  const references: Reference[] = [];

  const sources = [...collectSourceFiles(SRC), ...collectSourceFiles(SEED)];

  for (const file of sources) {
    const lines = fs.readFileSync(file, "utf8").split("\n");
    lines.forEach((line, index) => {
      for (const match of line.matchAll(ASSET_REFERENCE)) {
        const asset = match[1];
        if (!ASSET_EXTENSION.test(asset)) continue;
        references.push({
          from: path.relative(path.resolve(SRC, ".."), file),
          line: index + 1,
          asset,
        });
      }
    });
  }

  return references;
}

describe("public asset references", () => {
  it("finds the references at all, so the sweep cannot pass by finding nothing", () => {
    expect(collectReferences().length).toBeGreaterThan(0);
  });

  it("resolves every referenced asset inside public/", () => {
    const missing = collectReferences()
      .filter((ref) => !fs.existsSync(path.join(PUBLIC, ref.asset)))
      .map((ref) => `${ref.from}:${ref.line} -> ${ref.asset}`);

    expect(missing).toEqual([]);
  });
});
