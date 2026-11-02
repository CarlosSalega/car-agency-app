"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useMemo, useRef, useState, useCallback, useEffect } from "react";

import { CarImage } from "@/components/cars/car-image";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface CarDetailGalleryProps {
  id?: string | number;
  title: string;
  images: string[];
}

const MAX_THUMBNAILS = 4;
const MIN_SCALE = 1;
const MAX_SCALE = 4;

export function CarDetailGallery({ images, title }: CarDetailGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Zoom / pan state
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });

  // Refs for gesture tracking
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const translateRef = useRef({ x: 0, y: 0 });
  const scaleRef = useRef(1);

  // Pinch tracking
  const lastPinchDist = useRef<number | null>(null);
  const lastPinchMid = useRef<{ x: number; y: number } | null>(null);

  const imageWrapperRef = useRef<HTMLDivElement>(null);
  const imageAreaRef = useRef<HTMLDivElement>(null);

  const safeImages = images.length > 0 ? images : [null];
  const mainImageKey = safeImages[currentIndex];

  const thumbnails = useMemo(
    () => safeImages.slice(0, MAX_THUMBNAILS),
    [safeImages],
  );
  const remainingCount = Math.max(0, safeImages.length - MAX_THUMBNAILS);

  const isZoomed = scale > 1.05;

  // Reset zoom when changing image or closing
  const resetZoom = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
    scaleRef.current = 1;
    translateRef.current = { x: 0, y: 0 };
  }, []);

  const next = useCallback(() => {
    resetZoom();
    setCurrentIndex((currentIdx) => (currentIdx + 1) % safeImages.length);
  }, [safeImages.length, resetZoom]);

  const prev = useCallback(() => {
    resetZoom();
    setCurrentIndex(
      (currentIdx) => (currentIdx - 1 + safeImages.length) % safeImages.length,
    );
  }, [safeImages.length, resetZoom]);

  const clampTranslate = useCallback(
    (offsetX: number, offsetY: number, targetScale: number) => {
      const wrapper = imageWrapperRef.current;
      if (!wrapper) return { x: offsetX, y: offsetY };
      const { width, height } = wrapper.getBoundingClientRect();
      const maxX = (width * (targetScale - 1)) / 2;
      const maxY = (height * (targetScale - 1)) / 2;
      return {
        x: Math.min(maxX, Math.max(-maxX, offsetX)),
        y: Math.min(maxY, Math.max(-maxY, offsetY)),
      };
    },
    [],
  );

  // ── Wheel zoom (desktop) — must use native listener to call preventDefault ──
  const handleWheel = useCallback(
    (wheelEvent: WheelEvent) => {
      wheelEvent.preventDefault();
      const zoomFactor = wheelEvent.deltaY > 0 ? 0.85 : 1.15;
      const nextScale = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, scaleRef.current * zoomFactor),
      );
      const clampedTranslate = clampTranslate(
        translateRef.current.x,
        translateRef.current.y,
        nextScale,
      );
      scaleRef.current = nextScale;
      translateRef.current = clampedTranslate;
      setScale(nextScale);
      setTranslate(clampedTranslate);
    },
    [clampTranslate],
  );

  useEffect(() => {
    if (!lightboxOpen) return;
    const frame = requestAnimationFrame(() => {
      const imageAreaElement = imageAreaRef.current;
      if (!imageAreaElement) return;
      imageAreaElement.addEventListener("wheel", handleWheel, {
        passive: false,
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      imageAreaRef.current?.removeEventListener("wheel", handleWheel); // ref may have changed, safe to call
    };
  }, [handleWheel, lightboxOpen]);

  // ── Mouse drag (desktop) ──────────────────────────────────────────────────
  const handleMouseDown = useCallback(
    (mouseEvent: React.MouseEvent) => {
      if (!isZoomed) return;
      isDragging.current = true;
      dragStart.current = {
        x: mouseEvent.clientX - translateRef.current.x,
        y: mouseEvent.clientY - translateRef.current.y,
      };
    },
    [isZoomed],
  );

  const handleMouseMove = useCallback(
    (mouseEvent: React.MouseEvent) => {
      if (!isDragging.current) return;
      const rawTranslate = {
        x: mouseEvent.clientX - dragStart.current.x,
        y: mouseEvent.clientY - dragStart.current.y,
      };
      const clampedTranslate = clampTranslate(
        rawTranslate.x,
        rawTranslate.y,
        scaleRef.current,
      );
      translateRef.current = clampedTranslate;
      setTranslate(clampedTranslate);
    },
    [clampTranslate],
  );

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  // Single / double click zoom
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasDragged = useRef(false);

  const handleMouseDownWithDrag = useCallback(
    (mouseEvent: React.MouseEvent) => {
      hasDragged.current = false;
      if (isZoomed) {
        isDragging.current = true;
        dragStart.current = {
          x: mouseEvent.clientX - translateRef.current.x,
          y: mouseEvent.clientY - translateRef.current.y,
        };
      }
    },
    [isZoomed],
  );

  const handleMouseMoveWithDrag = useCallback(
    (mouseEvent: React.MouseEvent) => {
      if (!isDragging.current) return;
      hasDragged.current = true;
      const rawTranslate = {
        x: mouseEvent.clientX - dragStart.current.x,
        y: mouseEvent.clientY - dragStart.current.y,
      };
      const clampedTranslate = clampTranslate(
        rawTranslate.x,
        rawTranslate.y,
        scaleRef.current,
      );
      translateRef.current = clampedTranslate;
      setTranslate(clampedTranslate);
    },
    [clampTranslate],
  );

  const applyZoom = useCallback(
    (nextScale: number) => {
      const clampedTranslate = clampTranslate(
        translateRef.current.x,
        translateRef.current.y,
        nextScale,
      );
      scaleRef.current = nextScale;
      translateRef.current = clampedTranslate;
      setScale(nextScale);
      setTranslate(clampedTranslate);
    },
    [clampTranslate],
  );

  const handleClick = useCallback(() => {
    if (hasDragged.current) return;
    if (clickTimer.current) {
      // Second click arrived — cancel single and do double-click logic
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      if (isZoomed) {
        resetZoom();
      } else {
        applyZoom(2.5);
      }
      return;
    }
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null;
      // Single click logic
      if (isZoomed) {
        resetZoom();
      } else {
        applyZoom(1.6);
      }
    }, 250);
  }, [isZoomed, resetZoom, applyZoom]);

  // ── Touch (mobile) ────────────────────────────────────────────────────────
  const handleTouchStart = useCallback(
    (touchEvent: React.TouchEvent) => {
      if (touchEvent.touches.length === 2) {
        const deltaX =
          touchEvent.touches[1].clientX - touchEvent.touches[0].clientX;
        const deltaY =
          touchEvent.touches[1].clientY - touchEvent.touches[0].clientY;
        lastPinchDist.current = Math.hypot(deltaX, deltaY);
        lastPinchMid.current = {
          x:
            (touchEvent.touches[0].clientX + touchEvent.touches[1].clientX) / 2,
          y:
            (touchEvent.touches[0].clientY + touchEvent.touches[1].clientY) / 2,
        };
      } else if (touchEvent.touches.length === 1 && isZoomed) {
        isDragging.current = true;
        dragStart.current = {
          x: touchEvent.touches[0].clientX - translateRef.current.x,
          y: touchEvent.touches[0].clientY - translateRef.current.y,
        };
      }
    },
    [isZoomed],
  );

  const handleTouchMove = useCallback(
    (touchEvent: React.TouchEvent) => {
      if (touchEvent.touches.length === 2 && lastPinchDist.current !== null) {
        touchEvent.preventDefault();
        const deltaX =
          touchEvent.touches[1].clientX - touchEvent.touches[0].clientX;
        const deltaY =
          touchEvent.touches[1].clientY - touchEvent.touches[0].clientY;
        const pinchDistance = Math.hypot(deltaX, deltaY);
        const pinchRatio = pinchDistance / lastPinchDist.current;
        const nextScale = Math.min(
          MAX_SCALE,
          Math.max(MIN_SCALE, scaleRef.current * pinchRatio),
        );
        const clampedTranslate = clampTranslate(
          translateRef.current.x,
          translateRef.current.y,
          nextScale,
        );
        scaleRef.current = nextScale;
        translateRef.current = clampedTranslate;
        lastPinchDist.current = pinchDistance;
        setScale(nextScale);
        setTranslate(clampedTranslate);
      } else if (touchEvent.touches.length === 1 && isDragging.current) {
        const rawTranslate = {
          x: touchEvent.touches[0].clientX - dragStart.current.x,
          y: touchEvent.touches[0].clientY - dragStart.current.y,
        };
        const clampedTranslate = clampTranslate(
          rawTranslate.x,
          rawTranslate.y,
          scaleRef.current,
        );
        translateRef.current = clampedTranslate;
        setTranslate(clampedTranslate);
      }
    },
    [clampTranslate],
  );

  const handleTouchEnd = useCallback(
    (touchEvent: React.TouchEvent) => {
      if (touchEvent.touches.length < 2) {
        lastPinchDist.current = null;
        lastPinchMid.current = null;
      }
      if (touchEvent.touches.length === 0) {
        isDragging.current = false;
        // Snap back to MIN_SCALE if slightly above 1
        if (scaleRef.current < 1.05) resetZoom();
      }
    },
    [resetZoom],
  );

  // Reset zoom when dialog closes
  useEffect(() => {
    if (!lightboxOpen) resetZoom();
  }, [lightboxOpen, resetZoom]);

  return (
    <div className="space-y-4">
      {/* Main image trigger */}
      <div
        className="group relative aspect-4/3 cursor-zoom-in overflow-hidden rounded-none"
        onClick={() => setLightboxOpen(true)}
      >
        <CarImage
          imageKey={mainImageKey}
          alt={`${title} - Imagen principal`}
          priority
          skipSkeleton
          variant="detail"
          className="size-full object-cover"
        />

        {safeImages.length > 1 && (
          <>
            <Button
              size="icon"
              className="absolute top-1/2 left-2 -translate-y-1/2 opacity-100 transition-opacity duration-200 ease-out focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100 md:motion-reduce:transition-none"
              onClick={(clickEvent) => {
                clickEvent.stopPropagation();
                prev();
              }}
            >
              <ChevronLeft />
            </Button>
            <Button
              size="icon"
              className="absolute top-1/2 right-2 -translate-y-1/2 opacity-100 transition-opacity duration-200 ease-out focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100 md:motion-reduce:transition-none"
              onClick={(clickEvent) => {
                clickEvent.stopPropagation();
                next();
              }}
            >
              <ChevronRight />
            </Button>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {safeImages.length > 1 && (
        <div className="grid grid-cols-4 gap-2">
          {thumbnails.map((imageKey, index) => {
            const isLastWithOverlay =
              index === MAX_THUMBNAILS - 1 && remainingCount > 0;
            return (
              <button
                key={`${imageKey}-${index}`}
                onClick={() => setCurrentIndex(index)}
                className={`relative aspect-4/3 overflow-hidden rounded-none ring-1 transition ${
                  index === currentIndex
                    ? "ring-brand"
                    : "ring-muted hover:ring-muted-foreground/40"
                }`}
              >
                <CarImage
                  imageKey={imageKey}
                  alt={`${title} - Miniatura ${index + 1}`}
                  skipSkeleton
                  variant="thumbnail"
                  className="size-full object-cover"
                />
                {isLastWithOverlay && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-lg font-semibold text-white">
                    +{remainingCount}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Lightbox Dialog */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent
          aria-describedby={undefined}
          className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed! inset-0! top-0! left-0! z-50! m-0! h-full! w-full! max-w-none! translate-x-0! translate-y-0! rounded-none! border-none bg-black/90 p-0! [&>button:first-of-type]:hidden"
        >
          {/* Base UI has no VisuallyHidden primitive; `sr-only` is the
              documented replacement and keeps the dialog title announced. */}
          <div className="sr-only">
            <DialogTitle>{title}</DialogTitle>
          </div>

          <div className="flex w-full" style={{ height: "100dvh" }}>
            {/* Thumbnail sidebar — hidden when zoomed */}
            {safeImages.length > 1 && (
              <aside
                className={`hidden w-27.5 shrink-0 flex-col gap-2 overflow-y-auto py-4 pr-2 pl-4 transition-opacity duration-200 sm:flex ${
                  isZoomed ? "pointer-events-none opacity-0" : "opacity-100"
                }`}
              >
                {safeImages.map((imageKey, index) => (
                  <button
                    key={`lb-thumb-${index}`}
                    onClick={() => {
                      setCurrentIndex(index);
                      resetZoom();
                    }}
                    className={`relative aspect-4/3 w-full shrink-0 overflow-hidden ring-2 transition ${
                      index === currentIndex
                        ? "ring-brand"
                        : "opacity-50 ring-transparent hover:opacity-90"
                    }`}
                  >
                    <CarImage
                      imageKey={imageKey}
                      alt={`${title} - ${index + 1}`}
                      skipSkeleton
                      variant="thumbnail"
                      className="size-full object-cover"
                    />
                  </button>
                ))}
              </aside>
            )}

            {/* Main area */}
            <div className="relative flex flex-1 flex-col overflow-hidden">
              {/* Counter */}
              <span
                className={`absolute top-4 left-4 z-10 text-sm font-medium text-white/80 transition-opacity duration-200 select-none ${
                  isZoomed ? "opacity-0" : "opacity-100"
                }`}
              >
                {currentIndex + 1} / {safeImages.length}
              </span>

              {/* Zoom hint */}
              {isZoomed && (
                <span className="absolute top-4 left-4 z-10 text-xs font-medium text-white/60 select-none">
                  Click para restablecer
                </span>
              )}

              {/* Close */}
              <Button
                size="icon"
                onClick={() => setLightboxOpen(false)}
                className="absolute top-4 right-4 z-10 size-9"
                aria-label="Cerrar"
              >
                <X className="size-5" />
              </Button>

              {/* Image wrapper — zoom & pan handled here */}
              <div
                ref={imageAreaRef}
                className="flex flex-1 items-center justify-center overflow-hidden px-14 py-12"
                onMouseDown={handleMouseDownWithDrag}
                onMouseMove={handleMouseMoveWithDrag}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onClick={handleClick}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{
                  cursor: isZoomed
                    ? isDragging.current
                      ? "grabbing"
                      : "grab"
                    : "zoom-in",
                }}
              >
                <div
                  ref={imageWrapperRef}
                  className="relative w-full"
                  style={{
                    maxHeight: "calc(100dvh - 96px)",
                    aspectRatio: "4/3",
                    maxWidth: "calc((100dvh - 96px) * 4 / 3)",
                    transform: `scale(${scale}) translate(${translate.x / scale}px, ${translate.y / scale}px)`,
                    transition: isDragging.current
                      ? "none"
                      : "transform 0.15s ease-out",
                    transformOrigin: "center center",
                    willChange: "transform",
                  }}
                >
                  <CarImage
                    imageKey={mainImageKey}
                    alt={`${title} - Fullscreen`}
                    skipSkeleton
                    variant="fullscreen"
                    className="size-full"
                  />
                </div>
              </div>

              {/* Arrows — hidden when zoomed */}
              {safeImages.length > 1 && (
                <>
                  <Button
                    size="icon"
                    onClick={prev}
                    className={`absolute top-1/2 left-3 size-11 -translate-y-1/2 transition-opacity ${
                      isZoomed ? "pointer-events-none opacity-0" : "opacity-100"
                    }`}
                    aria-label="Anterior"
                  >
                    <ChevronLeft className="size-6" />
                  </Button>
                  <Button
                    size="icon"
                    onClick={next}
                    className={`absolute top-1/2 right-3 size-11 -translate-y-1/2 transition-opacity ${
                      isZoomed ? "pointer-events-none opacity-0" : "opacity-100"
                    }`}
                    aria-label="Siguiente"
                  >
                    <ChevronRight className="size-6" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
