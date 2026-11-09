import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const MODULE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TESTS_DIR = resolve(MODULE_ROOT, "tests");

const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)["']([^"']+)["']/g;

function collectTsFiles(directory: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const child = join(directory, entry.name);

    if (entry.isDirectory()) {
      if (resolve(child) === TESTS_DIR) continue;
      files.push(...collectTsFiles(child));
    } else if (
      entry.isFile() &&
      entry.name.endsWith(".ts") &&
      !entry.name.endsWith(".tsx")
    ) {
      files.push(child);
    }
  }

  return files;
}

function extractSpecifiers(source: string): string[] {
  return [...source.matchAll(SPECIFIER)].map((match) => match[1]);
}

function isAllowed(specifier: string): boolean {
  return (
    specifier.startsWith(".") ||
    specifier === "cloudinary" ||
    specifier.startsWith("node:")
  );
}

const moduleFiles = collectTsFiles(MODULE_ROOT).sort();

describe("module boundaries", () => {
  it("finds the module sources, so the sweep cannot pass vacuously", () => {
    expect(moduleFiles.length).toBeGreaterThan(10);
  });

  it("imports nothing from the host application", () => {
    const offenders = moduleFiles.flatMap((file) =>
      extractSpecifiers(readFileSync(file, "utf8"))
        .filter((specifier) => !isAllowed(specifier))
        .map(
          (specifier) =>
            `${relative(MODULE_ROOT, file)} imports "${specifier}"`,
        ),
    );

    expect(offenders).toEqual([]);
  });
});
