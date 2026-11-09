import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { v2 as cloudinary } from "cloudinary";
import { cloudinaryConfigFromEnv } from "@/modules/image-uploads/providers/cloudinary";
import { CLOUDINARY_UPLOAD_OPTIONS } from "@/lib/images/cloudinary-config";
import type { ImageManifest, ImageManifestEntry } from "./types";

export function indexLocalImages(imagesDir: string): string[] {
  return fs
    .readdirSync(imagesDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

function fallbackMatch(
  brand: string,
  model: string,
  files: string[],
): string[] {
  const brandVariations: Record<string, string[]> = {
    nissan: ["nissa", "nissan"],
    volkswagen: ["volkswagen", "vw"],
  };
  const brandTerms = brandVariations[brand.toLowerCase()] ?? [
    brand.toLowerCase(),
  ];
  const modelLower = model.toLowerCase();
  const modelTerms =
    modelLower === "corolla cross"
      ? ["corollacross", "corolla-cross"]
      : modelLower === "corolla"
        ? ["corolla"]
        : [
            modelLower,
            modelLower.replace(/\s+/g, ""),
            modelLower.replace(/\s+/g, "-"),
          ];
  const excluded =
    modelLower === "corolla" ? ["corollacross", "corolla-cross"] : [];

  return files.filter((file) => {
    const lower = file.toLowerCase();
    return (
      brandTerms.some((term) => lower.includes(term)) &&
      modelTerms.some((term) => lower.includes(term)) &&
      !excluded.some((term) => lower.includes(term))
    );
  });
}

export function matchImagesForCar(
  carKey: string,
  brand: string,
  model: string,
  files: string[],
  manifest: ImageManifest,
): string[] {
  const entry: ImageManifestEntry | undefined = manifest.entries.find(
    (candidate) => candidate.carKey === carKey,
  );
  return entry ? entry.files : fallbackMatch(brand, model, files);
}

export function buildDeterministicPublicId(seed: string): string {
  return crypto.createHash("sha1").update(seed).digest("hex").slice(0, 20);
}

export function configureCloudinary(): void {
  const config = cloudinaryConfigFromEnv(process.env);
  cloudinary.config({
    cloud_name: config.cloudName,
    api_key: config.apiKey,
    api_secret: config.apiSecret,
    timeout: 60_000,
  });
}

export async function assertCloudinaryAccessible(): Promise<void> {
  try {
    await withTimeout(cloudinary.api.ping(), 10_000, "cloudinary.api.ping()");
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Cloudinary is not accessible: ${reason}`);
  }
}

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeoutHandle = setTimeout(
      () => reject(new Error(`Timeout (${ms}ms): ${label}`)),
      ms,
    );
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

export async function uploadLocalImage(
  filePath: string,
  publicId: string,
): Promise<string> {
  const result = await withTimeout(
    cloudinary.uploader.upload(filePath, {
      ...CLOUDINARY_UPLOAD_OPTIONS,
      public_id: publicId,
      overwrite: true,
      invalidate: true,
      timeout: 60_000,
    }),
    65_000,
    `cloudinary.upload(${path.basename(filePath)})`,
  );
  return result.public_id as string;
}

export function getPlaceholderPath(): string {
  return path.join(process.cwd(), "public", "placeholder.webp");
}
