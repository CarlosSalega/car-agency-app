/**
 * What the *deployment* knows, as opposed to what the *client* is.
 *
 * The split matters for a resold product: the origin and the override knobs are
 * per-deployment facts that change between a local checkout, a preview and
 * production, while the phone number and the address are facts about the
 * business. They used to be mixed in `src/data/metadata.ts` and in three
 * components that each read `process.env` on their own line.
 *
 * The overrides are kept, with the same precedence the app already used
 * (`env ?? identity`), so this refactor changes no behaviour. They exist because
 * a deployment may need to point at a tracking number that is not the published
 * one — an operational decision, not a brand one.
 */

const LOCAL_ORIGIN = "http://localhost:3000";

/**
 * The public origin, with no trailing slash.
 *
 * `NEXT_PUBLIC_SITE_URL` wins; on Vercel the deployment URL is the fallback, so a
 * preview does not advertise the production domain in its canonical tags.
 */
export function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;

  return LOCAL_ORIGIN;
}

/** Digits only, because `wa.me` rejects the `+` the identity stores. */
export function toWaDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * Reads an override, treating an empty string as "not set".
 *
 * `.env.example` ships every knob with a value; a key emptied on purpose must not
 * produce an `href=""` that silently kills the button.
 */
export function envOverride(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}
