import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Fails when the product starts naming the client.
 *
 * The product is **single tenant but resold**: one deployment per dealership, and
 * the next one is a copy of this repository with a different `src/site/<client>/`.
 * Every hardcoded "GL Autos", phone number or street is therefore a bug waiting
 * for client #2 — the deployment would show one dealership's name, phone and
 * address on another dealership's site.
 *
 * This is the acceptance criterion of the white-label refactor, expressed as a
 * test so it cannot regress the first time somebody hardcodes a phone number
 * "just for this page".
 *
 * Two deliberate choices:
 *
 * 1. **Tests are out of scope.** A fixture may name anybody; what matters is what
 *    ships.
 * 2. **A positive control runs first.** A sweep that finds nothing because the
 *    globs are wrong looks exactly like a clean sweep, which is how a guard rots.
 */

const SRC = path.resolve(__dirname, "../..");
const SEAM = path.join(SRC, "site");

/**
 * The client's identifying strings. Kept as a list in the test, not derived from
 * `src/site/`, because a guard that reads its rules from the thing it guards can
 * be silenced by editing that thing.
 */
const CLIENT_MARKERS = [
  "GL Autos",
  "GL AUTOS",
  "glautos",
  "5493425777646",
  "General López 3543",
  // La forma abreviada es la que se publica hoy; la larga queda por si vuelve.
  "Gral. López 3543",
  "gl.autos.sf",
];

const CODE_EXTENSIONS = new Set([".ts", ".tsx", ".css"]);

function collectFiles(dir: string, found: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "__tests__") continue;
      // The seam is allowed to name the client: that is its whole job.
      if (full === SEAM) continue;
      collectFiles(full, found);
      continue;
    }

    if (!CODE_EXTENSIONS.has(path.extname(entry.name))) continue;
    if (entry.name.includes(".test.")) continue;

    found.push(full);
  }

  return found;
}

interface Finding {
  file: string;
  line: number;
  marker: string;
  text: string;
}

function findClientMarkers(files: string[]): Finding[] {
  const findings: Finding[] = [];

  for (const file of files) {
    fs.readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, index) => {
        for (const marker of CLIENT_MARKERS) {
          if (line.includes(marker)) {
            findings.push({
              file: path.relative(SRC, file),
              line: index + 1,
              marker,
              text: line.trim().slice(0, 100),
            });
          }
        }
      });
  }

  return findings;
}

describe("the product does not know which client it serves", () => {
  const files = collectFiles(SRC);

  it("sweeps something, so a broken glob cannot pass as a clean sweep", () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it("would catch a leak, proved against the seam it excludes", () => {
    // The positive control: the same function, pointed at the client package it
    // refuses to scan above, has to find the markers.
    const seamFiles = fs
      .readdirSync(path.join(SEAM, "glautos"))
      .filter((name) => CODE_EXTENSIONS.has(path.extname(name)))
      .map((name) => path.join(SEAM, "glautos", name));

    expect(findClientMarkers(seamFiles).length).toBeGreaterThan(0);
  });

  it("has no client name, phone, address or domain outside src/site", () => {
    const findings = findClientMarkers(files).map(
      (finding) =>
        `${finding.file}:${finding.line} [${finding.marker}] ${finding.text}`,
    );

    expect(findings).toEqual([]);
  });
});
