/**
 * Field matching shared by the connector push screen (table columns → target
 * fields) and the import screen (source fields → table columns), in both
 * editions. It does not know which side is the table: it pairs "sources" with
 * "targets" by normalized name, type-compatible targets first.
 */

const DIACRITICS = /[̀-ͯ]/g;
const SEPARATORS = /[\s_-]+/g;

/** "Échéance_date" → "echeance date": accents, case and separators ignored. */
export function normalizeFieldName(name: string): string {
  return name
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .toLowerCase()
    .replace(SEPARATORS, " ")
    .trim();
}

export type FieldTypeFamily =
  | "text"
  | "number"
  | "date"
  | "boolean"
  | "select"
  | "multi";

const TYPE_FAMILIES: Record<string, FieldTypeFamily> = {
  number: "number",
  currency: "number",
  percent: "number",
  rating: "number",
  integer: "number",
  float: "number",
  decimal: "number",
  date: "date",
  datetime: "date",
  time: "date",
  boolean: "boolean",
  checkbox: "boolean",
  switch: "boolean",
  select: "select",
  status: "select",
  singleselect: "select",
  tag: "select",
  multiselect: "multi",
  tags: "multi",
};

/** The family of a column or field type; unknown types are text. */
export function fieldTypeFamily(
  type: string | undefined
): FieldTypeFamily | undefined {
  if (!type) {
    return;
  }
  return TYPE_FAMILIES[type.toLowerCase().replace(SEPARATORS, "")] ?? "text";
}

/**
 * Whether values of `sourceType` fit `targetType`; text targets take
 * anything, a single choice fits a multiple one.
 */
export function areFieldTypesCompatible(
  sourceType: string | undefined,
  targetType: string | undefined
): boolean {
  const source = fieldTypeFamily(sourceType);
  const target = fieldTypeFamily(targetType);
  if (!(source && target) || target === "text" || source === target) {
    return true;
  }
  return source === "select" && target === "multi";
}

/**
 * One row of the column-mapping screen, in either direction: a field on the
 * left, a select of what it goes to on the right, with an optional sample
 * value and a badge saying how well the values convert.
 */
export interface ColumnMappingRow {
  /** Screen field id, e.g. "map:<name>". */
  id: string;
  label: string;
  value: string;
  /** Disabled choices stay listed and say why in their label. */
  options: { value: string; label: string; disabled?: boolean }[];
  heading?: string;
  sample?: string;
  badge?: { label: string; invalid: boolean };
}

/** One side of a match: a key, the names it answers to and a type. */
export interface MatchCandidate {
  key: string;
  /** Header first, then aliases such as the column id. */
  names: readonly string[];
  type?: string;
}

export interface MatchOptions {
  /** Target names already taken (e.g. the key field). */
  reserved?: readonly string[];
  /**
   * For a source nothing matched: a name to use instead (a new field), or
   * `null`. The returned name is reserved for the following sources.
   */
  fallback?: (
    source: MatchCandidate,
    used: ReadonlySet<string>
  ) => string | null;
}

const namesOf = (candidate: MatchCandidate): string[] =>
  candidate.names.map(normalizeFieldName).filter(Boolean);

const pickCandidate = (
  source: MatchCandidate,
  candidates: readonly MatchCandidate[]
): MatchCandidate | undefined =>
  candidates.find(
    (target) =>
      fieldTypeFamily(source.type) === fieldTypeFamily(target.type) &&
      fieldTypeFamily(source.type) !== undefined
  ) ??
  candidates.find((target) =>
    areFieldTypesCompatible(source.type, target.type)
  ) ??
  candidates[0];

/**
 * Pairs each source, in order, with the first unused target answering to one
 * of its names (accents, case and separators ignored); among several, the
 * same type family wins, then a compatible one. Each target is used once.
 * Returns the target key per source, or the fallback name, or `null`.
 */
export function matchFieldsByName(
  sources: readonly MatchCandidate[],
  targets: readonly MatchCandidate[],
  options: MatchOptions = {}
): (string | null)[] {
  const used = new Set<string>(
    (options.reserved ?? []).map(normalizeFieldName)
  );
  const identity = (target: MatchCandidate) =>
    normalizeFieldName(target.names[0] ?? target.key) || target.key;
  return sources.map((source) => {
    const names = new Set(namesOf(source));
    const candidates = targets.filter(
      (target) =>
        !used.has(identity(target)) &&
        namesOf(target).some((name) => names.has(name))
    );
    const match = pickCandidate(source, candidates);
    if (match) {
      used.add(identity(match));
      return match.key;
    }
    const fallback = options.fallback?.(source, used) ?? null;
    if (fallback) {
      used.add(normalizeFieldName(fallback));
    }
    return fallback;
  });
}
