import { tagAppearance } from "./tag-colors";

/**
 * Semantic tones a tag takes from its data (published, late, failed). Themes
 * set `--yayaw-success`, `--yayaw-warning` and `--yayaw-danger`; "neutral" is
 * the muted tag.
 */
export const TAG_TONES = ["neutral", "success", "warning", "danger"] as const;

export type TagTone = (typeof TAG_TONES)[number];

const TAG_TONE_COLORS: Record<Exclude<TagTone, "neutral">, string> = {
  success: "var(--yayaw-success, #16a34a)",
  warning: "var(--yayaw-warning, #ca8a04)",
  danger: "var(--yayaw-danger, #dc2626)",
};

export const isTagTone = (value: unknown): value is TagTone =>
  typeof value === "string" && (TAG_TONES as readonly string[]).includes(value);

/**
 * How one tag of a row shows, from `tagItem(value, row)`: every field is
 * optional and falls back to the option's label and color.
 */
export interface TagItem<TIcon = unknown> {
  /** Replaces the option's label (or the raw value). */
  label?: string;
  tone?: TagTone;
  /** A React node or a Vue component, drawn before the label. */
  icon?: TIcon;
  /** Tooltip and accessible description. */
  title?: string;
}

/** Column options that let row data drive each tag. */
export interface TagItemColumn<TRow, TIcon> {
  tagItem?: (value: unknown, row: TRow) => TagItem<TIcon> | null | undefined;
  /** Makes each tag a button; its click never reaches the row or inline editing. */
  onTagClick?: (value: unknown, row: TRow) => unknown;
}

/**
 * A tag's colors: its tone wins, and shows even with `coloredTags: false`
 * since it carries meaning; without one, the option's color, `tagColorMap`
 * and the automatic hue apply as before.
 */
export function tagItemAppearance(
  value: string,
  tone: unknown,
  coloredTags = true,
  map?: Record<string, string>,
  color?: string
): ReturnType<typeof tagAppearance> {
  if (!isTagTone(tone)) {
    return tagAppearance(value, coloredTags, map, color);
  }
  if (tone === "neutral") {
    return { colored: false };
  }
  return {
    colored: true,
    className: "yayaw-tag-tinted",
    style: { "--yayaw-tag-color": TAG_TONE_COLORS[tone] },
  };
}
