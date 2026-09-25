"use client";

import { useEffect } from "react";

import { track } from "@/lib/meta-pixel";

interface MetaPixelViewContentProps {
  content_name: string;
  brand: string;
  model: string;
  year: number;
  price: number;
}

/**
 * Fires a single `ViewContent` Meta Pixel event when the vehicle detail
 * page mounts. The component renders nothing — it exists purely to bridge
 * the server-rendered page (which already owns the car data) with the
 * client-side `track()` call.
 *
 * `track()` silently no-ops when the pixel is unconfigured, blocked, or
 * running in a non-browser environment, so this component is safe to mount
 * unconditionally on every detail page render.
 */
export function MetaPixelViewContent({
  content_name,
  brand,
  model,
  year,
  price,
}: MetaPixelViewContentProps) {
  useEffect(() => {
    track("ViewContent", {
      content_name,
      content_category: "vehicle",
      brand,
      model,
      year,
      price,
    });
  }, [content_name, brand, model, year, price]);

  return null;
}
