import "dotenv/config";
import { generateSlugBase } from "@/lib/cars/slug";
import { prisma } from "@/lib/db";
import { seedData } from "@/site/seed";
import {
  buildDeterministicPublicId,
  assertCloudinaryAccessible,
  configureCloudinary,
  getPlaceholderPath,
  indexLocalImages,
  matchImagesForCar,
  uploadLocalImage,
} from "./seed/images";
import {
  matchesStagedGroup,
  partitionImageAssets,
  validateImageManifest,
} from "./seed/image-assets";
import { buildSeedLeads } from "./seed/leads";
import {
  DESTRUCTIVE_TABLES,
  SEED_ENV_OVERRIDE,
  decideSeedAllowed,
  seedRefusalMessage,
} from "./seed/guard";
import {
  createBrandsAndModels,
  createCar,
  createLeads,
  createLinkTreeLinks,
  createSeller,
  createUser,
  resetDatabase,
} from "./seed/repositories";
import type { ImageSummary, SeedSummary } from "./seed/types";

const imagesDir = `${process.cwd()}/public/autos`;

function printImageSummary(summary: ImageSummary): void {
  console.log(`   Staged assets: ${summary.stagedFiles.length} files`);
  for (const group of summary.stagedAssets) {
    const count = summary.stagedFiles.filter((file) =>
      matchesStagedGroup(file, group.vehicleKey),
    ).length;
    if (count > 0)
      console.log(`      ${group.label}: ${count} (${group.reason})`);
  }
  console.log(`   Unclaimed files: ${summary.orphanFiles.length}`);
  if (summary.orphanFiles.length > 0)
    console.log(`      ${summary.orphanFiles.join(", ")}`);
  console.log(`   Upload failures: ${summary.uploadFailures.length}`);
  if (summary.uploadFailures.length > 0) {
    for (const failure of summary.uploadFailures)
      console.warn(`      ${failure.file}: ${failure.reason}`);
  }
  console.log(`   Cars using placeholder: ${summary.placeholderCars.length}`);
  if (summary.placeholderCars.length > 0)
    console.log(`      ${summary.placeholderCars.join(", ")}`);
}

async function main(): Promise<void> {
  // The data comes from the client package, through `src/site/seed.ts`; the
  // mechanisms below stay in this folder, because they are the product's.
  const { cars, users, sellers, linkTree, imageManifest } = seedData;

  try {
    console.log("🌱 Iniciando seed...");
    configureCloudinary();
    await assertCloudinaryAccessible();

    const manifestErrors = validateImageManifest(imageManifest);
    if (manifestErrors.length > 0)
      throw new Error(`Invalid image manifest: ${manifestErrors.join("; ")}`);

    await prisma.$connect();
    await resetDatabase(prisma);

    const admin = await createUser(prisma, users[0]);
    await createLinkTreeLinks(prisma, linkTree);
    const sellerIds = new Map<string, string>();
    for (const seller of sellers) {
      const created = await createSeller(prisma, seller, admin.id);
      sellerIds.set(seller.key, created.id);
    }

    const { brandMap, modelMap } = await createBrandsAndModels(
      prisma,
      admin.id,
    );
    const localFiles = indexLocalImages(imagesDir);
    const partition = partitionImageAssets(imageManifest, localFiles);

    if (partition.orphans.length > 0) {
      throw new Error(
        `Unclaimed image files: ${partition.orphans.join(", ")}. ` +
          "Add them to an image manifest entry or to a staged asset group.",
      );
    }

    const placeholderKey = await uploadLocalImage(
      getPlaceholderPath(),
      "placeholder",
    );
    const summary: SeedSummary = {
      carsCreated: 0,
      brandsCreated: Object.keys(brandMap).length,
      modelsCreated: Object.keys(modelMap).length,
      leadsCreated: 0,
      images: {
        matchedFiles: [],
        stagedAssets: imageManifest.stagedAssets,
        stagedFiles: partition.staged,
        orphanFiles: partition.orphans,
        uploadFailures: [],
        placeholderCars: [],
      },
    };
    const consumedFiles = new Set<string>();

    for (const car of cars) {
      const modelKey = `${car.brand}-${car.model}`;
      const brandId = brandMap[car.brand];
      const modelId = modelMap[modelKey];
      if (!brandId || !modelId) {
        throw new Error(
          `Missing brand or model data for ${car.brand} ${car.model}`,
        );
      }

      const matchedFiles = matchImagesForCar(
        car.key,
        car.brand,
        car.model,
        localFiles,
        imageManifest,
      );
      const imagePaths = matchedFiles.filter((file) => {
        if (consumedFiles.has(file)) return false;
        consumedFiles.add(file);
        return localFiles.includes(file);
      });
      summary.images.matchedFiles.push(...matchedFiles);

      const keys: string[] = [];
      for (const [index, file] of matchedFiles.entries()) {
        if (!localFiles.includes(file)) {
          summary.images.uploadFailures.push({
            file,
            reason: "Manifest file is missing",
          });
          continue;
        }
        if (consumedFiles.has(file) && !imagePaths.includes(file)) continue;
        try {
          keys.push(
            await uploadLocalImage(
              `${imagesDir}/${file}`,
              buildDeterministicPublicId(`${car.key}:${index}:${file}`),
            ),
          );
        } catch (error) {
          summary.images.uploadFailures.push({
            file,
            reason: error instanceof Error ? error.message : "Upload failed",
          });
        }
      }
      if (keys.length === 0) {
        keys.push(placeholderKey);
        summary.images.placeholderCars.push(car.key);
      }

      await createCar(
        prisma,
        car,
        {
          brandId,
          modelId,
          sellerId: car.sellerKey
            ? (sellerIds.get(car.sellerKey) ?? null)
            : null,
          userId: admin.id,
        },
        keys,
        generateSlugBase(
          car.brand,
          car.model,
          car.version,
          car.year,
          car.kilometers,
        ),
      );
      summary.carsCreated += 1;
    }

    // Demo inquiries, so the panel has something to show. Built from the cars
    // that exist now, so the ranking and the pipeline point at real inventory.
    const createdCars = await prisma.car.findMany({
      select: { id: true, sellerId: true, images: true },
    });
    const demoLeads = buildSeedLeads({
      cars: createdCars.map((car) => ({
        id: car.id,
        sellerId: car.sellerId,
        // A car whose only image is the placeholder has no real photos. The key
        // is the one this run uploaded, so no guessing from the column.
        hasImages: !(
          car.images.length === 1 && car.images[0] === placeholderKey
        ),
      })),
    });
    await createLeads(prisma, demoLeads);
    summary.leadsCreated = demoLeads.length;

    // No reviews are seeded: a testimonial is a customer's words, so it belongs
    // to the deployment that collected it and never to the product. The `Review`
    // rows arrive through the panel, and the landing renders nothing until one
    // is published.

    await prisma.log.create({
      data: {
        action: "SEED_EXECUTED",
        entity: "System",
        metadata: JSON.stringify({
          carsCreated: summary.carsCreated,
          leadsCreated: summary.leadsCreated,
          brandsCreated: summary.brandsCreated,
          modelsCreated: summary.modelsCreated,
        }),
        userId: admin.id,
      },
    });

    console.log("🎉 Seed finalizado exitosamente!");
    console.log("=================================");
    console.log(`   Usuarios:  ${users.length}`);
    console.log(`   Marcas:    ${summary.brandsCreated}`);
    console.log(`   Modelos:   ${summary.modelsCreated}`);
    console.log(`   Vehículos: ${summary.carsCreated}/${cars.length}`);
    console.log(`   Consultas demo: ${summary.leadsCreated}`);
    console.log(`   Imágenes:  ${summary.images.matchedFiles.length} matched`);
    printImageSummary(summary.images);
    console.log("=================================");
  } catch (error) {
    console.error("❌ Error durante el seeding:", error);
    throw error;
  }
}

/**
 * The guard runs here, at module scope, so it fails before `main()` connects to
 * the database. `resetDatabase()` is the first thing `main()` does once
 * Cloudinary checks pass, and nothing re-creates a table it emptied if the run
 * dies half way.
 */
const seedGuard = decideSeedAllowed(process.env);

if (!seedGuard.allowed) {
  console.error(seedRefusalMessage(seedGuard.reason));
  process.exit(1);
}

if (seedGuard.overridden) {
  console.warn(
    `⚠️  ${SEED_ENV_OVERRIDE} is set: this run will empty ${DESTRUCTIVE_TABLES.join(", ")}.`,
  );
}

main()
  .catch((error) => {
    console.error("❌ Error fatal:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
