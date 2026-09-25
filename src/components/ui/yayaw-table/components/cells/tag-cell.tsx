/**
 * Tag cell component for data tables
 * Shows tag values with different colors based on the value
 */
"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/src/components/ui/badge";

import { tagAppearance } from "../../utils/tag-colors";
import "../../utils/tag-colors.css";

function unwrapTagValue(value: unknown): unknown {
  if (value && typeof value === "object" && "set" in value) {
    return (value as { set: unknown }).set;
  }

  return value;
}

function toTagValue(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const tagValue = String(value).trim();
  return tagValue ? tagValue : null;
}

function toTagValues(value: unknown): string[] {
  const processedValue = unwrapTagValue(value);
  const seen = new Set<string>();
  const tagValues = Array.isArray(processedValue)
    ? processedValue
        .map(toTagValue)
        .filter((tagValue): tagValue is string => tagValue !== null)
    : [toTagValue(processedValue)].filter(
        (tagValue): tagValue is string => tagValue !== null
      );

  const uniqueTagValues: string[] = [];
  for (const tagValue of tagValues) {
    if (seen.has(tagValue)) {
      continue;
    }
    seen.add(tagValue);
    uniqueTagValues.push(tagValue);
  }

  return uniqueTagValues;
}

export interface TagCellProps {
  coloredTags?: boolean;
  colorValue?: string;
  /** The tag's own color (a palette name or a CSS color), e.g. a catalog tag's. */
  color?: string;
  /**
   * Optional CSS class name
   */
  className?: string;

  /**
   * Optional map of tag value → Tailwind color class (e.g. "bg-red-500/80 text-white dark:bg-red-600/90").
   * When provided, matching values use this class; others use the deterministic hash.
   * Lookup tries the raw value then the normalized (trim + lowerCase) value.
   */
  tagColorMap?: Record<string, string>;

  /**
   * The tag value to display
   */
  value: unknown;
}

/**
 * Cell component for displaying tag values with colored backgrounds.
 * Color is derived deterministically from the tag value (same value = same color across sessions).
 */
export function TagCell({
  className = "",
  tagColorMap,
  value,
  coloredTags = true,
  colorValue,
  color,
}: TagCellProps) {
  const tagValues = toTagValues(value);

  if (tagValues.length === 0) {
    return <span className="text-muted-foreground">-</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {tagValues.map((tagValue) => {
        const appearance = tagAppearance(
          colorValue ?? tagValue,
          coloredTags,
          tagColorMap,
          color
        );
        return (
          <Badge
            className={cn(
              "yayaw-tag inline-flex items-center rounded-md px-2 py-0.5 text-xs",
              appearance.className,
              className
            )}
            data-colored={appearance.colored}
            data-custom-color={appearance.className ? "" : undefined}
            key={tagValue}
            style={appearance.style}
          >
            {tagValue}
          </Badge>
        );
      })}
    </div>
  );
}
