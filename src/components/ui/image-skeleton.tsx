"use client";

import { cn } from "@/lib/utils";

interface ImageSkeletonProps {
  className?: string;
}

export function ImageSkeleton({ className }: ImageSkeletonProps) {
  return (
    <div
      className={cn("bg-muted relative size-full overflow-hidden", className)}
      aria-label="Cargando imagen..."
      role="status"
    >
      <div className="via-muted-foreground/10 animate-shimmer absolute inset-0 bg-gradient-to-r from-transparent to-transparent" />
    </div>
  );
}
