import type { ImageAssetPartition, ImageManifest } from "./types";

/**
 * How an image manifest is validated and applied.
 *
 * The manifest itself is data and ships with the catalogue in
 * `src/site/<client>/seed/image-manifest.ts`: a car and its photos are one fact.
 * What stays here is the machinery — the product's rules about what a valid
 * manifest looks like and how it divides the files in `public/autos`. A
 * deployment replaces the data and keeps these rules.
 */

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
