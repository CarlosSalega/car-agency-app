import "dotenv/config";
import { generateSlugBase } from "@/lib/cars/slug";
import { prisma } from "@/lib/db";
import {
  buildDeterministicPublicId,
  assertCloudinaryConfigured,
  assertCloudinaryAccessible,
  configureCloudinary,
  getPlaceholderPath,
  indexLocalImages,
  matchImagesForCar,
  uploadLocalImage,
} from "./seed/images";
import {
  imageManifest,
  matchesStagedGroup,
  partitionImageAssets,
  validateImageManifest,
} from "./seed/image-manifest";
import { seedCars } from "./seed/cars";
import { seedLinkTreeLinks } from "./seed/link-tree";
import { seedSellers } from "./seed/sellers";
import { seedUsers } from "./seed/users";
import {
  createBrandsAndModels,
  createCar,
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
  try {
    console.log("🌱 Iniciando seed...");
    assertCloudinaryConfigured();
    configureCloudinary();
    await assertCloudinaryAccessible();

    const manifestErrors = validateImageManifest(imageManifest);
    if (manifestErrors.length > 0)
      throw new Error(`Invalid image manifest: ${manifestErrors.join("; ")}`);

    await prisma.$connect();
    await resetDatabase(prisma);

    const admin = await createUser(prisma, seedUsers[0]);
    await createLinkTreeLinks(prisma, seedLinkTreeLinks);
    const sellers = new Map<string, string>();
    for (const seller of seedSellers) {
      const created = await createSeller(prisma, seller, admin.id);
      sellers.set(seller.key, created.id);
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

    for (const car of seedCars) {
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
          sellerId: car.sellerKey ? (sellers.get(car.sellerKey) ?? null) : null,
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

    await prisma.log.create({
      data: {
        action: "SEED_EXECUTED",
        entity: "System",
        metadata: JSON.stringify({
          carsCreated: summary.carsCreated,
          brandsCreated: summary.brandsCreated,
          modelsCreated: summary.modelsCreated,
        }),
        userId: admin.id,
      },
    });

    console.log("🎉 Seed finalizado exitosamente!");
    console.log("=================================");
    console.log(`   Usuarios:  ${seedUsers.length}`);
    console.log(`   Marcas:    ${summary.brandsCreated}`);
    console.log(`   Modelos:   ${summary.modelsCreated}`);
    console.log(`   Vehículos: ${summary.carsCreated}/${seedCars.length}`);
    console.log(`   Imágenes:  ${summary.images.matchedFiles.length} matched`);
    printImageSummary(summary.images);
    console.log("=================================");
  } catch (error) {
    console.error("❌ Error durante el seeding:", error);
    throw error;
  }
}

main()
  .catch((error) => {
    console.error("❌ Error fatal:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
