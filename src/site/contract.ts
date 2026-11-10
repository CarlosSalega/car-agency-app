import type { Metadata } from "next";

/**
 * The seam between the product and the client it is deployed for.
 *
 * **Single tenant, white-label**: one deployment per dealership, and nothing in
 * the product may assume which one. Everything a visitor can recognise as "this
 * business" — the name, the phone, the address, the colours, the wording of the
 * pages — lives on the other side of this file, under `site/<client>/`.
 *
 * The type below is deliberately plain data. It is **not** a page builder: a
 * client that needs a genuinely different landing writes its own sections with
 * the shared primitives. Duplicating a section between two clients is cheaper
 * than an abstraction that has to anticipate the third one.
 */

/** A window of opening hours, in the shape schema.org wants. */
export interface OpeningHours {
  /** schema.org day names: `Monday`, `Tuesday`, … */
  days: string[];
  /** `HH:MM`, 24h. */
  opens: string;
  closes: string;
}

/**
 * The business itself. Every field here is data a person would correct with a
 * phone call, which is the test for whether it belongs: if it can change without
 * a deploy, it belongs in the database instead (inventory, inquiries, reviews).
 */
export interface SiteIdentity {
  /** The name printed everywhere: header, footer, JSON-LD, e-mail. */
  name: string;
  /** One line the business would use to describe itself. */
  description: string;
  /** How the dealership describes what it sells, for the `AutoDealer` node. */
  dealerDescription: string;
  contact: {
    /** E.164 with the leading `+`, e.g. `+5490000000000`. */
    phoneRaw: string;
    /** The same number as a visitor reads it, with spaces. */
    phoneDisplay: string;
    /** Prefilled text of the floating WhatsApp button. */
    whatsappMessage: string;
    /** Prefilled text of the "¿Necesitás asesoramiento?" links. */
    whatsappPrompt: string;
    email?: string;
  };
  address: {
    street: string;
    locality: string;
    region: string;
    country: string;
    /** The single line shown in the footer and the maps link. */
    display: string;
  };
  geo: { latitude: number; longitude: number };
  mapsUrl: string;
  hours: OpeningHours[];
  /** The same hours as a human reads them, one line per row. */
  hoursDisplay: string[];
  social: {
    instagram?: string;
  };
  /**
   * Where "Dejá tu reseña" sends a visitor: the review page of the profile this
   * client actually uses.
   *
   * Optional on purpose. A product cannot invent it, and pointing it at a guess
   * sends visitors to another business's reviews. When it is absent the call to
   * action does not render at all.
   */
  reviewUrl?: string;
  /** Who the copyright line belongs to. */
  copyrightHolder: string;
}

/**
 * The brand colours. Only tokens that are genuinely per-client — the neutral
 * ramp, spacing and type stay in `globals.css`, because a dealership choosing a
 * different accent colour is a config change and a dealership choosing a
 * different interface language is a redesign.
 */
export interface SiteTheme {
  /** Identity colour: wordmark, active indicator, accents. */
  brand: string;
  /** Text drawn on top of `brand`. */
  brandForeground: string;
}

/** The pages whose copy is per-client. Dynamic routes build their own titles. */
export type SitePageKey = "home" | "catalog";

/** Copy for the pages that do not take their text from the database. */
export interface SiteSeo {
  /** `es_AR` and friends, for `openGraph.locale`. */
  locale: string;
  pages: Record<SitePageKey, { title: string; description: string }>;
}

/** Files the client ships. Paths only: sizing classes belong to the UI. */
export interface SiteAssets {
  /** The full lockup, "GL AUTOS". */
  wordmark: { src: string; width: number; height: number };
  /** The monogram the collapsed admin rail shows. */
  mark: { src: string; width: number; height: number };
  /**
   * The hero photo: the people in front of the shop. It is a brand asset, not
   * content, so it ships with the client and not from the database.
   */
  hero: { src: string; width: number; height: number };
  /**
   * Social preview, 1200x630 (1.905:1). The declared size must be the real one:
   * WhatsApp and Facebook read `og:image:width/height` and a mismatch shows the
   * card cropped or letterboxed.
   */
  preview: { src: string; width: number; height: number };
  favicon: string;
  appleIcon: string;
}

export interface SiteDefinition {
  /** Folder name under `src/site/`, and the future value of `SITE_SLUG`. */
  id: string;
  /** Public origin, resolved from the deployment environment. */
  url: string;
  identity: SiteIdentity;
  theme: SiteTheme;
  seo: SiteSeo;
  assets: SiteAssets;
  /** Links that open the client's WhatsApp, already normalised for `wa.me`. */
  whatsapp: {
    /** Digits only, no `+`: what `wa.me` accepts. */
    digits: string;
    /** `tel:` href, built from `phoneRaw`. */
    telHref: string;
    /** Default link, with the identity's message prefilled. */
    href: string;
    /** Builds a link with a different prefilled message. */
    hrefWith(message: string): string;
  };
}

/**
 * Builds the site-wide `Metadata`: the document defaults every page inherits.
 *
 * It used to be `siteMetadata` in `src/data/metadata.ts`, which hardcoded the
 * client's name and description and shipped them to every page of every future
 * deployment.
 */
export function buildSiteMetadata(site: SiteDefinition): Metadata {
  const image = site.assets.preview;

  return {
    metadataBase: new URL(site.url),
    title: site.identity.name,
    description: site.identity.description,
    openGraph: {
      title: site.identity.name,
      description: site.identity.description,
      url: site.url,
      siteName: site.identity.name,
      images: [
        {
          url: `${site.url}${image.src}`,
          width: image.width,
          height: image.height,
          alt: site.identity.name,
        },
      ],
      locale: site.seo.locale,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: site.identity.name,
      description: site.identity.description,
      images: [`${site.url}${image.src}`],
    },
    icons: {
      icon: site.assets.favicon,
      apple: site.assets.appleIcon,
    },
    // No site-wide `alternates.canonical` on purpose: the document defaults did
    // not declare one before this refactor, and a canonical added here would
    // apply to the 404 page and to every route that does not set its own.
  };
}

/**
 * Builds the `Metadata` for a static page from the active site.
 *
 * Every public page had its own title, description, canonical and the same three
 * copies of the same strings for `openGraph` and `twitter`. That is where the
 * client name leaked into the code in four places per page, so the shape is
 * centralised here and only the words stay per-client.
 */
export function buildPageMetadata(
  site: SiteDefinition,
  page: SitePageKey,
  canonical: string,
): Metadata {
  const { title, description } = site.seo.pages[page];
  const image = site.assets.preview;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: site.identity.name,
      images: [
        {
          url: `${site.url}${image.src}`,
          width: image.width,
          height: image.height,
          alt: site.identity.name,
        },
      ],
      locale: site.seo.locale,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${site.url}${image.src}`],
    },
  };
}
