import type { Metadata } from "next";
import { getLocalizedHref } from "@/src/i18n/pathnames";
import type { AppLocale } from "@/src/i18n/routing";
import { routing } from "@/src/i18n/routing";
import { getSiteUrl, siteConfig } from "@/src/lib/site-config";

const OPEN_GRAPH_LOCALES: Record<AppLocale, string> = {
  en: "en_US",
  fr: "fr_FR",
};

function buildLocaleAlternates(locale: AppLocale, pathname: string) {
  const languages = Object.fromEntries(
    routing.locales.map((locale) => [
      locale,
      getLocalizedHref(locale, pathname),
    ])
  ) as Record<AppLocale, string>;

  return {
    canonical: getLocalizedHref(locale, pathname),
    languages: {
      ...languages,
      "x-default": getLocalizedHref(routing.defaultLocale, pathname),
    },
  };
}

interface PageMetadataOptions {
  description: string;
  locale: AppLocale;
  noIndex?: boolean;
  pathname: string;
  title: string;
  type?: "article" | "website";
}

export function createPageMetadata({
  description,
  locale,
  noIndex = false,
  pathname,
  title,
  type = "website",
}: PageMetadataOptions): Metadata {
  const localizedPath = getLocalizedHref(locale, pathname);
  const imagePath = "/social-image";

  return {
    title,
    description,
    alternates: buildLocaleAlternates(locale, pathname),
    metadataBase: new URL(siteConfig.url),
    openGraph: {
      description,
      images: [
        {
          alt: siteConfig.ogImageAlt,
          height: 630,
          url: getSiteUrl(imagePath),
          width: 1200,
        },
      ],
      locale: OPEN_GRAPH_LOCALES[locale],
      siteName: siteConfig.name,
      title,
      type,
      url: getSiteUrl(localizedPath),
    },
    robots: noIndex
      ? {
          follow: true,
          googleBot: {
            follow: true,
            index: false,
            noimageindex: false,
          },
          index: false,
        }
      : {
          follow: true,
          index: true,
        },
    twitter: {
      card: "summary_large_image",
      description,
      images: [getSiteUrl(imagePath)],
      title,
    },
  };
}
