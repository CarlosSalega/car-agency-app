import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

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
