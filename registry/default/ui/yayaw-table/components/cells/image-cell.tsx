"use client";

import { ImageIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { resolveImageSource } from "../../utils/image-source";

interface ImageCellProps {
  alt?: string;
  className?: string;
  fallbackLabel?: string;
  value: unknown;
}

export function ImageCell({
  alt,
  className,
  fallbackLabel,
  value,
}: ImageCellProps) {
  const [hasError, setHasError] = useState(false);
  const source = hasError ? undefined : resolveImageSource(value);
  const label = alt || fallbackLabel || "Image";

  if (!source) {
    return (
      <div
        className={cn(
          "flex h-10 w-14 items-center justify-center rounded-md border bg-muted text-muted-foreground",
          className
        )}
      >
        <ImageIcon aria-hidden className="h-4 w-4" />
        <span className="sr-only">{label}</span>
      </div>
    );
  }

  return (
    // biome-ignore lint/performance/noImgElement: registry consumers should not need Next.js image domain configuration.
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: onError swaps broken media to the non-interactive fallback.
    <img
      alt={label}
      className={cn(
        "h-10 w-14 rounded-md border bg-muted object-cover",
        className
      )}
      height={40}
      loading="lazy"
      onError={() => setHasError(true)}
      src={source}
      width={56}
    />
  );
}
