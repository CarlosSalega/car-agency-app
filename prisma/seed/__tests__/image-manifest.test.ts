import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  imageManifest,
  matchesStagedGroup,
  partitionImageAssets,
  validateImageManifest,
} from "../image-manifest";
import { indexLocalImages, matchImagesForCar } from "../images";
import { seedCars } from "../cars";

const files = [
  "toyota_corolla_1.webp",
  "toyota_corollacross_1.webp",
  "peugeot_208_1.webp",
  "unknown_vehicle.webp",
];

describe("seed image manifest", () => {
  it("uses the explicit mapping when a car is present", () => {
    expect(
      matchImagesForCar(
        "peugeot-208-2021",
        "Peugeot",
        "208",
        files,
        imageManifest,
      ),
    ).toEqual([
      "peugeot_208_1.webp",
      "peugeot_208_2.webp",
      "peugeot_208_3.webp",
      "peugeot_208_4.webp",
    ]);
    expect(
      matchImagesForCar(
        "toyota-corolla-2014",
        "Toyota",
        "Corolla",
        files,
        imageManifest,
      ),
    ).toEqual([
      "toyota_corolla_1.webp",
      "toyota_corolla_2.webp",
      "toyota_corolla_3.webp",
      "toyota_corolla_4.webp",
      "toyota_corolla_5.webp",
    ]);
  });

  it("retains filename matching for cars without a manifest entry", () => {
    expect(
      matchImagesForCar("unknown", "Toyota", "Corolla", files, imageManifest),
    ).toEqual(["toyota_corolla_1.webp"]);
    expect(
      matchImagesForCar("unknown", "Peugeot", "208", files, imageManifest),
    ).toEqual(["peugeot_208_1.webp"]);
  });

  it("detects duplicate manifest keys and files", () => {
    expect(
      validateImageManifest({
        entries: [
          { carKey: "same", files: ["image.webp"] },
          { carKey: "same", files: ["image.webp"] },
        ],
        stagedAssets: [],
      }),
    ).toEqual(["Duplicate car key: same", "Duplicate image file: image.webp"]);
  });

  it("detects duplicate and overlapping staged vehicle keys", () => {
    expect(
      validateImageManifest({
        entries: [{ carKey: "car", files: ["toyota_hilux_1.webp"] }],
        stagedAssets: [
          { vehicleKey: "toyota_hilux", label: "A", reason: "r" },
          { vehicleKey: "toyota_hilux", label: "B", reason: "r" },
        ],
      }),
    ).toEqual([
      "Duplicate staged vehicle key: toyota_hilux",
      "Staged vehicle toyota_hilux overlaps claimed file toyota_hilux_1.webp",
    ]);
  });

  it("has a valid manifest", () => {
    expect(validateImageManifest(imageManifest)).toEqual([]);
  });

  // The catalog is meant to publish every vehicle whose photos ship in
  // `public/autos`. A photo group with no seed car would mean an asset library
  // that grew past the catalog again.
  it("publishes a seed car for every vehicle that has photos", () => {
    const carKeys = new Set(seedCars.map((car) => car.key));
    const withPhotos = imageManifest.entries.filter(
      (entry) => entry.files.length > 0,
    );

    expect(withPhotos.length).toBeGreaterThan(0);
    for (const entry of withPhotos) {
      expect(
        carKeys.has(entry.carKey),
        `${entry.carKey} has photos but no seed car`,
      ).toBe(true);
    }
  });
});

describe("staged asset groups", () => {
  it("requires a separator so a prefix cannot swallow a longer name", () => {
    expect(matchesStagedGroup("toyota_corolla_1.webp", "toyota_corolla")).toBe(
      true,
    );
    expect(
      matchesStagedGroup("toyota_corollacross_1.webp", "toyota_corolla"),
    ).toBe(false);
    expect(matchesStagedGroup("toyota_corolla.webp", "toyota_corolla")).toBe(
      true,
    );
    expect(matchesStagedGroup("corolla_1.webp", "toyota_corolla")).toBe(false);
  });

  it("separates claimed files, staged files and true orphans", () => {
    // Self-contained: the real manifest claims every asset, so it has no staged
    // group left to exercise here.
    const manifest = {
      entries: [{ carKey: "corolla", files: ["toyota_corolla_1.webp"] }],
      stagedAssets: [
        { vehicleKey: "toyota_hilux", label: "Toyota Hilux", reason: "r" },
      ],
    };

    const partition = partitionImageAssets(manifest, [
      "toyota_corolla_1.webp",
      "toyota_corolla_2.webp",
      "toyota_hilux_1.webp",
      "mystery_vehicle_9.webp",
    ]);

    expect(partition.claimed).toEqual(["toyota_corolla_1.webp"]);
    expect(partition.staged).toEqual(["toyota_hilux_1.webp"]);
    expect(partition.orphans).toEqual([
      "toyota_corolla_2.webp",
      "mystery_vehicle_9.webp",
    ]);
  });

  it("keeps claimed files out of staged groups even when a prefix overlaps", () => {
    const manifest = {
      entries: [{ carKey: "corolla", files: ["toyota_corolla_1.webp"] }],
      stagedAssets: [
        { vehicleKey: "toyota_corolla", label: "Toyota Corolla", reason: "r" },
      ],
    };

    const partition = partitionImageAssets(manifest, [
      "toyota_corolla_1.webp",
      "toyota_corolla_2.webp",
    ]);

    expect(partition.claimed).toEqual(["toyota_corolla_1.webp"]);
    expect(partition.staged).toEqual(["toyota_corolla_2.webp"]);
    expect(partition.orphans).toEqual([]);
  });

  // Guards the real asset folder: a photo dropped in for a vehicle that is
  // neither published nor declared staged fails here instead of silently
  // going unused at seed time.
  it("accounts for every image file in public/autos", () => {
    const available = indexLocalImages(
      path.join(process.cwd(), "public", "autos"),
    );
    const partition = partitionImageAssets(imageManifest, available);

    expect(partition.orphans).toEqual([]);
    expect(partition.claimed.length + partition.staged.length).toBe(
      available.length,
    );
  });
});
