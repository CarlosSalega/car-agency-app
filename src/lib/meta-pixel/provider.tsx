"use client";

import { createContext, useContext, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { track } from "./events";

/**
 * React Context exposing the `track()` function to descendants. The provider
 * is mounted only when `NEXT_PUBLIC_META_PIXEL_ID` is set; in that case the
 * base script in `app/layout.tsx` defines `window.fbq` and `track()` becomes
 * a thin wrapper around it. When the env var is absent, the provider is
 * bypassed and the hook throws — by design, because every call site should
 * also be feature-gated.
 */
const TrackContext = createContext<typeof track | null>(null);

interface MetaPixelProviderProps {
  children: React.ReactNode;
}

/**
 * Wraps the app with the `track()` context and fires a `PageView` event on
 * mount and on every client-side route change. The first manual effect run
 * (mount) is suppressed by `hasMountedRef` so we don't double-track the
 * initial page that the base script already reports via its own
 * `fbq('track', 'PageView')` call.
 *
 * When `NEXT_PUBLIC_META_PIXEL_ID` is not configured, this is a no-op
 * passthrough — the base script and provider are both skipped, and the
 * `useTrack` hook is never expected to be called.
 */
export function MetaPixelProvider({ children }: MetaPixelProviderProps) {
  const pathname = usePathname();
  const hasMountedRef = useRef(false);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    track("PageView");
  }, [pathname]);

  return <TrackContext.Provider value={track}>{children}</TrackContext.Provider>;
}

/**
 * Returns the shared `track()` function from context. Throws when used
 * outside of `MetaPixelProvider` so misconfiguration surfaces immediately
 * during development instead of silently no-opping in production.
 */
export function useTrack() {
  const trackFn = useContext(TrackContext);
  if (!trackFn) {
    throw new Error("useTrack must be used within a MetaPixelProvider");
  }
  return trackFn;
}
