import type { MetadataRoute } from "next";

import { SITE_CONFIG } from "@/data/metadata";
import { getPublicCarSlugs } from "@/lib/queries/cars";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = SITE_CONFIG.url;
  const lastModified = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified, changeFrequency: "daily", priority: 1 },
    {
      url: `${base}/autos`,
      lastModified,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${base}/contacto`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${base}/ventas`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  const slugs = await getPublicCarSlugs();
  const carRoutes: MetadataRoute.Sitemap = slugs.map((s) => ({
    url: `${base}/autos/${s.slug}`,
    lastModified: s.updatedAt,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticRoutes, ...carRoutes];
}
