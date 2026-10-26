import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression tests for the sign-out request.
 *
 * better-auth's `/api/auth/sign-out` requires `Content-Type: application/json`
 * and answers `415 UNSUPPORTED_MEDIA_TYPE` to a bodyless POST. The handler used
 * to redirect to `/` regardless of the status, so a 415 looked like a logout
 * while the session cookie stayed valid.
 */

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));

vi.mock("sonner", () => ({
  toast: { error: toastError, success: vi.fn() },
}));

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  toastError.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

import { logout } from "@/lib/auth/logout";

describe("logout", () => {
  it("sends the JSON content type and body better-auth requires", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 415 });

    await logout();

    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, init] = fetchMock.mock.calls[0];

    expect(url).toBe("/api/auth/sign-out");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(init.body)).toEqual({});
    expect(init.credentials).toBe("include");
  });

  it("surfaces a failed sign-out instead of pretending it succeeded", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 415 });

    await logout();

    expect(toastError).toHaveBeenCalledOnce();
  });
});
