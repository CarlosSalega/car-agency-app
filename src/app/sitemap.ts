import type { MetadataRoute } from "next";

import { activeSite } from "@/site/active";
import { getPublicCarSlugs } from "@/lib/queries/cars";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = activeSite.url;
  const lastModified = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified, changeFrequency: "daily", priority: 1 },
    {
      url: `${base}/catalogo`,
      lastModified,
      changeFrequency: "daily",
      priority: 0.9,
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
