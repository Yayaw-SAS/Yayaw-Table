/**
 * Localized texts of forms, shared by the React and Vue editions. A text is a
 * plain string (as before) or one string per locale:
 *
 * ```ts
 * resolveFormText({ en: "Name", fr: "Nom" }, "fr-CA"); // "Nom"
 * resolveFormText("Name", "fr"); // "Name": a plain text is every language's
 * ```
 *
 * Pure and dependency-free, so a host can resolve texts on its server.
 */

/** A form text: one string, or one per locale (`{ en: "Name", fr: "Nom" }`). */
export type FormText = string | Readonly<Record<string, string>>;

const LOCALE_TAG = /^[a-z]{2,3}(?:-[a-z\d]{2,8})*$/i;
const UNDERSCORES = /_/g;
const LETTERS = /^[a-z]+$/i;
const SUBTAG_SEPARATOR = /[-_]/;
const MAX_LOCALE_LENGTH = 35;
const SCRIPT_LENGTH = 4;
const REGION_LENGTH = 2;

/**
 * Languages offered by "Add language" when the host lists none
 * (`table.form.locales`).
 */
export const FORM_COMMON_LOCALES = [
  "en",
  "fr",
  "de",
  "es",
  "it",
  "nl",
  "pt",
  "pl",
  "sv",
  "da",
  "fi",
  "nb",
  "cs",
  "ro",
  "el",
  "tr",
  "ru",
  "uk",
  "ar",
  "he",
  "ja",
  "ko",
  "zh",
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const casePart = (part: string, index: number): string => {
  if (index === 0) {
    return part.toLowerCase();
  }
  if (part.length === SCRIPT_LENGTH && LETTERS.test(part)) {
    return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
  }
  return part.length === REGION_LENGTH
    ? part.toUpperCase()
    : part.toLowerCase();
};

/**
 * A language tag as forms store it ("fr", "fr-CA", "zh-Hant"), or `undefined`
 * when the value is not one. Underscores are read as hyphens ("fr_CA").
 */
export function formLocaleTag(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return;
  }
  const tag = value.trim().replace(UNDERSCORES, "-");
  if (!tag || tag.length > MAX_LOCALE_LENGTH || !LOCALE_TAG.test(tag)) {
    return;
  }
  return tag.split("-").map(casePart).join("-");
}

/** The language of a locale: "fr" for "fr-CA". */
export const formLanguage = (locale: string): string =>
  (locale.split(SUBTAG_SEPARATOR)[0] ?? "").toLowerCase();

/** Languages in order, each once (by tag), malformed ones left out. */
export function uniqueFormLocales(values: Iterable<unknown>): string[] {
  const seen = new Set<string>();
  const locales: string[] = [];
  for (const value of values) {
    const tag = formLocaleTag(value);
    if (tag && !seen.has(tag.toLowerCase())) {
      seen.add(tag.toLowerCase());
      locales.push(tag);
    }
  }
  return locales;
}

/**
 * Keep a valid text: a non-empty string, or non-empty strings under valid
 * language tags. Anything else is `undefined`, so plain strings saved before
 * localized texts existed stay as they are.
 */
export function normalizeFormText(value: unknown): FormText | undefined {
  if (typeof value === "string") {
    return value.trim() || undefined;
  }
  if (!isRecord(value)) {
    return;
  }
  const entries: [string, string][] = [];
  const seen = new Set<string>();
  for (const [key, text] of Object.entries(value)) {
    const locale = formLocaleTag(key);
    const content = typeof text === "string" ? text.trim() : "";
    if (locale && content && !seen.has(locale.toLowerCase())) {
      seen.add(locale.toLowerCase());
      entries.push([locale, content]);
    }
  }
  return entries.length ? Object.fromEntries(entries) : undefined;
}

const textEntries = (text: Readonly<Record<string, string>>) =>
  Object.entries(text).filter(
    (entry): entry is [string, string] =>
      typeof entry[1] === "string" && entry[1].trim() !== ""
  );

/**
 * The language among `locales` that serves `locale`: its exact tag, else its
 * language ("fr" for "fr-CA"), else another variant of it ("fr-FR").
 */
export function formLocaleMatch(
  locales: readonly string[],
  locale: string | undefined
): string | undefined {
  const tag = formLocaleTag(locale);
  if (!tag) {
    return;
  }
  const lower = tag.toLowerCase();
  const language = formLanguage(tag);
  return (
    locales.find((key) => key.toLowerCase() === lower) ??
    locales.find((key) => key.toLowerCase() === language) ??
    locales.find((key) => formLanguage(key) === language)
  );
}

/** A text in one language, and that language when it is known. */
export interface FormTextVersion {
  text: string;
  locale?: string;
}

/**
 * The version of a text for `locale`, with its language: the exact locale,
 * then its language, then the form's default locale. A plain string is the
 * default locale's. `undefined` when none of them has a text, so callers can
 * use their own default (a column name, a built-in label).
 */
export function formTextVersion(
  text: FormText | undefined,
  locale?: string,
  defaultLocale?: string
): FormTextVersion | undefined {
  if (text === undefined) {
    return;
  }
  if (typeof text === "string") {
    const content = text.trim();
    return content ? { text: content, locale: defaultLocale } : undefined;
  }
  const entries = textEntries(text);
  const keys = entries.map(([key]) => key);
  const key =
    formLocaleMatch(keys, locale) ?? formLocaleMatch(keys, defaultLocale);
  const found = entries.find(([entry]) => entry === key);
  return found ? { text: found[1], locale: found[0] } : undefined;
}

/**
 * A text in `locale`: the exact locale, then its language, then the form's
 * default locale, then the first version available. Plain strings are the
 * same in every language. Texts with a default of their own (a question's
 * column name, a built-in label) use `formTextVersion` instead.
 */
export function resolveFormText(
  text: FormText | undefined,
  locale?: string,
  defaultLocale?: string
): string | undefined {
  const version = formTextVersion(text, locale, defaultLocale);
  if (version || !text || typeof text === "string") {
    return version?.text;
  }
  return textEntries(text)[0]?.[1];
}

const sameLocale = (left: string, right: string) =>
  left.toLowerCase() === right.toLowerCase();

/**
 * The text written for exactly `locale`, as a settings input shows it: a plain
 * text belongs to the default locale; other locales read "" until translated.
 */
export function formTextIn(
  text: FormText | undefined,
  locale: string,
  defaultLocale: string
): string {
  if (text === undefined) {
    return "";
  }
  if (typeof text === "string") {
    return sameLocale(locale, defaultLocale) ? text : "";
  }
  return textEntries(text).find(([key]) => sameLocale(key, locale))?.[1] ?? "";
}

/**
 * A text with the version of `locale` replaced, or removed when `value` is
 * empty. A text only written in the default locale stays a plain string, so
 * forms that are not translated keep their saved shape.
 */
export function setFormText(
  text: FormText | undefined,
  locale: string,
  value: string,
  defaultLocale: string
): FormText | undefined {
  const content = value.trim();
  const entries: [string, string][] =
    typeof text === "string"
      ? [[defaultLocale, text]]
      : textEntries(text ?? {});
  const others = entries.filter(([key]) => !sameLocale(key, locale));
  const next = content
    ? [...others, [locale, content] as [string, string]]
    : others;
  if (next.length === 0) {
    return;
  }
  const [only] = next;
  if (next.length === 1 && only && sameLocale(only[0], defaultLocale)) {
    return only[1];
  }
  return Object.fromEntries(next);
}

/** Locales a text is written in (a plain text is written in none in particular). */
export const formTextLocales = (text: FormText | undefined): string[] =>
  text && typeof text !== "string"
    ? uniqueFormLocales(textEntries(text).map(([key]) => key))
    : [];

/**
 * Whether `locale` still needs a translation: another language (or `source`,
 * such as the column name a question shows by default) has a text and this
 * locale has none. The default locale only misses a text that other
 * languages have.
 */
export function formTextMissing(
  text: FormText | undefined,
  locale: string,
  defaultLocale: string,
  source?: string
): boolean {
  if (formTextIn(text, locale, defaultLocale)) {
    return false;
  }
  if (sameLocale(locale, defaultLocale)) {
    return formTextLocales(text).length > 0;
  }
  return resolveFormText(text, defaultLocale) !== undefined || Boolean(source);
}

/**
 * A language's name: in itself by default ("English", "Français", "Deutsch"),
 * as a language switcher shows it, or in `inLocale` for a sentence ("anglais").
 */
export function formLanguageName(locale: string, inLocale?: string): string {
  try {
    const name = new Intl.DisplayNames([inLocale ?? locale], {
      type: "language",
    }).of(locale);
    if (name && name.toLowerCase() !== locale.toLowerCase()) {
      return inLocale
        ? name
        : name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
    }
  } catch {
    // Unknown tags keep their code below.
  }
  return locale.toUpperCase();
}
