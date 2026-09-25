"use client";

import { useEffect, useRef, useState } from "react";

import { ImageSkeleton } from "@/components/ui/image-skeleton";
import { FALLBACK_IMAGE } from "@/lib/constants/constants";
import { cn } from "@/lib/utils";
import { resolveImageUrl } from "@/lib/images/resolve-image-url";

type ImageVariant = "thumbnail" | "card" | "detail" | "fullscreen";

interface CarImageProps {
  imageKey?: string | null;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  skipSkeleton?: boolean;
  variant?: ImageVariant;
}

type ImageState = "loading" | "loaded" | "error";

export function CarImage({
  imageKey,
  alt,
  className,
  priority = false,
  sizes = "(max-width: 768px) 100vw, 50vw",
  skipSkeleton = false,
  variant = "card",
}: CarImageProps) {
  const [state, setState] = useState<ImageState>(
    skipSkeleton ? "loaded" : "loading",
  );

  const imgRef = useRef<HTMLImageElement>(null);
  const src = imageKey ? resolveImageUrl(imageKey, variant) : FALLBACK_IMAGE;

  useEffect(() => {
    if (skipSkeleton) return;

    const img = imgRef.current;
    if (!img) return;

    if (img.complete) {
      setState(img.naturalWidth > 0 ? "loaded" : "error");
      return;
    }

    setState("loading");

    const onLoad = () => setState("loaded");
    const onError = () => setState("error");

    img.addEventListener("load", onLoad);
    img.addEventListener("error", onError);

    return () => {
      img.removeEventListener("load", onLoad);
      img.removeEventListener("error", onError);
    };
  }, [src, skipSkeleton]);

  if (state === "error") {
    return (
      <div className={cn("relative", className)}>
        <img
          src={FALLBACK_IMAGE}
          alt={alt}
          width={800}
          height={500}
          decoding="async"
          className="size-full object-cover"
          loading={priority ? "eager" : "lazy"}
        />
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      {state === "loading" && !skipSkeleton && (
        <ImageSkeleton className="absolute inset-0 z-10" />
      )}

      <img
        ref={imgRef}
        src={src}
        alt={alt}
        width={800}
        height={500}
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        className={cn(
          "size-full object-cover transition-opacity duration-300",
          !skipSkeleton && state === "loading" ? "opacity-0" : "opacity-100",
        )}
      />
    </div>
  );
}
