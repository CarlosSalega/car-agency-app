import type {
  ImageAssetPartition,
  ImageManifest,
  StagedAssetGroup,
} from "./types";

/**
 * Vehicles whose images exist in `public/autos` but that the seed catalog does
 * not publish yet. The catalog currently ships 6 cars; the asset library holds
 * 15 vehicles.
 *
 * Declaring the gap here is deliberate. The alternative — leaving these files
 * unmentioned — let 53 assets sit unused with no signal that the catalog and
 * the asset folder had drifted apart. Each group is expanded to files by
 * prefix, so adding a photo for one of these vehicles needs no change here,
 * while adding a photo for a *new* vehicle surfaces as an orphan and fails.
 */
const CATALOG_NOT_PUBLISHED =
  "Photos available; vehicle not published in the seed catalog yet.";

export const stagedAssets: StagedAssetGroup[] = [
  {
    vehicleKey: "chevrolet_cruze",
    label: "Chevrolet Cruze",
    reason: CATALOG_NOT_PUBLISHED,
  },
  {
    vehicleKey: "chevrolet_tracker_2025",
    label: "Chevrolet Tracker 2025",
    reason: CATALOG_NOT_PUBLISHED,
  },
  {
    vehicleKey: "fiat_cronos",
    label: "Fiat Cronos",
    reason: CATALOG_NOT_PUBLISHED,
  },
  {
    vehicleKey: "ford_ranger",
    label: "Ford Ranger",
    reason: CATALOG_NOT_PUBLISHED,
  },
  {
    vehicleKey: "nissan_frontier",
    label: "Nissan Frontier",
    reason: CATALOG_NOT_PUBLISHED,
  },
  {
    vehicleKey: "renault_kangoo",
    label: "Renault Kangoo",
    reason: CATALOG_NOT_PUBLISHED,
  },
  {
    vehicleKey: "renault_sandero",
    label: "Renault Sandero",
    reason: CATALOG_NOT_PUBLISHED,
  },
  {
    vehicleKey: "toyota_corollacross",
    label: "Toyota Corolla Cross",
    reason: CATALOG_NOT_PUBLISHED,
  },
  {
    vehicleKey: "toyota_hilux",
    label: "Toyota Hilux",
    reason: CATALOG_NOT_PUBLISHED,
  },
  {
    vehicleKey: "toyota_yaris",
    label: "Toyota Yaris",
    reason: CATALOG_NOT_PUBLISHED,
  },
  {
    vehicleKey: "volkswagen_amarok_2025",
    label: "Volkswagen Amarok 2025",
    reason: CATALOG_NOT_PUBLISHED,
  },
  {
    vehicleKey: "volkswagen_taos_2025",
    label: "Volkswagen Taos 2025",
    reason: CATALOG_NOT_PUBLISHED,
  },
];

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
  stagedAssets,
};

/**
 * Whether `file` belongs to a staged vehicle group. The prefix must be followed
 * by a separator so `toyota_corolla` cannot swallow `toyota_corollacross_1`.
 */
export function matchesStagedGroup(file: string, vehicleKey: string): boolean {
  if (!file.startsWith(vehicleKey)) return false;
  const separator = file.charAt(vehicleKey.length);
  return separator === "_" || separator === "-" || separator === ".";
}

/**
 * Splits the files present in `public/autos` into the ones the catalog claims,
 * the ones a staged group explains, and the ones nobody accounts for.
 *
 * Staged groups are expanded only over the leftovers, so a claimed file always
 * wins over a staged prefix that would otherwise overlap it.
 */
export function partitionImageAssets(
  manifest: ImageManifest,
  availableFiles: string[],
): ImageAssetPartition {
  const claimed = new Set<string>();
  for (const entry of manifest.entries) {
    for (const file of entry.files) claimed.add(file);
  }

  const remaining = availableFiles.filter((file) => !claimed.has(file));
  const staged = remaining.filter((file) =>
    manifest.stagedAssets.some((group) =>
      matchesStagedGroup(file, group.vehicleKey),
    ),
  );
  const stagedSet = new Set(staged);
  const orphans = remaining.filter((file) => !stagedSet.has(file));

  return { claimed: [...claimed], staged, orphans };
}

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

  const stagedKeys = new Set<string>();
  for (const group of manifest.stagedAssets) {
    if (stagedKeys.has(group.vehicleKey))
      errors.push(`Duplicate staged vehicle key: ${group.vehicleKey}`);
    stagedKeys.add(group.vehicleKey);
  }

  // Reported once per (group, file) pair: a duplicated group must not repeat
  // the same overlap error.
  const overlaps = new Set<string>();
  for (const group of manifest.stagedAssets) {
    for (const entry of manifest.entries) {
      for (const file of entry.files) {
        if (matchesStagedGroup(file, group.vehicleKey)) {
          overlaps.add(
            `Staged vehicle ${group.vehicleKey} overlaps claimed file ${file}`,
          );
        }
      }
    }
  }
  errors.push(...overlaps);

  return errors;
}
