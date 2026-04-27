import "@/app/global.css";
import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { PackageManagerProvider } from "@/src/components/site/package-manager-provider";
import { routing } from "@/src/i18n/routing";
import { createPageMetadata } from "@/src/lib/metadata";
import { siteConfig } from "@/src/lib/site-config";

const bodyFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-body-family",
});

const displayFont = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display-family",
});

const rootThemeOptions = {
  attribute: "class",
  defaultTheme: "system" as const,
  disableTransitionOnChange: true,
  enableSystem: true,
} as const;

export const dynamic = "force-static";
export const dynamicParams = false;
export const revalidate = 3600;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = (await import(`../../messages/${locale}.json`)).default;

  return (
    <html
      className={`${bodyFont.variable} ${displayFont.variable}`}
      lang={locale}
      suppressHydrationWarning
    >
      <body className="flex min-h-screen flex-col font-sans text-foreground antialiased">
        <RootProvider theme={rootThemeOptions}>
          <NextIntlClientProvider messages={messages}>
            <PackageManagerProvider>{children}</PackageManagerProvider>
          </NextIntlClientProvider>
        </RootProvider>
      </body>
    </html>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const t = await getTranslations({ locale, namespace: "Metadata" });
  const currentLocale = locale as (typeof routing.locales)[number];
  const metadata = createPageMetadata({
    description: t("siteDescription"),
    locale: currentLocale,
    pathname: "/",
    title: t("siteTitle"),
  });

  return {
    ...metadata,
    applicationName: siteConfig.name,
    creator: "Yannis",
    keywords: [
      "react data table",
      "shadcn ui table",
      "tanstack table",
      "next.js data table",
      "react table component",
      "open source table",
    ],
    metadataBase: new URL(siteConfig.url),
    referrer: "origin-when-cross-origin",
    title: {
      default: t("siteTitle"),
      template: `%s | ${t("siteTitle")}`,
    },
    icons: {
      icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
      apple: [{ url: "/apple-touch-icon.png" }],
    },
    manifest: "/manifest.webmanifest",
  };
}
