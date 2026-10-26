import { Resend } from "resend";

/**
 * The single outbound mail path.
 *
 * Every transactional email goes through here so the provider, the sender
 * address and the failure policy live in one place. Callers are auth flows,
 * and those have a hard rule: **a mail failure must never surface as an auth
 * error**. If the provider is down, the reset request still answers 200 with
 * the same message, because a different answer for a known address is a user
 * enumeration oracle. `sendEmail` therefore returns a result and never throws.
 *
 * Environment variables are read per call, not at module scope: module-scope
 * reads run during `next build`, where secrets are absent, and a throw there
 * would take the whole auth instance down at import time.
 */

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type SendEmailResult =
  | { ok: true; id: string }
  | {
      ok: false;
      reason: "not_configured" | "provider_error";
      message: string;
    };

let client: Resend | null = null;
let clientKey: string | undefined;

/**
 * Whether outbound mail can work at all.
 *
 * Exposed so an admin-triggered action can refuse loudly instead of claiming
 * success: the auth flows must stay silent about delivery, but an admin who
 * clicked "send verification" deserves to know the provider is unconfigured.
 */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;

  if (!key) return null;

  // Rebuild only when the key actually changed, which happens in tests that
  // swap `process.env` between cases.
  if (!client || clientKey !== key) {
    client = new Resend(key);
    clientKey = key;
  }

  return client;
}

export async function sendEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const resend = getClient();
  const from = process.env.RESEND_FROM_EMAIL;

  if (!resend || !from) {
    console.warn(
      "[EMAIL] RESEND_API_KEY or RESEND_FROM_EMAIL is missing; skipped:",
      input.subject,
    );

    return {
      ok: false,
      reason: "not_configured",
      message: "Email delivery is not configured",
    };
  }

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });

    if (error) {
      console.error(
        "[EMAIL] Resend rejected the message:",
        error.name,
        error.message,
      );

      return { ok: false, reason: "provider_error", message: error.message };
    }

    return { ok: true, id: data?.id ?? "" };
  } catch (error) {
    console.error("[EMAIL] Send failed:", error);

    return {
      ok: false,
      reason: "provider_error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
