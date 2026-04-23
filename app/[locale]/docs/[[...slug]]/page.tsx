import { DocsBody, DocsDescription, DocsPage } from "fumadocs-ui/page";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import type { ComponentType, ReactNode } from "react";
import { getMDXComponents } from "@/mdx-components";
import { routing } from "@/src/i18n/routing";
import { createPageMetadata } from "@/src/lib/metadata";
import { getSiteUrl } from "@/src/lib/site-config";
import { source } from "@/src/lib/source";

/** Page data from fumadocs-mdx MDX compilation (body, full, toc are added at build time) */
interface DocsPageData {
  title?: string;
  description?: string;
  body: ComponentType<{ components?: Record<string, ComponentType<unknown>> }>;
  full?: boolean;
  toc?: { title: ReactNode; url: string; depth: number }[];
}

interface DocsRouteParams {
  locale: string;
  slug?: string[];
}

export default async function Page(props: {
  params: Promise<DocsRouteParams>;
}) {
  const params = await props.params;

  if (!hasLocale(routing.locales, params.locale)) {
    notFound();
  }

  const page = source.getPage(params.slug, params.locale);
  if (!page) {
    notFound();
  }

  const data = page.data as DocsPageData;
  const MDX = data.body;
  const slugPath = params.slug?.join("/") ?? "";
  const pathname = `/docs${slugPath ? `/${slugPath}` : ""}`;
  const currentPath = params.locale === "fr" ? `/fr${pathname}` : pathname;
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        item: getSiteUrl(params.locale === "fr" ? "/fr" : "/"),
        name: params.locale === "fr" ? "Accueil" : "Home",
        position: 1,
      },
      {
        "@type": "ListItem",
        item: getSiteUrl(params.locale === "fr" ? "/fr/docs" : "/docs"),
        name: "Docs",
        position: 2,
      },
      {
        "@type": "ListItem",
        item: getSiteUrl(currentPath),
        name: data.title ?? "Docs",
        position: 3,
      },
    ],
  };

  return (
    <DocsPage full={data.full} toc={data.toc}>
      <script type="application/ld+json">
        {JSON.stringify(breadcrumbSchema)}
      </script>
      <DocsDescription>{data.description}</DocsDescription>
      <DocsBody>
        <MDX
          components={
            getMDXComponents() as Record<string, ComponentType<unknown>>
          }
        />
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  return source.generateParams("slug", "locale");
}

export async function generateMetadata(props: {
  params: Promise<DocsRouteParams>;
}) {
  const params = await props.params;

  if (!hasLocale(routing.locales, params.locale)) {
    notFound();
  }

  const page = source.getPage(params.slug, params.locale);
  if (!page) {
    notFound();
  }

  const slugPath = params.slug?.join("/") ?? "";
  const pathname = `/docs${slugPath ? `/${slugPath}` : ""}`;

  return createPageMetadata({
    description: page.data.description ?? "YaYaw Table documentation",
    locale: params.locale as (typeof routing.locales)[number],
    pathname,
    title: page.data.title ?? "Docs",
    type: "article",
  });
}
