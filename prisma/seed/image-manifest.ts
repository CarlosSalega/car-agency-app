import type { ImageManifest } from "./types";

export const imageManifest: ImageManifest = {
  entries: [
    {
      carKey: "peugeot-208-2021",
      files: [
        "peugeot_208_1.webp",
        "peugeot_208_2.webp",
        "peugeot_208_3.webp",
        "peugeot_208_4.webp",
      ],
    },
    {
      carKey: "toyota-corolla-2014",
      files: [
        "toyota_corolla_1.webp",
        "toyota_corolla_2.webp",
        "toyota_corolla_3.webp",
        "toyota_corolla_4.webp",
        "toyota_corolla_5.webp",
      ],
    },
    { carKey: "renault-clio-2013", files: [] },
    { carKey: "peugeot-207-2013", files: [] },
    { carKey: "fiat-palio-2011", files: [] },
    { carKey: "ford-focus-2018", files: [] },
  ],
};

export function validateImageManifest(manifest: ImageManifest): string[] {
  const errors: string[] = [];
  const carKeys = new Set<string>();
  const fileNames = new Set<string>();

  for (const entry of manifest.entries) {
    if (carKeys.has(entry.carKey))
      errors.push(`Duplicate car key: ${entry.carKey}`);
    carKeys.add(entry.carKey);
    for (const file of entry.files) {
      if (fileNames.has(file)) errors.push(`Duplicate image file: ${file}`);
      fileNames.add(file);
    }
  }

  return errors;
}
