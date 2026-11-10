import type { ImageManifest, StagedAssetGroup } from "./types";

/**
 * Asset groups for vehicles that have photos in `public/autos` but no car in the
 * seed catalog.
 *
 * The catalog now publishes every vehicle the asset library holds, so this list
 * is empty. The mechanism stays, in `prisma/seed/image-assets.ts`: a photo
 * dropped in for a vehicle that is neither published nor declared here surfaces
 * as an orphan and fails the seed, instead of going unused silently. Declaring a
 * group here is how a future gap is acknowledged without publishing the car.
 *
 * The pairing ships with the catalogue above, in the client package: a car and
 * its photos are one fact, and `public/autos/` is where the files live.
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
