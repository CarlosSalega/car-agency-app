import { describe, expect, it } from "vitest";

import {
  describeError,
  ImageError,
  isImageError,
  statusForImageError,
} from "../core/errors";
import {
  createMessageResolver,
  EN_MESSAGES,
  ES_MESSAGES,
} from "../core/messages";
import {
  DEFAULT_MIME_PREFIXES,
  isUploadableFile,
  validateUploadFile,
} from "../core/validate";

function makeFile(content: string, type: string, name = "photo.png"): File {
  return new File([new TextEncoder().encode(content)], name, { type });
}

describe("statusForImageError", () => {
  it("maps each normalized code to its HTTP status", () => {
    expect(statusForImageError("UNAUTHENTICATED")).toBe(401);
    expect(statusForImageError("FORBIDDEN")).toBe(403);
    expect(statusForImageError("NO_FILE")).toBe(400);
    expect(statusForImageError("INVALID_TYPE")).toBe(400);
    expect(statusForImageError("TOO_LARGE")).toBe(413);
    expect(statusForImageError("MISSING_KEY")).toBe(400);
    expect(statusForImageError("PATH_MISSING")).toBe(400);
    expect(statusForImageError("NOT_FOUND")).toBe(404);
    expect(statusForImageError("PROVIDER_UNKNOWN")).toBe(500);
    expect(statusForImageError("MISCONFIGURED")).toBe(500);
    expect(statusForImageError("UPLOAD_FAILED")).toBe(500);
    expect(statusForImageError("DELETE_FAILED")).toBe(500);
    expect(statusForImageError("UPSTREAM_FAILED")).toBe(500);
  });
});

describe("ImageError", () => {
  it("carries the code, the derived status and the details", () => {
    const error = new ImageError("TOO_LARGE", { details: { size: 20 } });

    expect(error.code).toBe("TOO_LARGE");
    expect(error.status).toBe(413);
    expect(error.details).toEqual({ size: 20 });
    expect(error.message).toBe("TOO_LARGE");
    expect(isImageError(error)).toBe(true);
    expect(isImageError(new Error("nope"))).toBe(false);
  });

  it("keeps the explicit message and the cause", () => {
    const cause = new Error("socket hang up");
    const error = new ImageError("UPLOAD_FAILED", {
      message: "Cloudinary upload failed",
      cause,
    });

    expect(error.message).toBe("Cloudinary upload failed");
    expect(error.cause).toBe(cause);
  });
});

describe("describeError", () => {
  it("never throws on hostile values", () => {
    const circular: Record<string, unknown> = {};
    circular["self"] = circular;

    expect(describeError(new Error("boom"))).toBe("boom");
    expect(describeError("plain")).toBe("plain");
    expect(describeError(circular)).toBe("[object Object]");
    expect(describeError(null)).toBe("null");
  });

  it("describes a DOMException with its name and message", () => {
    expect(
      describeError(
        new DOMException("The operation was aborted.", "TimeoutError"),
      ),
    ).toBe("TimeoutError: The operation was aborted.");
  });
});

describe("validateUploadFile", () => {
  it("rejects a missing or non-file value as NO_FILE", () => {
    expect(validateUploadFile(null)).toMatchObject({
      ok: false,
      code: "NO_FILE",
    });
    expect(validateUploadFile("string")).toMatchObject({
      ok: false,
      code: "NO_FILE",
    });
    expect(validateUploadFile(undefined)).toMatchObject({
      ok: false,
      code: "NO_FILE",
    });
    expect(validateUploadFile({ size: 1, type: "image/png" })).toMatchObject({
      ok: false,
      code: "NO_FILE",
    });
  });

  it("accepts any image by default and reports the file back", () => {
    const file = makeFile("x", "image/png");
    const result = validateUploadFile(file);

    expect(result.ok).toBe(true);
    expect(result.ok && result.file).toBe(file);
    expect(DEFAULT_MIME_PREFIXES).toEqual(["image/"]);
  });

  it("rejects a non-image as INVALID_TYPE", () => {
    expect(validateUploadFile(makeFile("x", "application/pdf"))).toEqual({
      ok: false,
      code: "INVALID_TYPE",
      details: { type: "application/pdf", accepted: ["image/"] },
    });
  });

  it("rejects a file with no declared type", () => {
    expect(validateUploadFile(makeFile("x", ""))).toMatchObject({
      ok: false,
      code: "INVALID_TYPE",
    });
  });

  it("checks the type before the size", () => {
    const result = validateUploadFile(makeFile("x", "application/pdf"), {
      maxBytes: 1,
    });

    expect(result).toMatchObject({ ok: false, code: "INVALID_TYPE" });
  });

  it("treats the byte limit as a maximum, inclusive", () => {
    const file = makeFile("1234", "image/png");

    expect(validateUploadFile(file, { maxBytes: 4 }).ok).toBe(true);
    expect(validateUploadFile(file, { maxBytes: 3 })).toMatchObject({
      ok: false,
      code: "TOO_LARGE",
    });
  });

  it("reports the measured size and the limit when too large", () => {
    const file = makeFile("12345", "image/png");

    expect(validateUploadFile(file, { maxBytes: 2 })).toEqual({
      ok: false,
      code: "TOO_LARGE",
      details: { size: 5, maxBytes: 2 },
    });
  });

  it("lets a project replace the prefixes", () => {
    expect(
      validateUploadFile(makeFile("x", "video/mp4"), {
        mimePrefixes: ["video/"],
      }).ok,
    ).toBe(true);
  });

  it("prefers an exact allow-list over the prefixes", () => {
    const policy = {
      allowedMimeTypes: ["image/jpeg", "image/webp"],
      mimePrefixes: ["image/"],
    };

    expect(validateUploadFile(makeFile("x", "image/webp"), policy).ok).toBe(
      true,
    );
    expect(validateUploadFile(makeFile("x", "image/svg+xml"), policy)).toEqual({
      ok: false,
      code: "INVALID_TYPE",
      details: {
        type: "image/svg+xml",
        accepted: ["image/jpeg", "image/webp"],
      },
    });
  });

  it("compares media types case-insensitively", () => {
    expect(validateUploadFile(makeFile("x", "IMAGE/PNG")).ok).toBe(true);
  });

  it("rejects svg by default as INVALID_TYPE", () => {
    expect(validateUploadFile(makeFile("x", "image/svg+xml"))).toEqual({
      ok: false,
      code: "INVALID_TYPE",
      details: { type: "image/svg+xml", accepted: ["image/"] },
    });
    expect(validateUploadFile(makeFile("x", "IMAGE/SVG+XML")).ok).toBe(false);
  });

  it("re-enables svg when the blocked list is explicitly emptied", () => {
    expect(
      validateUploadFile(makeFile("x", "image/svg+xml"), {
        blockedMimeTypes: [],
      }).ok,
    ).toBe(true);
  });

  it("rejects a blocked type even when the allow-list names it", () => {
    expect(
      validateUploadFile(makeFile("x", "image/svg+xml"), {
        allowedMimeTypes: ["image/svg+xml", "image/png"],
      }),
    ).toMatchObject({
      ok: false,
      code: "INVALID_TYPE",
      details: { type: "image/svg+xml" },
    });
  });
});

describe("isUploadableFile", () => {
  it("accepts a File and a Blob and rejects plain objects", () => {
    expect(isUploadableFile(makeFile("x", "image/png"))).toBe(true);
    expect(isUploadableFile(new Blob(["x"], { type: "image/png" }))).toBe(true);
    expect(isUploadableFile({})).toBe(false);
    expect(isUploadableFile(null)).toBe(false);
  });
});

describe("messages", () => {
  it("ships the original Spanish copy verbatim", () => {
    expect(ES_MESSAGES.errors.UNAUTHENTICATED).toBe("No autorizado");
    expect(ES_MESSAGES.errors.NO_FILE).toBe("No se proporcionó archivo");
    expect(ES_MESSAGES.errors.INVALID_TYPE).toBe(
      "El archivo debe ser una imagen",
    );
    expect(ES_MESSAGES.errors.TOO_LARGE).toBe(
      "El servidor rechazó la foto por pesada. Probá con una de menos de 15MB.",
    );
    expect(ES_MESSAGES.errors.MISSING_KEY).toBe("No se proporcionó key");
    expect(ES_MESSAGES.forbiddenReasons.NOT_OWNED).toBe(
      "No tienes permiso para eliminar esta imagen. No pertenece a ninguno de tus vehículos.",
    );
    expect(ES_MESSAGES.forbiddenReasons.OTHER_OWNER).toBe(
      "No tienes permiso para eliminar esta imagen. Pertenece a otro vehículo.",
    );
  });

  it("defaults to Spanish, layers overrides on top, and supports another catalog", () => {
    expect(createMessageResolver().error("NO_FILE")).toBe(
      "No se proporcionó archivo",
    );

    const overridden = createMessageResolver({
      overrides: { NO_FILE: "Falta el archivo" },
    });
    expect(overridden.error("NO_FILE")).toBe("Falta el archivo");
    expect(overridden.error("INVALID_TYPE")).toBe(
      "El archivo debe ser una imagen",
    );

    const english = createMessageResolver({
      catalog: EN_MESSAGES,
      forbiddenOverrides: { OTHER_OWNER: "Not yours" },
    });
    expect(english.error("NO_FILE")).toBe("No file was provided");
    expect(english.forbidden("OTHER_OWNER")).toBe("Not yours");
    expect(english.forbidden("NOT_OWNED")).toBe(
      EN_MESSAGES.forbiddenReasons.NOT_OWNED,
    );
  });

  it("has a string for every code in both catalogs", () => {
    expect(Object.keys(ES_MESSAGES.errors).sort()).toEqual(
      Object.keys(EN_MESSAGES.errors).sort(),
    );
    expect(Object.keys(ES_MESSAGES.forbiddenReasons).sort()).toEqual(
      Object.keys(EN_MESSAGES.forbiddenReasons).sort(),
    );
  });
});
