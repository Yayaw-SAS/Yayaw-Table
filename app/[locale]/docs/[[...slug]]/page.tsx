import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/page";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import type { ComponentType, ReactNode } from "react";
import { getMDXComponents } from "@/mdx-components";
import { routing } from "@/src/i18n/routing";
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

  return (
    <DocsPage full={data.full} toc={data.toc}>
      <DocsTitle>{data.title}</DocsTitle>
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
  const enPath = `/docs${slugPath ? `/${slugPath}` : ""}`;
  const frPath = `/fr/docs${slugPath ? `/${slugPath}` : ""}`;

  return {
    title: page.data.title,
    description: page.data.description,
    alternates: {
      canonical: params.locale === "fr" ? frPath : enPath,
      languages: {
        en: enPath,
        fr: frPath,
      },
    },
  };
}
