import { SITE_CONFIG } from "@/data/metadata";
import {
  isEmailConfigured,
  sendEmail,
  type SendEmailInput,
  type SendEmailResult,
} from "@/lib/email/send";
import { leadNotificationEmail } from "@/lib/email/templates";

/**
 * Notify the dealership that an inquiry arrived.
 *
 * The rule from the feature doc is that a mail failure must never lose the lead:
 * the row is already written before this runs, and nothing here throws. A
 * misconfigured mailer costs a notification, not a customer.
 *
 * Dependencies are injectable because the alternative is a live Resend call in
 * the test suite.
 */

/** Where new inquiries are announced. Set per deployment. */
export const LEAD_NOTIFICATION_ENV = "LEAD_NOTIFICATION_EMAIL";

export function leadNotificationRecipient(
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  const value = env[LEAD_NOTIFICATION_ENV]?.trim();

  return value ? value : undefined;
}

export interface NotifyLeadInput {
  name: string;
  phone: string;
  email?: string | null;
  message?: string | null;
  carTitle?: string | null;
  carSlug?: string | null;
}

export type NotifyLeadResult =
  | { sent: true }
  | {
      sent: false;
      reason: "no_recipient" | "mail_not_configured" | "provider_error";
      message?: string;
    };

export interface NotifyLeadDeps {
  sendEmail: (input: SendEmailInput) => Promise<SendEmailResult>;
  isEmailConfigured: () => boolean;
  recipient: string | undefined;
  now: () => Date;
}

export async function notifyNewLead(
  input: NotifyLeadInput,
  deps: Partial<NotifyLeadDeps> = {},
): Promise<NotifyLeadResult> {
  const {
    sendEmail: send = sendEmail,
    isEmailConfigured: configured = isEmailConfigured,
    recipient = leadNotificationRecipient(),
    now = () => new Date(),
  } = deps;

  if (!recipient) return { sent: false, reason: "no_recipient" };
  if (!configured()) return { sent: false, reason: "mail_not_configured" };

  const message = leadNotificationEmail({
    name: input.name,
    phone: input.phone,
    email: input.email,
    message: input.message,
    carTitle: input.carTitle,
    carUrl: input.carSlug ? `${SITE_CONFIG.url}/autos/${input.carSlug}` : null,
    // T1.4 creates `/admin/leads`. Until it exists, point at the panel that does:
    // a notification linking to a 404 is worse than one linking a level up.
    adminUrl: `${SITE_CONFIG.url}/admin`,
    receivedAt: now(),
  });

  try {
    const result = await send({ to: recipient, ...message });

    return result.ok
      ? { sent: true }
      : { sent: false, reason: "provider_error", message: result.message };
  } catch (error) {
    // `sendEmail` is documented never to throw. This is the belt to that
    // suspenders, because losing a notification must not become a 500.
    return {
      sent: false,
      reason: "provider_error",
      message: error instanceof Error ? error.message : "unknown",
    };
  }
}
