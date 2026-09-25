import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// @testing-library/react only auto-registers cleanup when the test runner
// exposes global afterEach; vitest here runs with globals disabled.
afterEach(() => {
  cleanup();
});
