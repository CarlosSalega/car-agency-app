import { LeadStatus } from "@generated/prisma/enums";
import { z } from "zod";

/**
 * Validation for the public inquiry form, and for the staff-side status change.
 *
 * These messages are shown to the visitor, so they are Spanish like the rest of
 * the UI. The code around them stays English.
 *
 * The submit schema takes `carSlug`, not the internal `carId`: the page already
 * knows the slug, there is no reason to publish row identifiers into the DOM,
 * and resolving the slug server-side is also how the related seller gets
 * attached without the client claiming it.
 */

const MAX_MESSAGE = 1000;
const MAX_NAME = 80;
const MAX_PHONE = 25;
const MIN_PHONE_DIGITS = 6;

const trimmed = (value: unknown) =>
  typeof value === "string" ? value.trim() : value;

/** Empty strings arrive from uncontrolled inputs; treat them as absent. */
const optionalText = (max: number, message: string) =>
  z.preprocess((value) => {
    const clean = trimmed(value);
    return clean === "" ? undefined : clean;
  }, z.string().max(max, message).optional());

export const leadSubmitSchema = z.object({
  name: z.preprocess(
    trimmed,
    z
      .string()
      .min(2, "Decinos tu nombre")
      .max(MAX_NAME, "El nombre es demasiado largo"),
  ),
  phone: z.preprocess(
    trimmed,
    z
      .string()
      .min(MIN_PHONE_DIGITS, "Dejanos un teléfono para contactarte")
      .max(MAX_PHONE, "El teléfono es demasiado largo")
      // Argentines write numbers as "(0342) 577-7646" or "+54 9 342 5777646".
      // Counting digits instead of characters accepts every real format and
      // still rejects "no tengo".
      .refine(
        (value) => (value.match(/\d/g) ?? []).length >= MIN_PHONE_DIGITS,
        "El teléfono debe tener al menos 6 dígitos",
      ),
  ),
  email: z.preprocess((value) => {
    const clean = trimmed(value);
    return clean === "" ? undefined : clean;
  }, z.string().email("Revisá el email").optional()),
  message: optionalText(MAX_MESSAGE, "El mensaje es demasiado largo"),
  carSlug: z.preprocess((value) => {
    const clean = trimmed(value);
    return clean === "" ? undefined : clean;
  }, z.string().max(200).optional()),
  // Consent is a checkbox, so the literal `true` is what a checked box sends.
  // The timestamp is recorded by the route from the server clock, never by the
  // client.
  consent: z.literal(true, {
    message: "Necesitamos tu permiso para contactarte",
  }),
});

export type LeadSubmitInput = z.infer<typeof leadSubmitSchema>;

/**
 * Honeypot. Rendered off-screen, so a person never fills it and a naive bot
 * always does. Kept out of `leadSubmitSchema` because a filled honeypot must
 * answer as success, not as a validation error that teaches the bot.
 */
export const LEAD_HONEYPOT_FIELD = "company";

export const leadStatusSchema = z.nativeEnum(LeadStatus);

export const leadStatusUpdateSchema = z.object({
  status: leadStatusSchema,
  notes: optionalText(2000, "La nota es demasiado larga"),
});

export type LeadStatusUpdateInput = z.infer<typeof leadStatusUpdateSchema>;
