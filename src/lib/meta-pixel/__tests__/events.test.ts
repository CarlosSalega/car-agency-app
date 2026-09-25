import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { track } from "@/lib/meta-pixel/events";

describe("track()", () => {
  const fbqMock = vi.fn();

  beforeEach(() => {
    fbqMock.mockReset();
    window.fbq = fbqMock;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns early when NEXT_PUBLIC_META_PIXEL_ID is not set", () => {
    // env stubbed to empty string — `!process.env.X` is true
    vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", "");
    track("PageView");
    expect(fbqMock).not.toHaveBeenCalled();
  });

  it("returns early when window is undefined (SSR simulation)", () => {
    vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", "1661798508213583");
    vi.stubGlobal("window", undefined);
    track("PageView");
    expect(fbqMock).not.toHaveBeenCalled();
  });

  it("returns early when window.fbq is undefined (ad-blocker simulation)", () => {
    vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", "1661798508213583");
    window.fbq = undefined;
    track("PageView");
    expect(fbqMock).not.toHaveBeenCalled();
  });

  it("calls window.fbq with the correct event name and payload when all guards pass", () => {
    vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", "1661798508213583");
    const payload = {
      content_name: "Toyota Corolla 2022",
      content_category: "vehicle" as const,
      brand: "Toyota",
      model: "Corolla",
      year: 2022,
      price: 25000,
    };
    track("ViewContent", payload);
    expect(fbqMock).toHaveBeenCalledTimes(1);
    expect(fbqMock).toHaveBeenCalledWith("track", "ViewContent", payload);
  });

  it("forwards the payload to window.fbq unchanged", () => {
    vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", "1661798508213583");
    const payload = { method: "whatsapp" as const };
    track("Contact", payload);
    // The second positional argument received by fbq must be the exact
    // same object reference (no defensive copying, no mutation).
    expect(fbqMock.mock.calls[0]?.[2]).toBe(payload);
  });
});
