import "@/app/global.css";
import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { routing } from "@/src/i18n/routing";

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

  return (
    <html
      className={`${bodyFont.variable} ${displayFont.variable}`}
      lang={locale}
      suppressHydrationWarning
    >
      <body className="flex min-h-screen flex-col font-sans text-foreground antialiased">
        <RootProvider theme={rootThemeOptions}>{children}</RootProvider>
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

  return {
    title: {
      default: t("siteTitle"),
      template: `%s | ${t("siteTitle")}`,
    },
    description: t("siteDescription"),
    icons: {
      icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
      apple: [{ url: "/apple-touch-icon.png" }],
    },
    alternates: {
      languages: {
        en: "/",
        fr: "/fr",
      },
    },
  };
}
