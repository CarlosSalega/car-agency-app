import { render, screen } from "@testing-library/react";
import Link from "next/link";
import { describe, expect, it, vi } from "vitest";

import { Button } from "@/components/ui/button";

/**
 * Base UI's Button defaults `nativeButton` to `true` and logs a console error
 * when the rendered element is not a real `<button>`, because claiming button
 * semantics on an anchor breaks form submission and assistive technology.
 *
 * Every call site in this project that renders a `next/link` through `render`
 * triggered that warning. Rather than passing `nativeButton={false}` at each one
 * — and having the next `render` call site reintroduce it — the wrapper derives
 * the flag from the presence of `render`.
 *
 * This test pins that derivation, and it is deliberately a wrapper-level test
 * rather than a consumer test: the bug appeared at eight call sites, so testing
 * one of them would only cover one.
 */
describe("Button nativeButton derivation", () => {
  function collectNativeButtonWarnings(spy: ReturnType<typeof vi.spyOn>) {
    return spy.mock.calls.filter((call) =>
      String(call[0]).includes("nativeButton"),
    );
  }

  it("does not warn when render substitutes an anchor", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<Button render={<Link href="/somewhere">Ir</Link>} />);

    const warnings = collectNativeButtonWarnings(error);
    error.mockRestore();

    expect(warnings).toEqual([]);
  });

  it("keeps native button semantics when no render is provided", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<Button>Real</Button>);

    const warnings = collectNativeButtonWarnings(error);
    error.mockRestore();

    expect(warnings).toEqual([]);
    expect(screen.getByRole("button", { name: "Real" }).tagName).toBe("BUTTON");
  });

  it("lets an explicit nativeButton win over the derivation", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    // The consumer asserts button semantics on a rendered button, which is
    // legitimate and must not be overridden by the derivation.
    render(<Button nativeButton render={<button>Explicit</button>} />);

    const warnings = collectNativeButtonWarnings(error);
    error.mockRestore();

    expect(warnings).toEqual([]);
    expect(screen.getByRole("button", { name: "Explicit" })).toBeTruthy();
  });

  it("keeps the project-specific variants working", () => {
    for (const variant of ["success", "info", "warning"] as const) {
      const { unmount } = render(<Button variant={variant}>X</Button>);
      expect(screen.getByRole("button", { name: "X" })).toBeTruthy();
      unmount();
    }
  });
});
