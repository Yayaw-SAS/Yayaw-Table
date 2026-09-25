/** Colors "Manage tags" offers; hosts may also store any CSS color. */
export const TAG_COLOR_NAMES = [
  "gray",
  "brown",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
  "red",
] as const;

export type TagColorName = (typeof TAG_COLOR_NAMES)[number];

const TAG_COLOR_VALUES: Record<TagColorName, string> = {
  gray: "#71717a",
  brown: "#92400e",
  orange: "#ea580c",
  yellow: "#ca8a04",
  green: "#16a34a",
  blue: "#2563eb",
  purple: "#9333ea",
  pink: "#db2777",
  red: "#dc2626",
};

const CSS_COLOR =
  /^(?:#[\da-f]{3,8}|[a-z]+|(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\([\d\s.,%/+a-z-]*\)|var\(--[\w-]+\))$/i;

export const isTagColorName = (value: unknown): value is TagColorName =>
  typeof value === "string" &&
  (TAG_COLOR_NAMES as readonly string[]).includes(value);

/**
 * The CSS color of a tag's `color`: a palette name, or a CSS color (hex,
 * functional notation, keyword, `var(--…)`); undefined for anything else.
 */
export function tagColorValue(color: unknown): string | undefined {
  if (typeof color !== "string") {
    return;
  }
  const value = color.trim();
  if (isTagColorName(value)) {
    return TAG_COLOR_VALUES[value];
  }
  return CSS_COLOR.test(value) ? value : undefined;
}

/**
 * Stored values, never translated labels, determine automatic colors. A tag's
 * own `color` (an option's or a catalog tag's) wins over `map` and the
 * automatic hue.
 */
export function tagAppearance(
  value: string,
  coloredTags = true,
  map?: Record<string, string>,
  color?: string
): {
  colored: boolean;
  className?: string;
  style?: Record<string, string>;
} {
  if (!coloredTags) {
    return { colored: false };
  }
  const tinted = tagColorValue(color);
  if (tinted) {
    return {
      colored: true,
      className: "yayaw-tag-tinted",
      style: { "--yayaw-tag-color": tinted },
    };
  }
  const normalized = value.trim().toLowerCase();
  const className = map?.[value] ?? map?.[normalized];
  if (className) {
    return { colored: true, className };
  }
  let hash = 5381;
  for (const character of normalized) {
    hash = (hash * 33 + character.charCodeAt(0)) % 1_000_000_007;
  }
  const hues = [
    217, 142, 38, 0, 271, 330, 239, 189, 160, 25, 173, 258, 350, 84, 292, 199,
  ];
  return {
    colored: true,
    style: { "--yayaw-tag-hue": String(hues[hash % hues.length]) },
  };
}

/**
 * A solid color for a tag's swatch (filter dots, the color picker): its own
 * color, else its automatic hue; undefined when tags are not colored.
 */
export function tagSwatchColor(
  value: string,
  coloredTags = true,
  color?: string
): string | undefined {
  if (!coloredTags) {
    return;
  }
  const tinted = tagColorValue(color);
  if (tinted) {
    return tinted;
  }
  const hue = tagAppearance(value, true).style?.["--yayaw-tag-hue"];
  return hue ? `hsl(${hue} 70% 45%)` : undefined;
}
