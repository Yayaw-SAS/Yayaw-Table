import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { SiteHeader } from "@/src/components/site/site-header";
import { Toaster } from "@/src/components/ui/sonner";
import { type AppLocale, routing } from "@/src/i18n/routing";
import { createPageMetadata } from "@/src/lib/metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const t = await getTranslations({ locale, namespace: "Metadata" });
  const currentLocale = locale as AppLocale;

  return createPageMetadata({
    description: t("exampleDescription"),
    locale: currentLocale,
    noIndex: true,
    pathname: "/example",
    title: t("exampleTitle"),
  });
}

export default async function ExampleLayout({
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

  const currentLocale = locale as AppLocale;
  const common = await getTranslations({ locale, namespace: "Common" });
  const nav = await getTranslations({ locale, namespace: "Nav" });
  const allMessages = (await import(`../../../messages/${locale}.json`))
    .default as Record<string, unknown>;

  return (
    <>
      <SiteHeader
        installCommand={common("installCommand")}
        labels={{
          brand: nav("brand"),
          closeMenu: nav("closeMenu"),
          copied: common("copied"),
          copiedInstallCommand: common("copiedInstallCommand"),
          copy: common("copy"),
          docs: nav("docs"),
          example: nav("example"),
          install: nav("install"),
          language: nav("language"),
          openMenu: nav("openMenu"),
        }}
        locale={currentLocale}
      />
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center bg-background">
            <div className="text-center">
              <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-primary border-b-2" />
              <p className="text-muted-foreground">{common("loading")}</p>
            </div>
          </div>
        }
      >
        <NextIntlClientProvider messages={{ Example: allMessages.Example }}>
          <NuqsAdapter>
            {children}
            <Toaster />
          </NuqsAdapter>
        </NextIntlClientProvider>
      </Suspense>
    </>
  );
}
