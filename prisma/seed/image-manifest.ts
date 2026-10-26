import type {
  ImageAssetPartition,
  ImageManifest,
  StagedAssetGroup,
} from "./types";

/**
 * Asset groups for vehicles that have photos in `public/autos` but no car in the
 * seed catalog.
 *
 * The catalog now publishes every vehicle the asset library holds, so this list
 * is empty. The mechanism stays: a photo dropped in for a vehicle that is
 * neither published nor declared here surfaces as an orphan and fails the seed,
 * instead of going unused silently. Declaring a group here is how a future gap
 * is acknowledged without publishing the car.
 */
export const stagedAssets: StagedAssetGroup[] = [];

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
    {
      carKey: "chevrolet-cruze-2019",
      files: [
        "chevrolet_cruze_1.webp",
        "chevrolet_cruze_2.webp",
        "chevrolet_cruze_3.webp",
        "chevrolet_cruze_4.webp",
        "chevrolet_cruze_5.webp",
      ],
    },
    {
      carKey: "chevrolet-tracker-2025",
      files: [
        "chevrolet_tracker_2025_1.webp",
        "chevrolet_tracker_2025_2.webp",
        "chevrolet_tracker_2025_3.webp",
        "chevrolet_tracker_2025_4.webp",
        "chevrolet_tracker_2025_5.webp",
      ],
    },
    {
      carKey: "fiat-cronos-2022",
      files: ["fiat_cronos_1.webp", "fiat_cronos_2.webp", "fiat_cronos_3.webp"],
    },
    {
      carKey: "ford-ranger-2021",
      files: [
        "ford_ranger_1.webp",
        "ford_ranger_2.webp",
        "ford_ranger_3.webp",
        "ford_ranger_4.webp",
      ],
    },
    {
      carKey: "nissan-frontier-2020",
      files: [
        "nissan_frontier_1.webp",
        "nissan_frontier_2.webp",
        "nissan_frontier_3.webp",
        "nissan_frontier_4.webp",
        "nissan_frontier_5.webp",
      ],
    },
    {
      carKey: "renault-kangoo-2019",
      files: [
        "renault_kangoo_1.webp",
        "renault_kangoo_2.webp",
        "renault_kangoo_3.webp",
        "renault_kangoo_4.webp",
      ],
    },
    {
      carKey: "renault-sandero-2020",
      files: [
        "renault_sandero_1.webp",
        "renault_sandero_2.webp",
        "renault_sandero_3.webp",
        "renault_sandero_4.webp",
        "renault_sandero_5.webp",
      ],
    },
    {
      carKey: "toyota-corolla-cross-2023",
      files: [
        "toyota_corollacross_1.webp",
        "toyota_corollacross_2.webp",
        "toyota_corollacross_3.webp",
        "toyota_corollacross_4.webp",
        "toyota_corollacross_5.webp",
      ],
    },
    {
      carKey: "toyota-hilux-2022",
      files: [
        "toyota_hilux_1.webp",
        "toyota_hilux_2.webp",
        "toyota_hilux_3.webp",
        "toyota_hilux_4.webp",
        "toyota_hilux_5.webp",
      ],
    },
    {
      carKey: "toyota-yaris-2021",
      files: [
        "toyota_yaris_1.webp",
        "toyota_yaris_2.webp",
        "toyota_yaris_3.webp",
        "toyota_yaris_4.webp",
      ],
    },
    {
      carKey: "volkswagen-amarok-2025",
      files: [
        "volkswagen_amarok_2025_1.webp",
        "volkswagen_amarok_2025_2.webp",
        "volkswagen_amarok_2025_3.webp",
        "volkswagen_amarok_2025_4.webp",
      ],
    },
    {
      carKey: "volkswagen-taos-2025",
      files: [
        "volkswagen_taos_2025_1.webp",
        "volkswagen_taos_2025_2.webp",
        "volkswagen_taos_2025_3.webp",
        "volkswagen_taos_2025_4.webp",
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
