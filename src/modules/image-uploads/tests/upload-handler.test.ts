import { beforeEach, describe, expect, it, vi } from "vitest";

import { EN_MESSAGES } from "../core/messages";
import type { Actor, ImageProvider } from "../core/types";
import { createUploadHandler } from "../next/upload-handler";

const actor: Actor = { id: "user-1", role: "USER" };

function makeFile(
  type = "image/png",
  content = "bytes",
  name = "photo.png",
): File {
  return new File([new TextEncoder().encode(content)], name, { type });
}

function uploadRequest(file?: File | string, field = "file"): Request {
  const form = new FormData();

  if (file !== undefined) form.set(field, file);

  return new Request("http://localhost/api/upload", {
    method: "POST",
    body: form,
  });
}

function deleteRequest(body: unknown): Request {
  return new Request("http://localhost/api/upload", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

interface Harness {
  provider: ImageProvider;
  upload: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  deleteMany: ReturnType<typeof vi.fn>;
}

function fakeProvider(uploadImpl?: ImageProvider["upload"]): Harness {
  const upload = vi.fn(
    uploadImpl ??
      (async () => ({ key: "catalogue/asset", url: "https://cdn/asset.png" })),
  );
  const remove = vi.fn(async () => ({ success: true }));
  const deleteMany = vi.fn(async () => ({ successful: 0, failed: 0 }));
  const provider: ImageProvider = {
    upload: upload as unknown as ImageProvider["upload"],
    delete: remove as unknown as ImageProvider["delete"],
    deleteMany: deleteMany as unknown as ImageProvider["deleteMany"],
  };

  return { provider, upload, remove, deleteMany };
}

const LIMITS = { maxBytes: 15 * 1024 * 1024, mimePrefixes: ["image/"] };

describe("createUploadHandler POST", () => {
  let harness: Harness;

  beforeEach(() => {
    harness = fakeProvider();
  });

  it("answers 401 with the exact copy and stores nothing when there is no actor", async () => {
    const handler = createUploadHandler({
      provider: harness.provider,
      getActor: () => null,
      validate: LIMITS,
    });

    const response = await handler.POST(uploadRequest(makeFile()));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "No autorizado" });
    expect(harness.upload).not.toHaveBeenCalled();
  });

  it("answers 400 when the form carries no file", async () => {
    const handler = createUploadHandler({
      provider: harness.provider,
      getActor: () => actor,
      validate: LIMITS,
    });

    const response = await handler.POST(uploadRequest());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "No se proporcionó archivo",
    });
    expect(harness.upload).not.toHaveBeenCalled();
  });

  it("answers 400 for a non-image and never reaches the provider", async () => {
    const handler = createUploadHandler({
      provider: harness.provider,
      getActor: () => actor,
      validate: LIMITS,
    });

    const response = await handler.POST(
      uploadRequest(makeFile("application/pdf")),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "El archivo debe ser una imagen",
    });
    expect(harness.upload).not.toHaveBeenCalled();
  });

  it("answers 413 with the original copy for an oversized image", async () => {
    const warn = vi.fn();
    const handler = createUploadHandler({
      provider: harness.provider,
      getActor: () => actor,
      validate: { maxBytes: 4, mimePrefixes: ["image/"] },
      logger: { warn, error: vi.fn() },
    });

    const response = await handler.POST(
      uploadRequest(makeFile("image/png", "12345")),
    );

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({
      error:
        "El servidor rechazó la foto por pesada. Probá con una de menos de 15MB.",
    });
    expect(harness.upload).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith("Image request refused", {
      code: "TOO_LARGE",
      step: "validate",
      size: 5,
      maxBytes: 4,
    });
  });

  it("answers 400 when the body is not a readable form", async () => {
    const handler = createUploadHandler({
      provider: harness.provider,
      getActor: () => actor,
      validate: LIMITS,
    });
    const response = await handler.POST(
      new Request("http://localhost/api/upload", {
        method: "POST",
        body: "not-a-form",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "No se proporcionó archivo",
    });
  });

  it("stores the file and answers 200 with the key and url", async () => {
    const handler = createUploadHandler({
      provider: harness.provider,
      getActor: () => actor,
      validate: LIMITS,
    });
    const file = makeFile();

    const response = await handler.POST(uploadRequest(file));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      key: "catalogue/asset",
      url: "https://cdn/asset.png",
    });
    expect(harness.upload).toHaveBeenCalledTimes(1);
    expect(harness.upload.mock.calls[0]?.[0]).toMatchObject({
      name: "photo.png",
      type: "image/png",
      size: file.size,
    });
    expect(harness.upload.mock.calls[0]?.[1]).toBeUndefined();
  });

  it("lets the deployment derive folder and tags per request", async () => {
    const handler = createUploadHandler({
      provider: harness.provider,
      getActor: () => ({ id: "tenant-9", role: "ADMIN" }),
      validate: LIMITS,
      uploadOptions: ({ actor: resolved }) => ({
        folder: `tenants/${resolved.id}`,
        tags: [resolved.role ?? "user"],
      }),
    });
    const file = makeFile();

    await handler.POST(uploadRequest(file));

    expect(harness.upload).toHaveBeenCalledTimes(1);
    expect(harness.upload.mock.calls[0]?.[0]).toMatchObject({
      name: "photo.png",
      type: "image/png",
    });
    expect(harness.upload.mock.calls[0]?.[1]).toEqual({
      folder: "tenants/tenant-9",
      tags: ["ADMIN"],
    });
  });

  it("reads the file from a renamed field", async () => {
    const handler = createUploadHandler({
      provider: harness.provider,
      getActor: () => actor,
      validate: LIMITS,
      fileField: "image",
    });

    const response = await handler.POST(uploadRequest(makeFile(), "image"));

    expect(response.status).toBe(200);
  });

  it("answers 500 and stores nothing when the provider throws a plain error", async () => {
    const failing = fakeProvider(async () => {
      throw new Error("socket hang up");
    });
    const error = vi.fn();
    const handler = createUploadHandler({
      provider: failing.provider,
      getActor: () => actor,
      validate: LIMITS,
      logger: { warn: vi.fn(), error },
    });

    const response = await handler.POST(uploadRequest(makeFile()));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Error al subir la imagen",
    });
    expect(error).toHaveBeenCalledWith("Image upload failed", {
      error: "socket hang up",
    });
  });

  it("preserves a typed provider failure instead of flattening it to 500 generic", async () => {
    const { ImageError } = await import("../core/errors");
    const failing = fakeProvider(async () => {
      throw new ImageError("MISCONFIGURED", { message: "missing secret" });
    });
    const handler = createUploadHandler({
      provider: failing.provider,
      getActor: () => actor,
      validate: LIMITS,
    });

    const response = await handler.POST(uploadRequest(makeFile()));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "La configuración del almacenamiento de imágenes está incompleta",
    });
  });

  it("ships an English catalog when the deployment asks for one", async () => {
    const handler = createUploadHandler({
      provider: harness.provider,
      getActor: () => null,
      messages: { catalog: EN_MESSAGES },
    });

    const response = await handler.POST(uploadRequest(makeFile()));

    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("answers 413 from the declared length without ever reading the body", async () => {
    const warn = vi.fn();
    const formData = vi.fn(async () => new FormData());
    const handler = createUploadHandler({
      provider: harness.provider,
      getActor: () => actor,
      validate: { maxBytes: 1024, mimePrefixes: ["image/"] },
      logger: { warn, error: vi.fn() },
    });
    const contentLength = 1024 + 65536 + 1;
    const request = {
      headers: new Headers({ "content-length": String(contentLength) }),
      formData,
      json: async () => ({}),
    };

    const response = await handler.POST(request);

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({
      error:
        "El servidor rechazó la foto por pesada. Probá con una de menos de 15MB.",
    });
    expect(formData).not.toHaveBeenCalled();
    expect(harness.upload).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith("Image request refused", {
      code: "TOO_LARGE",
      step: "preflight",
      contentLength,
      maxBytes: 1024,
    });
  });

  it("still processes a body that exceeds the budget only by the multipart overhead", async () => {
    const handler = createUploadHandler({
      provider: harness.provider,
      getActor: () => actor,
      validate: { maxBytes: 1024, mimePrefixes: ["image/"] },
    });
    const form = new FormData();
    form.set("file", makeFile("image/png", "1234"));
    const request = {
      headers: new Headers({ "content-length": String(1024 + 65536) }),
      formData: async () => form,
      json: async () => ({}),
    };

    const response = await handler.POST(request);

    expect(response.status).toBe(200);
    expect(harness.upload).toHaveBeenCalledTimes(1);
  });

  it("works when the request declares no usable content-length", async () => {
    const handler = createUploadHandler({
      provider: harness.provider,
      getActor: () => actor,
      validate: LIMITS,
    });
    const form = new FormData();
    form.set("file", makeFile());

    for (const headers of [
      new Headers(),
      new Headers({ "content-length": "not-a-number" }),
    ]) {
      const request = {
        headers,
        formData: async () => form,
        json: async () => ({}),
      };

      const response = await handler.POST(request);

      expect(response.status).toBe(200);
    }

    expect(harness.upload).toHaveBeenCalledTimes(2);
  });

  it("skips the pre-check when no byte budget is configured", async () => {
    const handler = createUploadHandler({
      provider: harness.provider,
      getActor: () => actor,
    });
    const form = new FormData();
    form.set("file", makeFile());
    const request = {
      headers: new Headers({ "content-length": "104857600" }),
      formData: async () => form,
      json: async () => ({}),
    };

    const response = await handler.POST(request);

    expect(response.status).toBe(200);
    expect(harness.upload).toHaveBeenCalledTimes(1);
  });
});

describe("createUploadHandler DELETE", () => {
  let harness: Harness;
  const allow = () => ({ allowed: true as const });

  beforeEach(() => {
    harness = fakeProvider();
  });

  it("answers 401 and deletes nothing when there is no actor", async () => {
    const handler = createUploadHandler({
      provider: harness.provider,
      getActor: () => null,
      authorizeDelete: allow,
    });

    const response = await handler.DELETE(
      deleteRequest({ key: "catalogue/asset" }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "No autorizado" });
    expect(harness.remove).not.toHaveBeenCalled();
  });

  it("answers 400 when the key is missing, empty or not a string", async () => {
    const handler = createUploadHandler({
      provider: harness.provider,
      getActor: () => actor,
      authorizeDelete: allow,
    });

    for (const body of [{}, { key: "" }, { key: 42 }, "not-json"]) {
      const response = await handler.DELETE(deleteRequest(body));

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: "No se proporcionó key",
      });
    }

    expect(harness.remove).not.toHaveBeenCalled();
  });

  it("fails closed with 403 when the deployment configured no authorization", async () => {
    const handler = createUploadHandler({
      provider: harness.provider,
      getActor: () => actor,
    });

    const response = await handler.DELETE(
      deleteRequest({ key: "catalogue/asset" }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "No tienes permiso para realizar esta acción",
    });
    expect(harness.remove).not.toHaveBeenCalled();
  });

  it("answers 403 with the not-owned copy and keeps the asset", async () => {
    const handler = createUploadHandler({
      provider: harness.provider,
      getActor: () => actor,
      authorizeDelete: () => ({ allowed: false, reason: "NOT_OWNED" }),
    });

    const response = await handler.DELETE(
      deleteRequest({ key: "catalogue/asset" }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error:
        "No tienes permiso para eliminar esta imagen. No pertenece a ninguno de tus vehículos.",
    });
    expect(harness.remove).not.toHaveBeenCalled();
  });

  it("answers 403 with the other-owner copy and keeps the asset", async () => {
    const handler = createUploadHandler({
      provider: harness.provider,
      getActor: () => actor,
      authorizeDelete: () => ({ allowed: false, reason: "OTHER_OWNER" }),
    });

    const response = await handler.DELETE(
      deleteRequest({ key: "catalogue/asset" }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error:
        "No tienes permiso para eliminar esta imagen. Pertenece a otro vehículo.",
    });
    expect(harness.remove).not.toHaveBeenCalled();
  });

  it("lets the guard replace the refusal copy", async () => {
    const handler = createUploadHandler({
      provider: harness.provider,
      getActor: () => actor,
      authorizeDelete: () => ({
        allowed: false,
        message: "That listing is archived",
      }),
    });

    const response = await handler.DELETE(
      deleteRequest({ key: "catalogue/asset" }),
    );

    await expect(response.json()).resolves.toEqual({
      error: "That listing is archived",
    });
  });

  it("deletes the asset for an authorized actor", async () => {
    const handler = createUploadHandler({
      provider: harness.provider,
      getActor: () => actor,
      authorizeDelete: allow,
    });

    const response = await handler.DELETE(
      deleteRequest({ key: "catalogue/asset" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(harness.remove).toHaveBeenCalledWith("catalogue/asset");
  });

  it("answers 500 with the provider reason when the delete reports a failure", async () => {
    const remove = vi.fn(async () => ({
      success: false,
      error: "delete-failed: locked",
    }));
    const handler = createUploadHandler({
      provider: {
        upload: vi.fn(),
        delete: remove,
        deleteMany: vi.fn(),
      } as unknown as ImageProvider,
      getActor: () => actor,
      authorizeDelete: allow,
    });

    const response = await handler.DELETE(
      deleteRequest({ key: "catalogue/asset" }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "delete-failed: locked",
    });
  });

  it("answers 500 with the default copy when the provider gives no reason", async () => {
    const handler = createUploadHandler({
      provider: {
        upload: vi.fn(),
        delete: vi.fn(async () => ({ success: false })),
        deleteMany: vi.fn(),
      } as unknown as ImageProvider,
      getActor: () => actor,
      authorizeDelete: allow,
    });

    const response = await handler.DELETE(
      deleteRequest({ key: "catalogue/asset" }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Error al eliminar la imagen",
    });
  });

  it("answers 500 when the provider throws", async () => {
    const handler = createUploadHandler({
      provider: {
        upload: vi.fn(),
        delete: vi.fn(async () => {
          throw new Error("cloudinary down");
        }),
        deleteMany: vi.fn(),
      } as unknown as ImageProvider,
      getActor: () => actor,
      authorizeDelete: allow,
    });

    const response = await handler.DELETE(
      deleteRequest({ key: "catalogue/asset" }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Error al eliminar la imagen",
    });
  });

  it("reads the key from a renamed field", async () => {
    const handler = createUploadHandler({
      provider: harness.provider,
      getActor: () => actor,
      authorizeDelete: allow,
      keyField: "publicId",
    });

    const response = await handler.DELETE(
      deleteRequest({ publicId: "catalogue/asset" }),
    );

    expect(response.status).toBe(200);
    expect(harness.remove).toHaveBeenCalledWith("catalogue/asset");
  });
});
