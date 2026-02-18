"use client";

import { ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/src/components/ui/tooltip";

type UrlDisplayMode = "icon" | "domain" | "full";

const MAX_FULL_URL_LENGTH = 40;
const WWW_PREFIX_REGEX = /^www\./;
const PROTOCOL_REGEX = /^https?:\/\//;

const extractDomain = (url: string): string => {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(WWW_PREFIX_REGEX, "");
  } catch {
    return url;
  }
};

const truncateUrl = (url: string, maxLength: number = MAX_FULL_URL_LENGTH): string => {
  const withoutProtocol = url.replace(PROTOCOL_REGEX, "").replace(WWW_PREFIX_REGEX, "");
  if (withoutProtocol.length <= maxLength) {
    return withoutProtocol;
  }
  return `${withoutProtocol.slice(0, maxLength)}…`;
};

const stripUrl = (url: string): string =>
  url.replace(PROTOCOL_REGEX, "").replace(WWW_PREFIX_REGEX, "");

const isValidUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const getFaviconUrl = (url: string): string | undefined => {
  try {
    const parsed = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=16`;
  } catch {
    return undefined;
  }
};

export interface UrlCellProps {
  className?: string;
  displayMode?: UrlDisplayMode;
  value: unknown;
}

export function UrlCell({
  className = "",
  displayMode = "domain",
  value,
}: UrlCellProps) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground">-</span>;
  }

  const stringValue = String(value);

  if (!isValidUrl(stringValue)) {
    return (
      <span className={cn("text-muted-foreground", className)}>
        {stringValue}
      </span>
    );
  }

  if (displayMode === "icon") {
    return <UrlIconDisplay className={className} url={stringValue} />;
  }

  if (displayMode === "domain") {
    return <UrlDomainDisplay className={className} url={stringValue} />;
  }

  return <UrlFullDisplay className={className} url={stringValue} />;
}

function FaviconImg({
  alt,
  className,
  size,
  src,
}: {
  alt: string;
  className?: string;
  size: number;
  src: string;
}) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return null;
  }

  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: favicon inside link
    // biome-ignore lint/performance/noImgElement: library component, no Next.js dependency
    <img
      alt={alt}
      className={className}
      height={size}
      loading="lazy"
      onError={() => setHasError(true)}
      src={src}
      width={size}
    />
  );
}

function UrlIconDisplay({
  className,
  url,
}: {
  className: string;
  url: string;
}) {
  const faviconSrc = useMemo(() => getFaviconUrl(url), [url]);
  const [faviconFailed, setFaviconFailed] = useState(false);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            // biome-ignore lint/a11y/useAnchorContent: content injected by Base UI render prop
            <a
              aria-label={extractDomain(url)}
              className={cn(
                "inline-flex items-center justify-center rounded-md p-1",
                "text-muted-foreground transition-colors hover:text-foreground",
                "focus-visible:ring-primary/30 focus-visible:outline-none focus-visible:ring-2",
                className
              )}
              href={url}
              rel="noopener"
              target="_blank"
            />
          }
        >
          {faviconSrc && !faviconFailed ? (
            // biome-ignore lint/a11y/noNoninteractiveElementInteractions: favicon inside link
            // biome-ignore lint/performance/noImgElement: library component, no Next.js dependency
            <img
              alt={extractDomain(url)}
              className="size-4"
              height={16}
              loading="lazy"
              onError={() => setFaviconFailed(true)}
              src={faviconSrc}
              width={16}
            />
          ) : (
            <ExternalLink aria-hidden className="size-4" />
          )}
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="max-w-xs break-all text-xs">{url}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function UrlDomainDisplay({
  className,
  url,
}: {
  className: string;
  url: string;
}) {
  const domain = useMemo(() => extractDomain(url), [url]);
  const faviconSrc = useMemo(() => getFaviconUrl(url), [url]);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            // biome-ignore lint/a11y/useAnchorContent: content injected by Base UI render prop
            <a
              aria-label={domain}
              className={cn(
                "inline-flex items-center gap-1.5 truncate rounded-sm",
                "text-primary underline-offset-4 hover:underline",
                "focus-visible:ring-primary/30 focus-visible:outline-none focus-visible:ring-2",
                className
              )}
              href={url}
              rel="noopener"
              target="_blank"
            />
          }
        >
          {faviconSrc ? (
            <FaviconImg
              alt=""
              className="size-3.5 shrink-0"
              size={14}
              src={faviconSrc}
            />
          ) : null}
          <span className="truncate text-sm">{domain}</span>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="max-w-xs break-all text-xs">{url}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function UrlFullDisplay({
  className,
  url,
}: {
  className: string;
  url: string;
}) {
  const truncated = useMemo(() => truncateUrl(url), [url]);
  const isTruncated = truncated !== stripUrl(url);

  const link = (
    <a
      className={cn(
        "inline-flex items-center gap-1.5 truncate rounded-sm",
        "text-primary underline-offset-4 hover:underline",
        "focus-visible:ring-primary/30 focus-visible:outline-none focus-visible:ring-2",
        className
      )}
      href={url}
      rel="noopener"
      target="_blank"
    >
      <ExternalLink aria-hidden className="size-3 shrink-0 text-muted-foreground" />
      <span className="truncate text-sm">{truncated}</span>
    </a>
  );

  if (!isTruncated) {
    return link;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={link} />
        <TooltipContent side="top">
          <p className="max-w-xs break-all text-xs">{url}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
