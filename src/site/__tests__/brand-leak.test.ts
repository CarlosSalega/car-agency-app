import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { activeSite } from "@/site/active";
import type { SiteDefinition } from "@/site/contract";

/**
 * Fails when the product starts naming the client it serves.
 *
 * The product is **single tenant but resold**: one deployment per dealership, and
 * the next one is a copy of this repository with a different `src/site/<client>/`.
 * Every hardcoded business name, phone number or street is therefore a bug waiting
 * for client #2 — the deployment would show one dealership's name, phone and
 * address on another dealership's site.
 *
 * This is the acceptance criterion of the white-label refactor, expressed as a
 * test so it cannot regress the first time somebody hardcodes a phone number
 * "just for this page".
 *
 * Three deliberate choices:
 *
 * 1. **Tests are out of scope.** A fixture may name anybody; what matters is what
 *    ships.
 * 2. **The markers come from the active client, not from a list in this file.**
 *    The repository now ships a demo client and every deployment supplies its
 *    own, so a literal list would guard whichever client was current the day it
 *    was typed. Reading `activeSite` makes the same test guard the demo here and
 *    the real dealership in the deployment's own copy of this file, with the
 *    client's own name and phone. That is the trade: the markers can be silenced
 *    by emptying the client's identity, which is why the derivation has its own
 *    test below, and why the sweep and the positive control still run.
 * 3. **A positive control runs first.** A sweep that finds nothing because the
 *    marker set came out empty, or because the globs are wrong, looks exactly
 *    like a clean sweep, which is how a guard rots.
 */

const SRC = path.resolve(__dirname, "../..");
const SEAM = path.join(SRC, "site");

const CODE_EXTENSIONS = new Set([".ts", ".tsx", ".css"]);

/**
 * A marker shorter than this is skipped, because four letters or fewer collide
 * with ordinary words instead of identifying a business: the demo's own id
 * (`demo`) is skipped for exactly that reason, and the name, the two phones, the
 * street and the origin still cover it. The point of the threshold is that a
 * short value makes the guard fail on innocent code, and a guard that fails
 * innocently gets weakened or deleted.
 */
const MIN_MARKER_LENGTH = 5;

interface Marker {
  /** The string that must not appear outside the seam. */
  value: string;
  /** Which fact it came from, so a finding explains itself. */
  source: string;
}

/** The host of a URL, without the scheme: `https://x.ar/a` → `x.ar`. */
function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

/** The profile segment of an Instagram URL; the bare site root has none. */
function handleOf(url: string | undefined): string {
  if (!url) return "";

  try {
    const segment = new URL(url).pathname.split("/").filter(Boolean).at(-1);
    return (segment ?? "").replace(/^@/, "");
  } catch {
    return "";
  }
}

/**
 * Every identifying string the active client publishes, with the reason each one
 * is worth scanning for.
 *
 * Only facts a visitor could read off the page, and only from the active client:
 * anything the product derives per request (inventory, hours exceptions) is not
 * an identity and cannot leak this way.
 */
function clientMarkers(site: SiteDefinition): Marker[] {
  const { identity } = site;

  const candidates: Marker[] = [
    // The folder name and the value a deployment puts in `SITE_SLUG`. It is how
    // the client is spelled in configuration and in prose, so it is the marker
    // that catches a comment or a constant naming the dealership directly.
    { value: site.id, source: "site id" },
    // The name printed in the header, the footer, the JSON-LD and every title.
    { value: identity.name, source: "display name" },
    // The number twice over: as the markup publishes it (`phoneRaw`, E.164) and
    // as a visitor reads it (`phoneDisplay`). A page that hardcodes one rarely
    // hardcodes the other, and copy-pasting either is the same defect.
    { value: identity.contact.phoneRaw, source: "raw phone" },
    { value: identity.contact.phoneDisplay, source: "display phone" },
    // Optional in the contract, so a client without a mailbox contributes
    // nothing here rather than an empty marker.
    { value: identity.contact.email ?? "", source: "contact e-mail" },
    // The street, not the full display line: the locality is a city the client
    // shares with every other business in it, and scanning for it would fail on
    // innocent code. A street with a number is recognisable on its own.
    { value: identity.address.street, source: "street" },
    // The origin the canonical tags, the sitemap and the JSON-LD point at. Only
    // the host: the scheme is noise, and a path would miss the other four pages.
    { value: hostOf(site.url), source: "site URL host" },
    // The handle behind the Instagram links, stripped of the URL around it, so
    // `@handle` and a bare `handle` in copy are caught as well.
    {
      value: handleOf(identity.social.instagram),
      source: "Instagram handle",
    },
  ];

  // Deduplicated case-insensitively: `phoneDisplay` of a client whose phone has
  // no spaces is the same string as `phoneRaw` without the `+`, and the same
  // marker reported twice is noise in the failure message.
  const markers = new Map<string, Marker>();

  for (const candidate of candidates) {
    const value = candidate.value.trim();
    if (value.length < MIN_MARKER_LENGTH) continue;

    const key = value.toLowerCase();
    if (markers.has(key)) continue;

    markers.set(key, { value, source: candidate.source });
  }

  return [...markers.values()];
}

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
  source: string;
  text: string;
}

function findClientMarkers(files: string[], markers: Marker[]): Finding[] {
  const findings: Finding[] = [];
  // Case-insensitive on purpose: an upper-case wordmark, the same name in a
  // domain and a handle spelling it with dots are one leak in several spellings,
  // and listing the variants by hand is how one of them gets forgotten.
  const needles = markers.map((marker) => ({
    ...marker,
    needle: marker.value.toLowerCase(),
  }));

  for (const file of files) {
    fs.readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, index) => {
        const haystack = line.toLowerCase();

        for (const marker of needles) {
          if (haystack.includes(marker.needle)) {
            findings.push({
              file: path.relative(SRC, file),
              line: index + 1,
              marker: marker.value,
              source: marker.source,
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
  const markers = clientMarkers(activeSite);

  it("sweeps something, so a broken glob cannot pass as a clean sweep", () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it("derives a marker for every fact a visitor could recognise", () => {
    const sources = markers.map((marker) => marker.source);

    // The sweep can only find what is in this list, so this is the check that
    // keeps it honest: a client whose identity had been emptied would otherwise
    // pass by contributing no marker at all. `site id`, `contact e-mail` and
    // `Instagram handle` are legitimately absent when the value is short, absent
    // or not a profile, which is why they are not required.
    expect(sources).toEqual(
      expect.arrayContaining([
        "display name",
        "raw phone",
        "display phone",
        "street",
        "site URL host",
      ]),
    );

    // Nothing empty (which would match every line) and nothing short enough to
    // match an ordinary word.
    for (const marker of markers) {
      expect(marker.value.length).toBeGreaterThanOrEqual(MIN_MARKER_LENGTH);
    }
  });

  it("would catch a leak, proved against the seam it excludes", () => {
    // The positive control: the same finder, pointed at the client package it
    // refuses to scan above, has to find the markers. Without this, an empty
    // marker set, a case-mismatched comparison or a finder that reads the wrong
    // argument would all report a clean sweep forever.
    const clientDir = path.join(SEAM, activeSite.id);
    const seamFiles = fs
      .readdirSync(clientDir)
      .filter((name) => CODE_EXTENSIONS.has(path.extname(name)))
      .map((name) => path.join(clientDir, name));

    expect(seamFiles.length).toBeGreaterThan(0);
    expect(findClientMarkers(seamFiles, markers).length).toBeGreaterThan(0);
  });

  it("has no client name, phone, address or domain outside src/site", () => {
    const findings = findClientMarkers(files, markers).map(
      (finding) =>
        `${finding.file}:${finding.line} [${finding.source}: ${finding.marker}] ${finding.text}`,
    );

    expect(findings).toEqual([]);
  });
});
