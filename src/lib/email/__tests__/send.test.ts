// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Contract tests for the single outbound mail path.
 *
 * The property that matters is not "an email is sent" but "a failed send never
 * escapes as a thrown error". Every caller is an auth flow whose response must
 * stay identical whether delivery worked, the provider refused or the
 * environment is missing the key -- otherwise the difference becomes a user
 * enumeration oracle.
 */

const state = vi.hoisted(() => ({
  send: vi.fn(),
  constructedWith: [] as string[],
}));

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: state.send };

    constructor(key: string) {
      state.constructedWith.push(key);
    }
  },
}));

import { sendEmail } from "@/lib/email/send";

const message = {
  to: "admin@caragency.com",
  subject: "Restablecer tu contraseña",
  html: "<p>hola</p>",
  text: "hola",
};

beforeEach(() => {
  state.send.mockReset();
  state.constructedWith.length = 0;
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.RESEND_FROM_EMAIL = "onboarding@resend.dev";
});

describe("sendEmail", () => {
  it("sends the exact payload through Resend and reports the message id", async () => {
    state.send.mockResolvedValue({ data: { id: "email-1" }, error: null });

    await expect(sendEmail(message)).resolves.toEqual({
      ok: true,
      id: "email-1",
    });

    expect(state.send).toHaveBeenCalledWith({
      from: "onboarding@resend.dev",
      to: "admin@caragency.com",
      subject: "Restablecer tu contraseña",
      html: "<p>hola</p>",
      text: "hola",
    });
  });

  it("skips the send and reports not_configured when the key is missing", async () => {
    delete process.env.RESEND_API_KEY;

    await expect(sendEmail(message)).resolves.toMatchObject({
      ok: false,
      reason: "not_configured",
    });

    expect(state.send).not.toHaveBeenCalled();
  });

  it("skips the send and reports not_configured when the sender is missing", async () => {
    delete process.env.RESEND_FROM_EMAIL;

    await expect(sendEmail(message)).resolves.toMatchObject({
      ok: false,
      reason: "not_configured",
    });

    expect(state.send).not.toHaveBeenCalled();
  });

  it("returns provider_error instead of throwing when Resend rejects", async () => {
    state.send.mockResolvedValue({
      data: null,
      error: { name: "validation_error", message: "Invalid `to` field" },
    });

    await expect(sendEmail(message)).resolves.toEqual({
      ok: false,
      reason: "provider_error",
      message: "Invalid `to` field",
    });
  });

  it("returns provider_error instead of throwing when the client throws", async () => {
    state.send.mockRejectedValue(new Error("network down"));

    await expect(sendEmail(message)).resolves.toEqual({
      ok: false,
      reason: "provider_error",
      message: "network down",
    });
  });
});
