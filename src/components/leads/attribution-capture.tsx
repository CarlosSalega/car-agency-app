"use client";

import { useEffect } from "react";

import { captureFirstTouch } from "@/lib/leads/attribution";

/**
 * Persists the first-touch campaign on the first page the visitor lands on.
 *
 * It is mounted in the root layout, unconditionally, and that is deliberate:
 * `MetaPixelProvider` would have been the natural neighbour, but it is only
 * mounted when `NEXT_PUBLIC_META_PIXEL_ID` is set, so attribution would silently
 * stop working on a deployment without a pixel.
 *
 * One effect on mount is enough. The root layout survives client-side
 * navigation, so a visitor who lands on `/` with campaign parameters and then
 * walks to a car page keeps the campaign that `captureFirstTouch` stored.
 */
export function AttributionCapture() {
  useEffect(() => {
    captureFirstTouch();
  }, []);

  return null;
}
