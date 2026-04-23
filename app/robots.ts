import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/src/lib/site-config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      allow: "/",
      disallow: ["/api/", "/r/"],
      userAgent: "*",
    },
    sitemap: getSiteUrl("/sitemap.xml"),
  };
}
