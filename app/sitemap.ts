import type { MetadataRoute } from "next";
import { getLocalizedHref } from "@/src/i18n/pathnames";
import type { AppLocale } from "@/src/i18n/routing";
import { routing } from "@/src/i18n/routing";
import { getSiteUrl } from "@/src/lib/site-config";
import { source } from "@/src/lib/source";

function createAlternates(pathname: string) {
  return {
    languages: Object.fromEntries(
      routing.locales.map((locale) => [
        locale,
        getSiteUrl(getLocalizedHref(locale, pathname)),
      ])
    ),
  };
}

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const entries: MetadataRoute.Sitemap = routing.locales.map((locale) => {
    const pathname = getLocalizedHref(locale, "/");

    return {
      alternates: createAlternates("/"),
      changeFrequency: "weekly",
      lastModified,
      priority: locale === routing.defaultLocale ? 1 : 0.9,
      url: getSiteUrl(pathname),
    };
  });

  const docEntries = source.generateParams("slug", "locale").map((params) => {
    const pathname = params.slug?.length
      ? `/docs/${params.slug.join("/")}`
      : "/docs";
    const localizedPath = getLocalizedHref(
      params.locale as AppLocale,
      pathname
    );

    return {
      alternates: createAlternates(pathname),
      changeFrequency: "weekly" as const,
      lastModified,
      priority: pathname === "/docs" ? 0.9 : 0.8,
      url: getSiteUrl(localizedPath),
    };
  });

  return [...entries, ...docEntries];
}
