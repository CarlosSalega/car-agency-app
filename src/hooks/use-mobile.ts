import * as React from "react";

const MOBILE_BREAKPOINT = 768;

/**
 * Reports whether the viewport is below the mobile breakpoint.
 *
 * Returns `false` on the server and during the first client render, so React
 * does not report a hydration mismatch; the real value lands in the effect.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const query = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);

    const onChange = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);

    onChange();
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
