import type { ImageErrorCode } from "./errors";

export type ForbiddenReason = "NOT_OWNED" | "OTHER_OWNER";

export interface MessageCatalog {
  readonly errors: Record<ImageErrorCode, string>;
  readonly forbiddenReasons: Record<ForbiddenReason, string>;
}

export const ES_MESSAGES: MessageCatalog = {
  errors: {
    UNAUTHENTICATED: "No autorizado",
    FORBIDDEN: "No tienes permiso para realizar esta acción",
    NO_FILE: "No se proporcionó archivo",
    INVALID_TYPE: "El archivo debe ser una imagen",
    TOO_LARGE:
      "El servidor rechazó la foto por pesada. Probá con una de menos de 15MB.",
    MISSING_KEY: "No se proporcionó key",
    PATH_MISSING: "Ruta de imagen no proporcionada",
    NOT_FOUND: "Imagen no encontrada",
    PROVIDER_UNKNOWN: "Proveedor de imagen no soportado",
    MISCONFIGURED:
      "La configuración del almacenamiento de imágenes está incompleta",
    UPLOAD_FAILED: "Error al subir la imagen",
    DELETE_FAILED: "Error al eliminar la imagen",
    UPSTREAM_FAILED: "Error al obtener la imagen",
    TIMEOUT: "La imagen tardó demasiado en responder",
  },
  forbiddenReasons: {
    NOT_OWNED:
      "No tienes permiso para eliminar esta imagen. No pertenece a ninguno de tus vehículos.",
    OTHER_OWNER:
      "No tienes permiso para eliminar esta imagen. Pertenece a otro vehículo.",
  },
};

export const EN_MESSAGES: MessageCatalog = {
  errors: {
    UNAUTHENTICATED: "Unauthorized",
    FORBIDDEN: "You are not allowed to perform this action",
    NO_FILE: "No file was provided",
    INVALID_TYPE: "The file must be an image",
    TOO_LARGE: "The server rejected the file because it is too large.",
    MISSING_KEY: "No key was provided",
    PATH_MISSING: "No image path was provided",
    NOT_FOUND: "Image not found",
    PROVIDER_UNKNOWN: "Unsupported image provider",
    MISCONFIGURED: "The image storage configuration is incomplete",
    UPLOAD_FAILED: "Could not upload the image",
    DELETE_FAILED: "Could not delete the image",
    UPSTREAM_FAILED: "Could not fetch the image",
    TIMEOUT: "The image took too long to respond",
  },
  forbiddenReasons: {
    NOT_OWNED:
      "You are not allowed to delete this image. It does not belong to any of your records.",
    OTHER_OWNER:
      "You are not allowed to delete this image. It belongs to someone else.",
  },
};

export interface MessagesConfig {
  readonly catalog?: MessageCatalog;

  readonly overrides?: Partial<Record<ImageErrorCode, string>>;

  readonly forbiddenOverrides?: Partial<Record<ForbiddenReason, string>>;
}

export interface MessageResolver {
  error(code: ImageErrorCode): string;
  forbidden(reason: ForbiddenReason): string;
}

export function createMessageResolver(
  config: MessagesConfig = {},
): MessageResolver {
  const catalog = config.catalog ?? ES_MESSAGES;
  const overrides = config.overrides ?? {};
  const forbiddenOverrides = config.forbiddenOverrides ?? {};

  return {
    error(code) {
      return (
        overrides[code] ?? catalog.errors[code] ?? ES_MESSAGES.errors[code]
      );
    },
    forbidden(reason) {
      return (
        forbiddenOverrides[reason] ??
        catalog.forbiddenReasons[reason] ??
        ES_MESSAGES.forbiddenReasons[reason]
      );
    },
  };
}
