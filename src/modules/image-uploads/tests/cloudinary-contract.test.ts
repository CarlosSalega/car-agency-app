import { afterAll, describe, expect, it } from "vitest";
import { deflateSync } from "node:zlib";
import type { UploadApiOptions } from "cloudinary";

import {
  buildCloudinaryUploadOptions,
  cloudinaryConfigFromEnv,
  createCloudinaryProvider,
  DEFAULT_CLOUDINARY_UPLOAD_DEFAULTS,
} from "../providers/cloudinary";

const contractFolder = "image-uploads-contract";

const fullConfiguration = {
  folder: contractFolder,
  tags: ["contract", "png"],
  resourceType: "image" as const,
  eager: DEFAULT_CLOUDINARY_UPLOAD_DEFAULTS.eager,
  overwrite: true,
  invalidate: false,
  timeoutMs: 30_000,
  quality: "auto",
  fetchFormat: "auto",
};

const fullOptions: UploadApiOptions = buildCloudinaryUploadOptions(
  fullConfiguration,
  {
    folder: `${contractFolder}/override`,
    publicId: "contract-asset",
    overwrite: false,
  },
);

const fullOptionKeys = Object.keys(fullOptions).sort();

const emptyOptions: UploadApiOptions = buildCloudinaryUploadOptions({});
const emptyOptionKeys = Object.keys(emptyOptions).sort();

describe("cloudinary upload option contract", () => {
  it("assigns the emitted options to the SDK's own option type", () => {
    expect(fullOptions.resource_type).toBe("image");
    expect(fullOptions.folder).toBe(`${contractFolder}/override`);
    expect(fullOptions.public_id).toBe("contract-asset");
    expect(fullOptions.overwrite).toBe(false);
    expect(fullOptions.invalidate).toBe(false);
    expect(fullOptions.timeout).toBe(30_000);
    expect(fullOptions.tags).toEqual(["contract", "png"]);
    expect(fullOptions.eager).toEqual(DEFAULT_CLOUDINARY_UPLOAD_DEFAULTS.eager);
  });

  it("emits exactly the keys the contract covers for a full configuration", () => {
    expect(fullOptionKeys).toEqual([
      "eager",
      "fetch_format",
      "folder",
      "invalidate",
      "overwrite",
      "public_id",
      "quality",
      "resource_type",
      "tags",
      "timeout",
    ]);
  });

  it("emits only the invariant keys for an empty configuration", () => {
    expect(emptyOptionKeys).toEqual([
      "invalidate",
      "overwrite",
      "resource_type",
    ]);
  });

  it("omits folder, tags and public_id until someone supplies them", () => {
    const built = buildCloudinaryUploadOptions({ tags: [] });

    expect(built).not.toHaveProperty("folder");
    expect(built).not.toHaveProperty("tags");
    expect(built).not.toHaveProperty("public_id");
    expect(Object.keys(built).sort()).toEqual([
      "invalidate",
      "overwrite",
      "resource_type",
    ]);
  });
});

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) === 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = Buffer.from(type, "ascii");
  const payload = Buffer.from(data);
  const body = Buffer.concat([typeBytes, payload]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(payload.length, 0);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(body), 0);

  return Buffer.concat([length, typeBytes, payload, checksum]);
}

function onePixelPng(): Uint8Array<ArrayBuffer> {
  const signature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0);
  header.writeUInt32BE(1, 4);
  header[8] = 8;
  header[9] = 2;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;
  const pixels = deflateSync(Buffer.from([0x00, 0x00, 0x00, 0x00]));
  const png = Buffer.concat([
    signature,
    pngChunk("IHDR", header),
    pngChunk("IDAT", pixels),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
  const bytes = new Uint8Array(new ArrayBuffer(png.length));
  bytes.set(png);

  return bytes;
}

function contractFile(): File {
  return new File([onePixelPng()], "contract.png", { type: "image/png" });
}

const credentialsPresent =
  (process.env["NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME"] ?? "") !== "" &&
  (process.env["CLOUDINARY_API_KEY"] ?? "") !== "" &&
  (process.env["CLOUDINARY_API_SECRET"] ?? "") !== "";

function liveProvider() {
  return createCloudinaryProvider(
    cloudinaryConfigFromEnv(process.env, {
      defaults: { folder: contractFolder },
    }),
  );
}

describe.skipIf(!credentialsPresent)("cloudinary live contract", () => {
  const createdKeys: string[] = [];

  afterAll(async () => {
    if (createdKeys.length === 0) return;

    await liveProvider().deleteMany([...createdKeys]);
  }, 30_000);

  it(
    "uploads a generated PNG and returns a real key and delivery url",
    { timeout: 30_000 },
    async () => {
      const result = await liveProvider().upload(contractFile());
      createdKeys.push(result.key);

      expect(result.key.startsWith(`${contractFolder}/`)).toBe(true);
      expect(result.url.startsWith("https://res.cloudinary.com/")).toBe(true);
    },
  );

  it(
    "reports repeated deletes and unknown keys as success",
    { timeout: 30_000 },
    async () => {
      const provider = liveProvider();
      const uploaded = await provider.upload(contractFile());
      createdKeys.push(uploaded.key);

      await expect(provider.delete(uploaded.key)).resolves.toEqual({
        success: true,
      });
      await expect(provider.delete(uploaded.key)).resolves.toEqual({
        success: true,
      });
      await expect(
        provider.deleteMany([uploaded.key, `${contractFolder}/does-not-exist`]),
      ).resolves.toEqual({
        successful: 2,
        failed: 0,
      });
    },
  );
});
