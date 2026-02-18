import { type NextRequest, NextResponse } from "next/server";

interface UrlMeta {
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
  siteName?: string;
  url: string;
}

const FETCH_TIMEOUT_MS = 5000;
const MAX_HTML_BYTES = 100_000;

const TITLE_REGEX = /<title[^>]*>([^<]+)<\/title>/i;
const FAVICON_PATTERNS = [
  /<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i,
  /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut )?icon["']/i,
] as const;

const extractMetaContent = (
  html: string,
  property: string
): string | undefined => {
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`,
      "i"
    ),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return undefined;
};

const extractTitle = (html: string): string | undefined => {
  const match = html.match(TITLE_REGEX);
  return match?.[1]?.trim();
};

const extractFavicon = (html: string, baseUrl: string): string | undefined => {
  for (const pattern of FAVICON_PATTERNS) {
    const match = html.match(pattern);
    if (match?.[1]) {
      try {
        return new URL(match[1], baseUrl).href;
      } catch {
        return match[1];
      }
    }
  }

  try {
    return `${new URL(baseUrl).origin}/favicon.ico`;
  } catch {
    return undefined;
  }
};

const resolveImageUrl = (
  imageUrl: string | undefined,
  baseUrl: string
): string | undefined => {
  if (!imageUrl) {
    return undefined;
  }
  try {
    return new URL(imageUrl, baseUrl).href;
  } catch {
    return imageUrl;
  }
};

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const targetUrl = searchParams.get("url");

  if (!targetUrl) {
    return NextResponse.json(
      { error: "Missing url parameter" },
      { status: 400 }
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return NextResponse.json(
        { error: "Invalid URL protocol" },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(parsedUrl.href, {
      signal: controller.signal,
      headers: {
        "User-Agent": "YayawTable-MetaFetcher/1.0",
        Accept: "text/html",
      },
      redirect: "follow",
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch: ${response.status}` },
        { status: 502 }
      );
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      const meta: UrlMeta = {
        url: parsedUrl.href,
        favicon: `${parsedUrl.origin}/favicon.ico`,
      };
      return NextResponse.json(meta, {
        headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" },
      });
    }

    const buffer = await response.arrayBuffer();
    const html = new TextDecoder("utf-8").decode(
      buffer.slice(0, MAX_HTML_BYTES)
    );

    const ogTitle = extractMetaContent(html, "og:title");
    const ogDescription = extractMetaContent(html, "og:description");
    const ogImage = extractMetaContent(html, "og:image");
    const ogSiteName = extractMetaContent(html, "og:site_name");
    const twitterImage = extractMetaContent(html, "twitter:image");
    const metaDescription = extractMetaContent(html, "description");
    const htmlTitle = extractTitle(html);

    const meta: UrlMeta = {
      title: ogTitle || htmlTitle,
      description: ogDescription || metaDescription,
      image: resolveImageUrl(ogImage || twitterImage, parsedUrl.href),
      favicon: extractFavicon(html, parsedUrl.href),
      siteName: ogSiteName,
      url: parsedUrl.href,
    };

    return NextResponse.json(meta, {
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return NextResponse.json({ error: "Request timeout" }, { status: 504 });
    }
    return NextResponse.json({ error: "Failed to fetch URL" }, { status: 502 });
  }
}
