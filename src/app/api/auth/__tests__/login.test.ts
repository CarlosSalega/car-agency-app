// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/auth/login/route";

/**
 * Characterization tests for POST /api/auth/login.
 *
 * These pin the exact status codes and messages the current handler returns.
 * Two of them document behaviour the better-auth migration is expected to
 * *improve*, not preserve:
 *
 * - the 403 "cuenta desactivada" answer tells an attacker that the email
 *   exists (user enumeration), and
 * - the unknown-email path never reaches bcrypt, so it answers measurably
 *   faster than a wrong password.
 *
 * They are asserted here so the current contract is explicit and any change to
 * it is deliberate.
 */

const state = vi.hoisted(() => ({
  user: null as Record<string, unknown> | null,
  rateLimited: false,
  createSession: vi.fn(async () => "token-1"),
  logCreate: vi.fn(async () => ({})),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(async () => state.user),
    },
    log: {
      create: state.logCreate,
    },
  },
}));

vi.mock("@/lib/auth/auth", () => ({
  verifyPassword: vi.fn(async (password: string, hash: string) => {
    return (
      password === "correct-password" && hash === "hashed-correct-password"
    );
  }),
}));

vi.mock("@/lib/auth", () => ({
  createSession: state.createSession,
}));

vi.mock("@/lib/rate-limit", () => ({
  isRateLimited: vi.fn(() => state.rateLimited),
  getTimeUntilReset: vi.fn(() => 60_000),
}));

const adminUser = {
  id: "user-1",
  email: "admin@caragency.com",
  name: "Administrador",
  hashedPassword: "hashed-correct-password",
  role: "ADMIN",
  isActive: true,
};

function loginRequest(body: unknown, ip = "203.0.113.10"): NextRequest {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  state.user = { ...adminUser };
  state.rateLimited = false;
  state.createSession.mockClear();
  state.logCreate.mockClear();
});

describe("POST /api/auth/login", () => {
  it("returns 200 and the public user for valid credentials", async () => {
    const response = await POST(
      loginRequest({
        email: "admin@caragency.com",
        password: "correct-password",
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      success: true,
      user: {
        id: "user-1",
        email: "admin@caragency.com",
        role: "ADMIN",
      },
    });
    expect(state.createSession).toHaveBeenCalledWith("user-1");
  });

  it("never leaks the password hash in the response", async () => {
    const response = await POST(
      loginRequest({
        email: "admin@caragency.com",
        password: "correct-password",
      }),
    );

    expect(JSON.stringify(await response.json())).not.toContain(
      "hashedPassword",
    );
  });

  it("records a LOGIN audit row", async () => {
    await POST(
      loginRequest({
        email: "admin@caragency.com",
        password: "correct-password",
      }),
    );

    expect(state.logCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "LOGIN", entity: "User" }),
      }),
    );
  });

  it("returns 401 for a wrong password and creates no session", async () => {
    const response = await POST(
      loginRequest({
        email: "admin@caragency.com",
        password: "wrong-password",
      }),
    );

    expect(response.status).toBe(401);
    expect((await response.json()).error).toBe(
      "Email o contraseña incorrectos",
    );
    expect(state.createSession).not.toHaveBeenCalled();
  });

  it("returns 401 for an unknown email", async () => {
    state.user = null;

    const response = await POST(
      loginRequest({ email: "nobody@caragency.com", password: "whatever" }),
    );

    expect(response.status).toBe(401);
    expect((await response.json()).error).toBe(
      "Email o contraseña incorrectos",
    );
  });

  it("returns 403 for a deactivated account", async () => {
    state.user = { ...adminUser, isActive: false };

    const response = await POST(
      loginRequest({
        email: "admin@caragency.com",
        password: "correct-password",
      }),
    );

    expect(response.status).toBe(403);
    expect((await response.json()).error).toContain("desactivada");
  });

  it("returns 429 once the rate limit is hit", async () => {
    state.rateLimited = true;

    const response = await POST(
      loginRequest({
        email: "admin@caragency.com",
        password: "correct-password",
      }),
    );

    expect(response.status).toBe(429);
    expect((await response.json()).retryAfter).toBe(60_000);
    expect(state.createSession).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid email", async () => {
    const response = await POST(
      loginRequest({ email: "not-an-email", password: "correct-password" }),
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("Datos de login inválidos");
  });

  it("returns 400 for a password shorter than the current minimum of 6", async () => {
    const response = await POST(
      loginRequest({ email: "admin@caragency.com", password: "12345" }),
    );

    expect(response.status).toBe(400);
  });

  it("returns 400 for malformed JSON", async () => {
    const request = new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("Formato de datos inválido");
  });
});
