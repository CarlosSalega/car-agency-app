import { describe, expect, it } from "vitest";
import { imageManifest, validateImageManifest } from "../image-manifest";
import { matchImagesForCar } from "../images";

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
      }),
    ).toEqual(["Duplicate car key: same", "Duplicate image file: image.webp"]);
  });
});
