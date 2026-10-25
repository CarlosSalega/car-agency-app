// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Characterization test for POST /api/auth/logout.
 *
 * The handler is a thin wrapper: it delegates to `deleteSession()` and always
 * answers 200. The real behaviour (row deletion + cookie clearing) is covered
 * in `src/lib/auth/__tests__/session.test.ts`.
 */

const state = vi.hoisted(() => ({
  deleteSession: vi.fn(async () => undefined),
}));

vi.mock("@/lib/auth", () => ({
  deleteSession: state.deleteSession,
}));

import { POST } from "@/app/api/auth/logout/route";

beforeEach(() => {
  state.deleteSession.mockClear();
});

describe("POST /api/auth/logout", () => {
  it("delegates to deleteSession and answers 200", async () => {
    const response = await POST();

    expect(state.deleteSession).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
  });
});
