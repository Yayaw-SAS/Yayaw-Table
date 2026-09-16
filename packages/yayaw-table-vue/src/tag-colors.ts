/** Stored values, never translated labels, determine automatic colors. */
export function tagAppearance(
  value: string,
  coloredTags = true,
  map?: Record<string, string>
): {
  colored: boolean;
  className?: string;
  style?: Record<string, string>;
} {
  if (!coloredTags) {
    return { colored: false };
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
