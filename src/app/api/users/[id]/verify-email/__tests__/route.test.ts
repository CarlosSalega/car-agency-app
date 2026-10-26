// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Pins the admin verification endpoint.
 *
 * The security-relevant property is that the destination address comes from the
 * database row, never from the request: better-auth's own
 * `/send-verification-email` accepts an arbitrary `email` in its body, so a
 * pass-through endpoint would be a mail-bombing primitive for any authenticated
 * user.
 */

const state = vi.hoisted(() => ({
  role: "ADMIN" as "ADMIN" | "COLLABORATOR" | null,
  user: null as null | {
    id: string;
    email: string;
    emailVerified: boolean;
    isActive: boolean;
  },
  findUnique: vi.fn(),
  logCreate: vi.fn(async () => ({})),
  sendVerificationEmail: vi.fn(async () => ({ status: true })),
}));

vi.mock("@/lib/auth", () => ({
  getSession: async () =>
    state.role
      ? {
          sessionToken: "tok",
          userId: "admin-1",
          expires: new Date(Date.now() + 60_000),
          user: { id: "admin-1", role: state.role },
        }
      : null,
}));

vi.mock("@/lib/auth/server", () => ({
  auth: { api: { sendVerificationEmail: state.sendVerificationEmail } },
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: state.findUnique },
    log: { create: state.logCreate },
  },
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

import { POST } from "../route";

const params = (id: string) => ({ params: Promise.resolve({ id }) });

function postRequest(id: string) {
  return new NextRequest(`http://localhost:3000/api/users/${id}/verify-email`, {
    method: "POST",
  });
}

beforeEach(() => {
  state.role = "ADMIN";
  state.user = {
    id: "user-2",
    email: "beto@caragency.com",
    emailVerified: false,
    isActive: true,
  };
  state.findUnique.mockReset();
  state.findUnique.mockImplementation(async () => state.user);
  state.logCreate.mockClear();
  state.sendVerificationEmail.mockClear();
  process.env.BETTER_AUTH_URL = "http://localhost:3000";
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.RESEND_FROM_EMAIL = "onboarding@resend.dev";
});

describe("POST /api/users/[id]/verify-email", () => {
  it("rejects a caller that is not an admin", async () => {
    state.role = "COLLABORATOR";

    const response = await POST(postRequest("user-2"), params("user-2"));

    expect(response.status).toBe(401);
    expect(state.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("rejects a caller with no session", async () => {
    state.role = null;

    const response = await POST(postRequest("user-2"), params("user-2"));

    expect(response.status).toBe(401);
    expect(state.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("mails the address stored on the row, not one supplied by the caller", async () => {
    const response = await POST(postRequest("user-2"), params("user-2"));

    expect(response.status).toBe(200);
    expect(state.sendVerificationEmail).toHaveBeenCalledWith({
      body: {
        email: "beto@caragency.com",
        callbackURL: "http://localhost:3000/verify-email",
      },
      headers: expect.any(Headers),
    });
  });

  it("returns 404 for an unknown user", async () => {
    state.findUnique.mockImplementation(async () => null);

    const response = await POST(postRequest("nope"), params("nope"));

    expect(response.status).toBe(404);
    expect(state.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("returns 409 when the address is already verified", async () => {
    state.user = { ...state.user!, emailVerified: true };

    const response = await POST(postRequest("user-2"), params("user-2"));

    expect(response.status).toBe(409);
    expect(state.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("returns 400 for a deactivated user", async () => {
    state.user = { ...state.user!, isActive: false };

    const response = await POST(postRequest("user-2"), params("user-2"));

    expect(response.status).toBe(400);
    expect(state.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("refuses loudly when email delivery is not configured", async () => {
    delete process.env.RESEND_API_KEY;

    const response = await POST(postRequest("user-2"), params("user-2"));

    expect(response.status).toBe(503);
    expect(state.sendVerificationEmail).not.toHaveBeenCalled();
  });
});
