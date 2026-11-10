import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// `@/site/active` resolves the client at import time from `SITE_SLUG` and
// deliberately throws when the variable is missing or unknown, so the suite has
// to pin it before any test module is imported. Pinned unconditionally, not as a
// default: a suite whose client depends on the developer's shell is a suite that
// passes here and fails in CI, and the value a test sees would be a lottery. The
// demo package ships with the product, so "demo" is always available.
process.env.SITE_SLUG = "demo";

// @testing-library/react only auto-registers cleanup when the test runner
// exposes global afterEach; vitest here runs with globals disabled.
afterEach(() => {
  cleanup();
});

// jsdom does not implement `matchMedia`. `useIsMobile` (src/hooks/use-mobile.ts)
// depends on it, so anything rendering the sidebar needs this. Defined here
// rather than per test file so every consumer gets it.
//
// The stub reports "not mobile" by default; individual tests can override
// `window.matchMedia` when they need a specific viewport.
if (typeof window !== "undefined" && !window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}
