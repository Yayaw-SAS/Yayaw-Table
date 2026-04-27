import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/src/i18n/routing";

const intlMiddleware = createMiddleware(routing);
const SHADCN_REGISTRY_ACCEPT = "application/vnd.shadcn.v1+json";
const SHADCN_REGISTRY_USER_AGENT = "shadcn";
const DEFAULT_REGISTRY_ITEM_PATH = "/r/yayaw-table.json";

function isShadcnRegistryRequest(request: NextRequest): boolean {
  const acceptHeader = request.headers.get("accept") ?? "";
  const userAgent = request.headers.get("user-agent") ?? "";

  return (
    acceptHeader.includes(SHADCN_REGISTRY_ACCEPT) ||
    userAgent === SHADCN_REGISTRY_USER_AGENT
  );
}

function setRegistryVaryHeader(response: NextResponse): NextResponse {
  const varyHeader = response.headers.get("Vary");

  if (!varyHeader) {
    response.headers.set("Vary", "Accept, User-Agent");
    return response;
  }

  const varyValues = new Set(
    varyHeader
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
  varyValues.add("Accept");
  varyValues.add("User-Agent");
  response.headers.set("Vary", Array.from(varyValues).join(", "));

  return response;
}

export default function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/" && isShadcnRegistryRequest(request)) {
    const registryUrl = request.nextUrl.clone();
    registryUrl.pathname = DEFAULT_REGISTRY_ITEM_PATH;

    return setRegistryVaryHeader(NextResponse.rewrite(registryUrl));
  }

  const response = intlMiddleware(request);

  if (request.nextUrl.pathname === "/") {
    return setRegistryVaryHeader(response);
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
