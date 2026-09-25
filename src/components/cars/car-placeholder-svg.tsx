"use client";

import { cn } from "@/lib/utils";

interface CarPlaceholderSVGProps {
  className?: string;
  alt?: string;
}

export function CarPlaceholderSVG({
  className,
  alt = "Imagen no disponible",
}: CarPlaceholderSVGProps) {
  return (
    <div
      className={cn("bg-muted flex items-center justify-center", className)}
      role="img"
      aria-label={alt}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-muted-foreground size-12"
      >
        <path d="M5 17h14l-1-7H6l-1 7z" />
        <path d="M7 17v-4" />
        <path d="M17 17v-4" />
        <path d="M5 10h14" />
        <circle cx="7" cy="17" r="2" />
        <circle cx="17" cy="17" r="2" />
      </svg>
    </div>
  );
}
