/**
 * Generated avatars: initials and a stable color from a name, shown where a
 * record has no image. Pure and shared by the React and Vue editions (synced
 * to Vue); the look lives in `initials-avatar.css`.
 */

/** Avatar options of an image column, a card mode or a gallery. */
export interface AvatarConfig {
  /**
   * Column whose text gives the initials and the color. Defaults to the card
   * title; in table cells, to the record's `name`, `title` or `label`.
   */
  nameColumn?: string;
  /**
   * Image column shown as the avatar in Kanban and List cards; the initials
   * replace it when the record has no image there.
   */
  imageColumn?: string;
  /** Avatar outline. Defaults to "circle". */
  shape?: AvatarShape;
}

export type AvatarShape = "circle" | "square";

/** `true` uses every default; `false` or omitted shows no generated avatar. */
export type AvatarOption = boolean | AvatarConfig;

const AVATAR_SHAPES: ReadonlySet<string> = new Set(["circle", "square"]);

const WORDS = /[\p{L}\p{N}]+/gu;

const EMAIL_DOMAIN = /@.*$/;

const SEPARATORS = /[._-]+/g;

/** Hues readable as dark text on a light tint and light text on a dark one. */
const AVATAR_HUES = [
  217, 142, 38, 0, 271, 330, 239, 189, 160, 25, 173, 258, 350, 84, 292, 199,
] as const;

/** Record keys read for a name when no column is configured. */
const NAME_KEYS = ["name", "title", "label", "fullName", "displayName"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const textOf = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

/** The avatar options in effect, or undefined when none is asked for. */
export function resolveAvatarConfig(option: unknown): AvatarConfig | undefined {
  if (option === true) {
    return {};
  }
  if (!isRecord(option)) {
    return;
  }
  const config: AvatarConfig = {};
  const nameColumn = textOf(option.nameColumn);
  if (nameColumn) {
    config.nameColumn = nameColumn;
  }
  const imageColumn = textOf(option.imageColumn);
  if (imageColumn) {
    config.imageColumn = imageColumn;
  }
  if (typeof option.shape === "string" && AVATAR_SHAPES.has(option.shape)) {
    config.shape = option.shape as AvatarShape;
  }
  return config;
}

/**
 * The avatar option as saved views keep it: `true`, `false`, or its known
 * settings; undefined for anything else.
 */
export function normalizeAvatarOption(
  option: unknown
): AvatarOption | undefined {
  if (typeof option === "boolean") {
    return option;
  }
  return isRecord(option) ? resolveAvatarConfig(option) : undefined;
}

/**
 * Up to two letters: the first letters of the first and last words, or the
 * first two letters of a single word. An email reads its local part.
 */
export function avatarInitials(name: string): string {
  const text = name.trim().replace(EMAIL_DOMAIN, "").replace(SEPARATORS, " ");
  const words = text.match(WORDS) ?? [];
  const first = words.at(0) ?? "";
  if (words.length > 1) {
    const last = words.at(-1) ?? "";
    return `${Array.from(first).at(0) ?? ""}${Array.from(last).at(0) ?? ""}`.toLocaleUpperCase();
  }
  return Array.from(first).slice(0, 2).join("").toLocaleUpperCase();
}

/** A hue that stays the same for the same name. */
export function avatarHue(name: string): number {
  let hash = 5381;
  for (const character of name.trim().toLocaleLowerCase()) {
    hash = (hash * 33 + (character.codePointAt(0) ?? 0)) % 1_000_000_007;
  }
  return AVATAR_HUES[hash % AVATAR_HUES.length] ?? AVATAR_HUES[0];
}

/** The name a record's avatar reads, from `nameColumn` or the usual name keys. */
export function avatarNameOf(
  row: Record<string, unknown>,
  nameColumn?: string
): string {
  if (nameColumn) {
    return textOf(row[nameColumn]) || String(row[nameColumn] ?? "").trim();
  }
  for (const key of NAME_KEYS) {
    const text = textOf(row[key]);
    if (text) {
      return text;
    }
  }
  return "";
}

export interface InitialsAvatar {
  initials: string;
  /** The name read aloud when the avatar is not decorative. */
  name: string;
  hue: number;
  shape: AvatarShape;
  /** Inline style: the hue as `--yayaw-avatar-hue`. */
  style: Record<string, string>;
}

/** The generated avatar of a name, or undefined when it has no letters. */
export function initialsAvatar(
  name: string,
  shape: AvatarShape = "circle"
): InitialsAvatar | undefined {
  const initials = avatarInitials(name);
  if (!initials) {
    return;
  }
  const hue = avatarHue(name);
  return {
    initials,
    name: name.trim(),
    hue,
    shape,
    style: { "--yayaw-avatar-hue": String(hue) },
  };
}
