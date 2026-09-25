"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ImagePlus, Loader2, X } from "lucide-react";
import { useId, useState, useRef } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { resolveImageUrl } from "@/lib/images/resolve-image-url";

interface ImageUploadProps {
  value: string[];
  onChange: (value: string[]) => void;
}

const MAX_IMAGES = 10;
const MAX_FILE_SIZE = 15 * 1024 * 1024;
const MAX_FILE_SIZE_MB = 15;

// Friendly user-facing copy (Spanish); identifiers and comments stay in English.
const UPLOAD_TOO_LARGE_SERVER_ERROR =
  "El servidor rechazó la foto por pesada. Probá con una de menos de 15MB.";
const UPLOAD_GENERIC_ERROR =
  "No pudimos subir esa imagen. Revisá tu conexión y probá de nuevo.";

function formatFileSizeMB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function buildTooLargeClientError(fileSize: number): string {
  return `Esta foto es muy pesada (${formatFileSizeMB(fileSize)}). El máximo es ${MAX_FILE_SIZE_MB}MB — probá bajarle la calidad o elegir otra.`;
}

// Platform gateways (e.g. Vercel) may reject an oversized body with plain
// text such as "Request Entity Too Large" or an HTML error page instead of
// JSON, which used to surface as "Unexpected token 'R'... is not valid JSON".
function looksLikePlatformLimitBody(rawText: string): boolean {
  const text = rawText.trimStart();
  return (
    text.startsWith("Request En") ||
    text.startsWith("Request Entity") ||
    text.startsWith("<!DOCTYPE")
  );
}

function looksLikeJsonParseError(message: string): boolean {
  return (
    message.includes("Unexpected token") || message.includes("is not valid JSON")
  );
}

// Read the body as text exactly once (a Response body can only be consumed
// once), then JSON-parse only when the content-type claims JSON.
async function readErrorMessage(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";
  let rawText = "";
  try {
    rawText = await response.text();
  } catch {
    return response.status === 413
      ? UPLOAD_TOO_LARGE_SERVER_ERROR
      : UPLOAD_GENERIC_ERROR;
  }
  if (response.status === 413 || looksLikePlatformLimitBody(rawText)) {
    return UPLOAD_TOO_LARGE_SERVER_ERROR;
  }
  if (contentType.includes("json") && rawText) {
    try {
      const data: unknown = JSON.parse(rawText);
      if (
        typeof data === "object" &&
        data !== null &&
        "error" in data &&
        typeof (data as { error: unknown }).error === "string" &&
        (data as { error: string }).error
      ) {
        return (data as { error: string }).error;
      }
    } catch (parseError) {
      if (
        parseError instanceof Error &&
        looksLikeJsonParseError(parseError.message)
      ) {
        return UPLOAD_TOO_LARGE_SERVER_ERROR;
      }
    }
  }
  return UPLOAD_GENERIC_ERROR;
}

async function readUploadKey(response: Response): Promise<string> {
  const rawText = await response.text();
  try {
    const data: unknown = JSON.parse(rawText);
    if (
      typeof data === "object" &&
      data !== null &&
      "key" in data &&
      typeof (data as { key: unknown }).key === "string"
    ) {
      return (data as { key: string }).key;
    }
  } catch (parseError) {
    if (
      parseError instanceof Error &&
      looksLikeJsonParseError(parseError.message)
    ) {
      throw new Error(UPLOAD_TOO_LARGE_SERVER_ERROR);
    }
    throw new Error(UPLOAD_GENERIC_ERROR);
  }
  if (looksLikePlatformLimitBody(rawText)) {
    throw new Error(UPLOAD_TOO_LARGE_SERVER_ERROR);
  }
  throw new Error(UPLOAD_GENERIC_ERROR);
}

// Spanish announcements for the aria-live region.
export function buildMoveAnnouncement(
  fromPosition: number,
  toPosition: number,
  total: number,
): string {
  return `Imagen ${fromPosition} movida a la posición ${toPosition} de ${total}`;
}

interface SortableThumbnailProps {
  imageKey: string;
  index: number;
  instructionsId: string;
  onRemove: (imageKey: string) => void;
}

// Defined at module level so React keeps its identity across renders.
// D6: the WHOLE thumbnail is the drag surface. Previously listeners lived on
// a tiny grip button only, so pressing the photo body never reached the
// dnd-kit sensors (mousedown on the img bubbled to a node with no sensor
// listeners) and the native img drag ghost interfered. Now attributes +
// listeners sit on the container, the img is not natively draggable, and the
// delete button stops pointerdown propagation so deleting never starts a drag.
function SortableThumbnail({
  imageKey,
  index,
  instructionsId,
  onRemove,
}: SortableThumbnailProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: imageKey });

  const position = index + 1;
  const isCover = index === 0;
  const fileName = imageKey.split("/").pop() ?? imageKey;

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    touchAction: "none" as const,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      title={fileName}
      {...attributes}
      {...listeners}
      tabIndex={0}
      role="button"
      aria-label={
        isCover
          ? `Imagen ${position} (portada): arrastra para reordenar`
          : `Imagen ${position}: arrastra para reordenar`
      }
      aria-describedby={instructionsId}
      className={`group bg-muted relative aspect-4/3 max-w-20 cursor-grab touch-none overflow-hidden rounded-lg border focus-visible:outline-2 focus-visible:outline-offset-2 active:cursor-grabbing ${
        isDragging ? "z-10 opacity-70" : ""
      }`}
    >
      <img
        src={resolveImageUrl(imageKey, "thumbnail")}
        alt={isCover ? `Imagen ${position} (portada)` : `Imagen ${position}`}
        loading="lazy"
        decoding="async"
        fetchPriority="low"
        draggable={false}
        className="size-full object-cover"
      />

      {isCover && (
        <span className="bg-primary text-primary-foreground absolute top-8 left-1/2 -translate-x-1/2 rounded px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap">
          Portada
        </span>
      )}

      {/* Delete is always keyboard/touch reachable, never hover-only. */}
      <button
        type="button"
        onClick={() => onRemove(imageKey)}
        onPointerDown={(event) => event.stopPropagation()}
        aria-label={`Eliminar imagen ${position}`}
        className="bg-destructive text-destructive-foreground hover:bg-destructive/90 absolute top-1 right-1 flex size-5 items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100"
      >
        <X className="size-3" aria-hidden="true" />
      </button>
    </div>
  );
}

export function ImageUpload({ value, onChange }: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const instructionsId = useId();

  // Pointer for mouse, TouchSensor with delay so page scroll still works,
  // KeyboardSensor so dragging itself is keyboard operable.
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const reorder = (fromIndex: number, toIndex: number) => {
    const nextOrder = arrayMove(value, fromIndex, toIndex);
    onChange(nextOrder);
    setAnnouncement(
      buildMoveAnnouncement(fromIndex + 1, toIndex + 1, value.length),
    );
  };

  const handleDragStart = (event: DragStartEvent) => {
    const position = value.indexOf(String(event.active.id)) + 1;
    if (position > 0) {
      setAnnouncement(
        `Imagen ${position} en movimiento. Usa las flechas para moverla y Espacio para soltarla.`,
      );
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = value.indexOf(String(active.id));
    const toIndex = value.indexOf(String(over.id));
    if (fromIndex === -1 || toIndex === -1) return;
    reorder(fromIndex, toIndex);
  };

  const handleDragCancel = () => {
    setAnnouncement("Reordenamiento cancelado");
  };

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files || []);

    if (files.length === 0) return;

    if (value.length + files.length > MAX_IMAGES) {
      toast.error(`Máximo ${MAX_IMAGES} imágenes permitidas`);
      return;
    }

    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} no es una imagen válida`);
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(buildTooLargeClientError(file.size));
        return;
      }
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      let completed = 0;

      const uploadPromises = files.map(async (file) => {
        const formData = new FormData();
        formData.append("file", file);

        let response: Response;
        try {
          response = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          });
        } catch {
          throw new Error(UPLOAD_GENERIC_ERROR);
        }

        if (!response.ok) {
          throw new Error(await readErrorMessage(response));
        }

        const key = await readUploadKey(response);

        completed++;
        setUploadProgress(Math.round((completed / files.length) * 100));

        return key;
      });

      const uploadedKeys = await Promise.all(uploadPromises);

      onChange([...value, ...uploadedKeys]);

      const imageWord =
        uploadedKeys.length > 1 ? "imágenes subidas" : "imagen subida";
      toast.success(`${uploadedKeys.length} ${imageWord}`);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(
        error instanceof Error ? error.message : UPLOAD_GENERIC_ERROR,
      );
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemove = async (imageKey: string) => {
    const newValue = value.filter((key) => key !== imageKey);
    onChange(newValue);

    try {
      const response = await fetch("/api/upload", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: imageKey }),
      });

      if (!response.ok) {
        onChange(value);
        toast.error("Error al eliminar la imagen");
      }
    } catch {
      onChange(value);
      toast.error("Error de conexión");
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex flex-col gap-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
        disabled={isUploading || value.length >= MAX_IMAGES}
      />

      <Button
        className="bg-foreground hover:bg-foreground/90 text-background"
        type="button"
        onClick={handleButtonClick}
        disabled={isUploading || value.length >= MAX_IMAGES}
      >
        {isUploading ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Subiendo... {uploadProgress}%
          </>
        ) : (
          <>
            <ImagePlus className="mr-2 size-4" />
            Subir imágenes ({value.length}/{MAX_IMAGES})
          </>
        )}
      </Button>

      {value.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext items={value} strategy={rectSortingStrategy}>
            <p id={instructionsId} className="sr-only">
              Para reordenar con el teclado: enfoca una foto, pulsa Espacio
              para levantarla, usa las flechas para moverla y pulsa Espacio
              para soltarla. La primera imagen es la portada.
            </p>
            <div
              role="group"
              aria-label="Fotos del vehículo: arrastra para reordenar. La primera imagen es la portada."
              aria-describedby={instructionsId}
              className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5"
            >
              {value.map((imageKey, imageIndex) => (
                <SortableThumbnail
                  key={imageKey}
                  imageKey={imageKey}
                  index={imageIndex}
                  instructionsId={instructionsId}
                  onRemove={handleRemove}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Screen-reader announcements for every reorder, same vocabulary as car-grid. */}
      <p
        role="status"
        aria-live="polite"
        aria-label="Anuncios de reordenamiento"
        className="sr-only"
      >
        {announcement}
      </p>

      {value.length === 0 && (
        <div className="bg-card flex h-32 items-center justify-center rounded-lg border-2 border-dashed">
          <p className="text-muted-foreground text-sm">
            No hay imágenes. Haz clic en &quot;Subir imágenes&quot; para agregar.
          </p>
        </div>
      )}
    </div>
  );
}
