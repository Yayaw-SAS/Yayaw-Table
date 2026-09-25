"use client";

import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { tagAppearance, tagSwatchColor } from "../../utils/tag-colors";
import "../../utils/tag-colors.css";

/** Attributes that color an element like a table tag: its own color, else its id's hue. */
export function tagChipProps({
  color,
  coloredTags = true,
  id,
}: {
  color?: string;
  coloredTags?: boolean;
  id: string;
}) {
  const appearance = tagAppearance(id, coloredTags, undefined, color);
  return {
    className: cn("yayaw-tag", appearance.className),
    "data-colored": appearance.colored,
    "data-custom-color": appearance.className ? "" : undefined,
    style: appearance.style as CSSProperties | undefined,
  };
}

/** A tag as the table shows it: its name on its color. */
export function TagChip({
  children,
  className,
  color,
  coloredTags,
  id,
  name,
}: {
  children?: ReactNode;
  className?: string;
  color?: string;
  coloredTags?: boolean;
  id: string;
  name: string;
}) {
  const chip = tagChipProps({ color, coloredTags, id });
  return (
    <span
      {...chip}
      className={cn(
        chip.className,
        "inline-flex min-w-0 max-w-full items-center gap-1 rounded-md px-2 py-0.5 text-xs",
        className
      )}
      data-tag-id={id}
    >
      <span className="truncate">{name}</span>
      {children}
    </span>
  );
}

/** A small dot in a tag's color (filters, the color picker). */
export function TagSwatch({
  className,
  color,
  coloredTags,
  id,
}: {
  className?: string;
  color?: string;
  coloredTags?: boolean;
  id: string;
}) {
  const swatch = tagSwatchColor(id, coloredTags, color);
  if (!swatch) {
    return null;
  }
  return (
    <span
      aria-hidden="true"
      className={cn("yayaw-tag-swatch", className)}
      style={{ "--yayaw-tag-color": swatch } as CSSProperties}
    />
  );
}
