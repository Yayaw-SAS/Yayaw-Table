import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { routing } from "@/src/i18n/routing";

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

  return {
    title: t("exampleTitle"),
    description: t("exampleDescription"),
    alternates: {
      canonical: locale === "fr" ? "/fr/example" : "/example",
      languages: {
        en: "/example",
        fr: "/fr/example",
      },
    },
  };
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

  const t = await getTranslations({ locale, namespace: "Common" });

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-primary border-b-2" />
            <p className="text-muted-foreground">{t("loading")}</p>
          </div>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
