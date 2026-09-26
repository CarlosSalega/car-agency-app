import type { EventDataMap, MetaPixelEvent, TrackFunction } from "./types";

/**
 * Augment the global `Window` interface so `window.fbq` is known to the
 * TypeScript compiler. The Meta Pixel base code populates `fbq` at runtime;
 * without this declaration the call site would error on every access.
 */
declare global {
  interface Window {
    fbq?: (
      action: "track",
      event: MetaPixelEvent,
      data?: EventDataMap[MetaPixelEvent],
    ) => void;
  }
}

/**
 * Sends a Meta Pixel event through `window.fbq`. Silently no-ops when:
 *   - `window` is undefined (SSR, server prerender)
 *   - `window.fbq` is undefined (ad-blocker, script not loaded yet)
 *   - `NEXT_PUBLIC_META_PIXEL_ID` is not configured (feature disabled)
 *
 * The function is intentionally infallible: per R5, a failed tracking call
 * must never throw, log, or surface to the user.
 */
export const track: TrackFunction = <E extends MetaPixelEvent>(
  event: E,
  ...args: [EventDataMap[E]] extends [undefined] ? [] : [data: EventDataMap[E]]
) => {
  if (typeof window === "undefined") return;
  if (!window.fbq) return;
  if (!process.env.NEXT_PUBLIC_META_PIXEL_ID) return;

  // The rest tuple is `[] | [data]` depending on `E`, so the payload has to be
  // widened before it reaches `fbq`, whose signature takes the non-generic
  // `EventDataMap[MetaPixelEvent] | undefined`.
  const data = args[0] as EventDataMap[MetaPixelEvent] | undefined;

  window.fbq("track", event, data);
};
