import type {
  SiteAssets,
  SiteDefinition,
  SiteIdentity,
  SiteSeo,
  SiteTheme,
} from "./contract";
import { envOverride, resolveSiteUrl, toWaDigits } from "./deployment";

/**
 * A client's own parts, before the deployment layer is applied.
 *
 * `site/<client>/index.ts` exports one of these. It holds no environment logic:
 * everything here is the same on a laptop and in production.
 */
export interface SiteClient {
  id: string;
  identity: SiteIdentity;
  theme: SiteTheme;
  seo: SiteSeo;
  assets: SiteAssets;
}

/**
 * Combines a client with the deployment it runs in.
 *
 * This is the only place where the two meet, which is what lets a test build a
 * fake client (`__tests__`) and assert that no real client data leaks into the
 * product.
 */
export function composeSite(client: SiteClient): SiteDefinition {
  const digits = toWaDigits(
    envOverride("NEXT_PUBLIC_WHATSAPP_PHONE") ??
      client.identity.contact.phoneRaw,
  );

  const hrefWith = (message: string) =>
    `https://api.whatsapp.com/send?phone=${digits}&text=${encodeURIComponent(message)}`;

  return {
    id: client.id,
    url: resolveSiteUrl(),
    identity: {
      ...client.identity,
      social: {
        ...client.identity.social,
        instagram:
          envOverride("NEXT_PUBLIC_INSTAGRAM_URL") ??
          client.identity.social.instagram,
      },
      mapsUrl: envOverride("NEXT_PUBLIC_MAPS_URL") ?? client.identity.mapsUrl,
    },
    theme: client.theme,
    seo: client.seo,
    assets: client.assets,
    whatsapp: {
      digits,
      // Built from the identity, not from the override: this is the href the
      // visitor taps, and a tracking number would show a number that does not
      // match the one printed next to it.
      telHref: `tel:${client.identity.contact.phoneRaw}`,
      href: hrefWith(client.identity.contact.whatsappPrompt),
      hrefWith,
    },
  };
}
