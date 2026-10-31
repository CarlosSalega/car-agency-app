import { describe, expect, it, vi } from "vitest";

import type { SendEmailInput } from "@/lib/email/send";

import {
  LEAD_NOTIFICATION_ENV,
  leadNotificationRecipient,
  notifyNewLead,
} from "../notify";

const lead = {
  name: "Ana Pérez",
  phone: "342 577 7646",
  email: "ana@ejemplo.com",
  message: "¿Está disponible?",
  carTitle: "Volkswagen Taos 2025",
  carSlug: "volkswagen-taos-2025",
};

function harness(
  options: {
    recipient?: string | undefined;
    configured?: boolean;
    result?:
      | { ok: true; id: string }
      | { ok: false; reason: "provider_error"; message: string };
    throws?: boolean;
  } = {},
) {
  const sent: SendEmailInput[] = [];
  const send = vi.fn(async (input: SendEmailInput) => {
    if (options.throws) throw new Error("boom");
    sent.push(input);
    return options.result ?? { ok: true as const, id: "mail-1" };
  });

  return {
    sent,
    deps: {
      sendEmail: send,
      isEmailConfigured: () => options.configured ?? true,
      recipient:
        "recipient" in options ? options.recipient : "avisos@glautos.ar",
      now: () => new Date("2026-10-31T13:30:00Z"),
    },
  };
}

describe("leadNotificationRecipient", () => {
  it("reads the configured inbox", () => {
    expect(
      leadNotificationRecipient({
        [LEAD_NOTIFICATION_ENV]: "avisos@glautos.ar",
      }),
    ).toBe("avisos@glautos.ar");
  });

  it("treats a blank value as unconfigured instead of passing it to the provider", () => {
    expect(
      leadNotificationRecipient({ [LEAD_NOTIFICATION_ENV]: "   " }),
    ).toBeUndefined();
    expect(leadNotificationRecipient({})).toBeUndefined();
  });
});

describe("notifyNewLead", () => {
  it("sends to the configured inbox with the car in the subject", async () => {
    const { deps, sent } = harness();

    const result = await notifyNewLead(lead, deps);

    expect(result).toEqual({ sent: true });
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("avisos@glautos.ar");
    expect(sent[0].subject).toContain("Volkswagen Taos 2025");
  });

  it("offers a WhatsApp reply with digits only", async () => {
    const { deps, sent } = harness();

    await notifyNewLead(lead, deps);

    expect(sent[0].html).toContain("https://wa.me/3425777646");
    expect(sent[0].text).toContain("https://wa.me/3425777646");
  });

  it("links to the public car page and the panel", async () => {
    const { deps, sent } = harness();

    await notifyNewLead(lead, deps);

    expect(sent[0].html).toContain("/autos/volkswagen-taos-2025");
    expect(sent[0].html).toContain("/admin/leads");
  });

  it("does not turn visitor text into markup", async () => {
    const { deps, sent } = harness();

    await notifyNewLead(
      {
        ...lead,
        name: '<script>alert("x")</script>',
        message: "<b>hola</b> & chau",
      },
      deps,
    );

    expect(sent[0].html).not.toContain("<script>");
    expect(sent[0].html).toContain("&lt;script&gt;");
    expect(sent[0].html).toContain("&amp; chau");
    // The plain-text part is not markup, so it keeps the text as typed.
    expect(sent[0].text).toContain("<b>hola</b> & chau");
  });

  it("keeps the subject on one line", async () => {
    const { deps, sent } = harness();

    await notifyNewLead(
      { ...lead, carTitle: "Taos\r\nBcc: alguien@ejemplo.com" },
      deps,
    );

    expect(sent[0].subject).not.toMatch(/[\r\n]/);
  });

  it("skips without calling the provider when no inbox is configured", async () => {
    const { deps, sent } = harness({ recipient: undefined });

    const result = await notifyNewLead(lead, deps);

    expect(result).toEqual({ sent: false, reason: "no_recipient" });
    expect(sent).toHaveLength(0);
  });

  it("skips when the mail provider itself is unconfigured", async () => {
    const { deps, sent } = harness({ configured: false });

    expect(await notifyNewLead(lead, deps)).toEqual({
      sent: false,
      reason: "mail_not_configured",
    });
    expect(sent).toHaveLength(0);
  });

  it("reports a provider rejection without throwing", async () => {
    const { deps } = harness({
      result: { ok: false, reason: "provider_error", message: "rate limited" },
    });

    const result = await notifyNewLead(lead, deps);

    expect(result).toEqual({
      sent: false,
      reason: "provider_error",
      message: "rate limited",
    });
  });

  it("survives a provider that throws, because the lead is already saved", async () => {
    const { deps } = harness({ throws: true });

    await expect(notifyNewLead(lead, deps)).resolves.toEqual({
      sent: false,
      reason: "provider_error",
      message: "boom",
    });
  });
});
