/**
 * Tag cell component for data tables
 * Shows tag values with different colors based on the value
 */
"use client";

import { Badge } from "@/src/components/ui/badge";
import { cn } from "@/lib/utils";

// Define color palette with distinct colors that work well in both light and dark modes
interface TagColor {
  className: string;
  name: string;
}

const TAG_COLORS: TagColor[] = [
  { className: "bg-blue-500/80 text-white dark:bg-blue-600/90", name: "Blue" },
  {
    className: "bg-green-500/80 text-white dark:bg-green-600/90",
    name: "Green",
  },
  {
    className: "bg-amber-500/80 text-white dark:bg-amber-600/90",
    name: "Amber",
  },
  { className: "bg-red-500/80 text-white dark:bg-red-600/90", name: "Red" },
  {
    className: "bg-purple-500/80 text-white dark:bg-purple-600/90",
    name: "Purple",
  },
  { className: "bg-pink-500/80 text-white dark:bg-pink-600/90", name: "Pink" },
  {
    className: "bg-indigo-500/80 text-white dark:bg-indigo-600/90",
    name: "Indigo",
  },
  { className: "bg-cyan-500/80 text-white dark:bg-cyan-600/90", name: "Cyan" },
  {
    className: "bg-emerald-500/80 text-white dark:bg-emerald-600/90",
    name: "Emerald",
  },
  {
    className: "bg-orange-500/80 text-white dark:bg-orange-600/90",
    name: "Orange",
  },
  { className: "bg-teal-500/80 text-white dark:bg-teal-600/90", name: "Teal" },
  {
    className: "bg-violet-500/80 text-white dark:bg-violet-600/90",
    name: "Violet",
  },
  { className: "bg-rose-500/80 text-white dark:bg-rose-600/90", name: "Rose" },
  { className: "bg-lime-500/80 text-white dark:bg-lime-600/90", name: "Lime" },
  {
    className: "bg-fuchsia-500/80 text-white dark:bg-fuchsia-600/90",
    name: "Fuchsia",
  },
  { className: "bg-sky-500/80 text-white dark:bg-sky-600/90", name: "Sky" },
];

const HASH_MOD = 1_000_000_007;

/**
 * Deterministic hash for a string (djb2-style, arithmetic-only).
 * Same tag value always yields the same color across sessions.
 */
const hashString = (str: string): number => {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33 + str.charCodeAt(i)) % HASH_MOD;
  }
  if (hash < 0) {
    hash += HASH_MOD;
  }
  return hash;
};

/**
 * Get a stable color index from a tag value (0 to TAG_COLORS.length - 1).
 * Normalized with trim + toLowerCase so "Urgent" and "urgent" share the same color.
 */
const getColorIndexForTag = (tagValue: string): number => {
  if (!tagValue) {
    return 0;
  }
  const normalized = tagValue.trim().toLowerCase();
  if (!normalized) {
    return 0;
  }
  return hashString(normalized) % TAG_COLORS.length;
};

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

function getColorClassForTag(
  tagValue: string,
  tagColorMap?: Record<string, string>
): string {
  const normalized = tagValue.trim().toLowerCase();
  const fromMap =
    tagColorMap?.[tagValue] ??
    (normalized ? tagColorMap?.[normalized] : undefined);
  if (fromMap) {
    return fromMap;
  }
  return TAG_COLORS[getColorIndexForTag(tagValue)].className;
}

export interface TagCellProps {
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
export function TagCell({ className = "", tagColorMap, value }: TagCellProps) {
  const tagValues = toTagValues(value);

  if (tagValues.length === 0) {
    return <span className="text-muted-foreground">-</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {tagValues.map((tagValue) => (
        <Badge
          className={cn(
            "inline-flex items-center rounded-full px-2.5 py-0.5 font-medium text-xs",
            getColorClassForTag(tagValue, tagColorMap),
            className
          )}
          key={tagValue}
        >
          {tagValue}
        </Badge>
      ))}
    </div>
  );
}
