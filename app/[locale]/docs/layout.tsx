import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { baseOptions } from "@/app/layout.config";
import { routing } from "@/src/i18n/routing";
import { source } from "@/src/lib/source";

export default async function Layout({
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

  const t = await getTranslations({ locale, namespace: "Nav" });
  const prefix = locale === "fr" ? "/fr" : "";

  const links: BaseLayoutProps["links"] = [
    { text: t("home"), type: "main", url: `${prefix}/` },
    { text: t("useCases"), type: "main", url: `${prefix}/#use-cases` },
    { text: t("product"), type: "main", url: `${prefix}/#product` },
    { text: t("docs"), type: "main", url: `${prefix}/docs` },
    { text: t("example"), type: "main", url: `${prefix}/example` },
    { text: t("install"), type: "button", url: `${prefix}/docs/installation` },
  ] as const;

  return (
    <DocsLayout
      {...baseOptions}
      links={links}
      tree={source.getPageTree(locale)}
    >
      {children}
    </DocsLayout>
  );
}
