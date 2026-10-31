import { Metadata } from "next";
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000");
export const SITE_CONFIG = {
  name: "GL Autos",
  description: "Vení y encontrá el auto de tus sueños.",
  url: SITE_URL,
  previewPath: "/preview.webp",
  locale: "es_AR",
  imageConfig: {
    preview: {
      large: {
        width: 1200,
        height: 630,
      },
      square: {
        width: 1200,
        height: 1200,
      },
    },
  },
} as const;

export const siteMetadata: Metadata = {
  metadataBase: new URL(SITE_CONFIG.url),
  title: SITE_CONFIG.name,
  description: SITE_CONFIG.description,
  openGraph: {
    title: SITE_CONFIG.name,
    description: SITE_CONFIG.description,
    url: SITE_CONFIG.url,
    siteName: SITE_CONFIG.name,
    images: [
      {
        url: `${SITE_CONFIG.url}${SITE_CONFIG.previewPath}`,
        width: SITE_CONFIG.imageConfig.preview.large.width,
        height: SITE_CONFIG.imageConfig.preview.large.height,
        alt: SITE_CONFIG.name,
      },
    ],
    locale: SITE_CONFIG.locale,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_CONFIG.name,
    description: SITE_CONFIG.description,
    images: [`${SITE_CONFIG.url}${SITE_CONFIG.previewPath}`],
  },
};
