import type { MetadataRoute } from "next";

import { activeSite } from "@/site/active";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/api/"],
      },
    ],
    sitemap: `${activeSite.url}/sitemap.xml`,
  };
}
