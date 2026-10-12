"use client";

import { ImageIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  type AvatarShape,
  avatarInitials,
} from "../../utils/initials-avatar";
import { resolveImageSource } from "../../utils/image-source";
import { InitialsAvatar } from "./initials-avatar";

interface ImageCellProps {
  alt?: string;
  /**
   * Without an image, initials of this name (with a stable color) replace
   * the image placeholder. Set by the column's `avatar` option.
   */
  avatarName?: string;
  avatarShape?: AvatarShape;
  className?: string;
  fallbackLabel?: string;
  value: unknown;
}

export function ImageCell({
  alt,
  avatarName,
  avatarShape,
  className,
  fallbackLabel,
  value,
}: ImageCellProps) {
  const [failedSource, setFailedSource] = useState<string>();
  const resolvedSource = resolveImageSource(value);
  const source = failedSource === resolvedSource ? undefined : resolvedSource;
  const label = alt || fallbackLabel || "Image";

  // A name without letters keeps the image placeholder.
  if (!source && avatarName && avatarInitials(avatarName)) {
    return (
      <InitialsAvatar
        className={className}
        name={avatarName}
        shape={avatarShape}
        size="cell"
      />
    );
  }

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
      onError={() => setFailedSource(resolvedSource)}
      src={source}
      width={56}
    />
  );
}
