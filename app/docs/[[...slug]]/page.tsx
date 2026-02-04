import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/page";
import { notFound } from "next/navigation";
import type { ComponentType, ReactNode } from "react";
import { getMDXComponents } from "@/mdx-components";
import { source } from "@/src/lib/source";

/** Page data from fumadocs-mdx MDX compilation (body, full, toc are added at build time) */
interface DocsPageData {
  title?: string;
  description?: string;
  body: ComponentType<{ components?: Record<string, ComponentType<unknown>> }>;
  full?: boolean;
  toc?: { title: ReactNode; url: string; depth: number }[];
}

export default async function Page(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const page = source.getPage(params.slug);
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
  return source.generateParams();
}

export async function generateMetadata(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) {
    notFound();
  }

  return {
    title: page.data.title,
    description: page.data.description,
  };
}
