/**
 * Target schema health for connectors, shared by the React and Vue editions
 * and safe to run on the host's server: which table column types fit which
 * target field types in each direction, where each mapped field is now
 * (stable ids first, then names, then sheet positions), and what is wrong
 * with a target before a push or a sync (`checkTargetSchema`).
 *
 * The module is pure: no I/O, no framework, no import. The connector screen
 * runs it on the fields `describe` returns; a host worker runs it on a fresh
 * schema (`notionTargetSchema`, `sheetTargetSchema`) before a scheduled run
 * and pauses the schedule when `schemaBlocksRun(report)` is true.
 */

/** Default name of the target field that holds each record's id. */
export const SCHEMA_DEFAULT_KEY_FIELD = "Yayaw ID";

/** Who hosts the target: decides what can be created and how strict types are. */
export type TargetProvider = "notion" | "sheets";

/** Push writes the target, pull reads it, two-way does both. */
export type SchemaDirection = "push" | "pull" | "two-way";

/** A field of the target as the check sees it. */
export interface TargetSchemaField {
  name: string;
  /** Stable id (a Notion property id), kept across renames. */
  id?: string;
  /**
   * The provider's type: Notion's (`rich_text`, `number`, `select`,
   * `status`, `formula`…), a type sampled from sheet cells (`text`,
   * `number`, `date`, `boolean`) or a table-like type.
   */
  type?: string;
  /** Select, multi-select and status options. */
  options?: readonly (string | { name: string; color?: string })[];
  /** Zero-based position (sheet column). */
  index?: number;
  /** A few values, to tell whether a conversion will work. */
  sample?: readonly unknown[];
}

export interface TargetSchema {
  provider?: TargetProvider;
  fields: readonly TargetSchemaField[];
}

/** A table column option (select, multi-select). */
export type SchemaColumnOption =
  | string
  | { value: unknown; label?: string; color?: string };

export interface SchemaColumn {
  id: string;
  header: string;
  type?: string;
  options?: readonly SchemaColumnOption[];
}

/** A mapping entry: the field name, plus the id and position seen when it was saved. */
export interface SchemaMappingEntry {
  columnId: string;
  field: string | null;
  fieldId?: string;
  fieldIndex?: number;
}

export type SchemaIssueSeverity = "blocking" | "warning" | "fixable";

export type SchemaIssueCode =
  /** A mapped field the target does not have. */
  | "missing_field"
  /** A mapped field whose id and name are both gone. */
  | "deleted_field"
  /** A mapped field found by id or position under another name. */
  | "renamed_field"
  /** The field's type cannot take (or give) the column's values. */
  | "incompatible_type"
  /** The values convert, but some may not. */
  | "coercible_type"
  /** A field type the connector cannot write or read yet (people, files…). */
  | "unsupported_type"
  /** A computed field (formula, rollup, created time…) as a write target. */
  | "read_only_field"
  /** Table options the target's select, multi-select or status lacks. */
  | "missing_options"
  /** The key field ("Yayaw ID") is missing. */
  | "missing_key"
  /** The key field cannot hold record ids. */
  | "key_wrong_type"
  /** One field receives several columns (or the key). */
  | "duplicate_mapping"
  /** No column fills the Notion page title. */
  | "title_unmapped"
  /**
   * A sheet header is gone and its saved position is unusable (empty, or
   * another mapped header): writes stop instead of adding it again.
   */
  | "field_missing";

/** Details for the message; only names, types and option names. */
export interface SchemaIssueDetail {
  /** Target field type (provider vocabulary). */
  actual?: string;
  /** Table column type. */
  expected?: string;
  /** Previous name, for renames. */
  from?: string;
  /** Current name, for renames. */
  to?: string;
  /** Missing option names. */
  options?: string[];
  /** Sampled values that do not convert. */
  invalid?: number;
  /** Other columns sharing the field. */
  columns?: string[];
}

export interface SchemaIssue {
  severity: SchemaIssueSeverity;
  code: SchemaIssueCode;
  columnId?: string;
  /** Field name (current one when found). */
  field?: string;
  fieldId?: string;
  detail: SchemaIssueDetail;
  /** What "Prepare" does about a fixable issue. */
  fix?: SchemaFix;
}

/** An additive change to the target; nothing is ever deleted, renamed or retyped. */
export type SchemaFix =
  | {
      kind: "create_field";
      field: string;
      /** Provider type to create (`rich_text`, `number`, `select`…). */
      type: string;
      options?: { name: string; color?: string }[];
      columnId?: string;
      /** The field holds record ids. */
      key?: boolean;
      /** Saved sheet position: `prepareSheet` never adds a renamed header again. */
      fieldIndex?: number;
    }
  | {
      kind: "add_options";
      field: string;
      fieldId?: string;
      /** `select` or `multi_select`. */
      type: string;
      options: { name: string; color?: string }[];
    };

export interface SchemaReport {
  issues: SchemaIssue[];
  /** The fixes of the fixable issues, for `prepareTarget`. */
  fixes: SchemaFix[];
}

export interface CheckTargetSchemaInput {
  columns: readonly SchemaColumn[];
  mapping: readonly SchemaMappingEntry[];
  keyField?: string;
  keyFieldId?: string;
  keyFieldIndex?: number;
  targetSchema: TargetSchema;
  direction?: SchemaDirection;
}

// Types ----------------------------------------------------------------------------

/** What a table column holds. */
export type TableTypeFamily =
  | "text"
  | "number"
  | "date"
  | "boolean"
  | "select"
  | "multi"
  | "url"
  | "email"
  | "phone"
  | "files"
  | "person"
  | "relation";

/** What a target field holds, provider-neutral. */
export type TargetTypeKind =
  | "title"
  | "text"
  | "number"
  | "select"
  | "status"
  | "multi"
  | "date"
  | "checkbox"
  | "url"
  | "email"
  | "phone"
  | "files"
  | "people"
  | "relation"
  | "readonly"
  | "unknown";

/** How well a column and a field fit, in one direction. */
export type TypeCompatibility =
  | "ok"
  | "coerce"
  | "no"
  | "unsupported"
  | "read_only";

const SEPARATORS = /[\s_-]+/g;

const TABLE_FAMILIES: Record<string, TableTypeFamily> = {
  number: "number",
  currency: "number",
  percent: "number",
  rating: "number",
  integer: "number",
  float: "number",
  decimal: "number",
  progress: "number",
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
  url: "url",
  link: "url",
  email: "email",
  phone: "phone",
  tel: "phone",
  file: "files",
  files: "files",
  image: "files",
  attachment: "files",
  person: "person",
  user: "person",
  people: "person",
  relation: "relation",
};

/** The family of a table column type; unknown types are text. */
export function tableTypeFamily(type: string | undefined): TableTypeFamily {
  const key = (type ?? "text").toLowerCase().replace(SEPARATORS, "");
  return TABLE_FAMILIES[key] ?? "text";
}

const READ_ONLY_TYPES = new Set([
  "formula",
  "rollup",
  "created_time",
  "created_by",
  "last_edited_time",
  "last_edited_by",
  "unique_id",
  "button",
  "verification",
]);

const TARGET_KINDS: Record<string, TargetTypeKind> = {
  title: "title",
  rich_text: "text",
  text: "text",
  longtext: "text",
  textarea: "text",
  string: "text",
  number: "number",
  currency: "number",
  percent: "number",
  select: "select",
  singleselect: "select",
  status: "status",
  multi_select: "multi",
  multiselect: "multi",
  tags: "multi",
  date: "date",
  datetime: "date",
  checkbox: "checkbox",
  boolean: "checkbox",
  url: "url",
  email: "email",
  phone_number: "phone",
  phone: "phone",
  files: "files",
  file: "files",
  people: "people",
  person: "people",
  relation: "relation",
};

/** The kind of a target field type, in Notion's or a table-like vocabulary. */
export function targetTypeKind(type: string | undefined): TargetTypeKind {
  if (!type) {
    return "unknown";
  }
  const key = type.toLowerCase();
  if (READ_ONLY_TYPES.has(key)) {
    return "readonly";
  }
  return (
    TARGET_KINDS[key] ?? TARGET_KINDS[key.replace(SEPARATORS, "")] ?? "unknown"
  );
}

const TEXT_KINDS: readonly TargetTypeKind[] = ["title", "text", "unknown"];

/** Push: what each field kind accepts besides text; `coerce` needs the text to parse. */
const PUSH_ACCEPTS: Record<TableTypeFamily, readonly TargetTypeKind[]> = {
  text: [],
  number: ["number"],
  date: ["date"],
  boolean: ["checkbox"],
  select: ["select", "status", "multi"],
  multi: ["multi"],
  url: ["url"],
  email: ["email"],
  phone: ["phone"],
  files: [],
  person: [],
  relation: [],
};

/** Field kinds text can fill when its values parse (a number, an option…). */
const TEXT_COERCES: readonly TargetTypeKind[] = [
  "number",
  "select",
  "status",
  "multi",
  "date",
  "url",
  "email",
  "phone",
];

/** Pull: which field kinds fill each column family directly. */
const PULL_GIVES: Record<TableTypeFamily, readonly TargetTypeKind[]> = {
  text: [],
  number: ["number"],
  date: ["date"],
  boolean: ["checkbox"],
  select: ["select", "status"],
  multi: ["multi", "select", "status"],
  url: ["url"],
  email: ["email"],
  phone: ["phone"],
  files: [],
  person: [],
  relation: [],
};

const UNSUPPORTED_KINDS: readonly TargetTypeKind[] = [
  "files",
  "people",
  "relation",
];

function pushCompatibility(
  family: TableTypeFamily,
  kind: TargetTypeKind
): TypeCompatibility {
  if (kind === "readonly") {
    return "read_only";
  }
  if (UNSUPPORTED_KINDS.includes(kind)) {
    return "unsupported";
  }
  if (TEXT_KINDS.includes(kind) || PUSH_ACCEPTS[family].includes(kind)) {
    return "ok";
  }
  return family === "text" && TEXT_COERCES.includes(kind) ? "coerce" : "no";
}

function pullCompatibility(
  family: TableTypeFamily,
  kind: TargetTypeKind
): TypeCompatibility {
  if (UNSUPPORTED_KINDS.includes(kind)) {
    return "unsupported";
  }
  if (kind === "unknown" || family === "text") {
    return "ok";
  }
  if (PULL_GIVES[family].includes(kind)) {
    return "ok";
  }
  // Text, and computed values (formulas, times), may hold the right values.
  return kind === "title" || kind === "text" || kind === "readonly"
    ? "coerce"
    : "no";
}

const SEVERITY_ORDER: readonly TypeCompatibility[] = [
  "ok",
  "coerce",
  "no",
  "unsupported",
  "read_only",
];

/**
 * Whether a table column type and a target field type fit in a direction:
 * `ok`, `coerce` (the values must parse: text into a number field, a text
 * field into a number column), `no`, `unsupported` (people, files,
 * relations) or `read_only` (formulas, rollups, created times as a write
 * target). Two-way takes the worse of push and pull.
 */
export function typeCompatibility(
  columnType: string | undefined,
  targetType: string | undefined,
  direction: SchemaDirection = "push"
): TypeCompatibility {
  const family = tableTypeFamily(columnType);
  const kind = targetTypeKind(targetType);
  if (direction === "push") {
    return pushCompatibility(family, kind);
  }
  if (direction === "pull") {
    return pullCompatibility(family, kind);
  }
  const push = pushCompatibility(family, kind);
  const pull = pullCompatibility(family, kind);
  return SEVERITY_ORDER.indexOf(push) >= SEVERITY_ORDER.indexOf(pull)
    ? push
    : pull;
}

const NOTION_CREATE_TYPES: Record<TableTypeFamily, string> = {
  text: "rich_text",
  number: "number",
  date: "date",
  boolean: "checkbox",
  select: "select",
  multi: "multi_select",
  url: "url",
  email: "email",
  phone: "phone_number",
  files: "rich_text",
  person: "rich_text",
  relation: "rich_text",
};

/** The Notion property type created for a table column type. */
export function notionTypeFor(columnType: string | undefined): string {
  return NOTION_CREATE_TYPES[tableTypeFamily(columnType)];
}

// Options and colors ---------------------------------------------------------------

/** Colors Notion accepts for select options. */
export const NOTION_OPTION_COLORS = [
  "default",
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

export type NotionOptionColor = (typeof NOTION_OPTION_COLORS)[number];

const COLOR_ALIASES: Record<string, NotionOptionColor> = {
  grey: "gray",
  slate: "gray",
  zinc: "gray",
  neutral: "gray",
  stone: "brown",
  amber: "orange",
  lime: "green",
  emerald: "green",
  teal: "green",
  cyan: "blue",
  sky: "blue",
  indigo: "blue",
  violet: "purple",
  fuchsia: "pink",
  rose: "red",
};

/** The table's automatic tag hues, in the table's order (see `tagAppearance`). */
const TAG_HUES = [
  217, 142, 38, 0, 271, 330, 239, 189, 160, 25, 173, 258, 350, 84, 292, 199,
];
const HASH_SEED = 5381;
const HASH_FACTOR = 33;
const HASH_MODULUS = 1_000_000_007;

const HUE_COLORS: readonly [number, NotionOptionColor][] = [
  [15, "red"],
  [45, "orange"],
  [70, "yellow"],
  [170, "green"],
  [250, "blue"],
  [290, "purple"],
  [345, "pink"],
  [360, "red"],
];

function tagHue(value: string): number {
  let hash = HASH_SEED;
  for (const character of value.trim().toLowerCase()) {
    hash =
      (hash * HASH_FACTOR + (character.codePointAt(0) ?? 0)) % HASH_MODULUS;
  }
  return TAG_HUES[hash % TAG_HUES.length] ?? 0;
}

function namedColor(color: string): NotionOptionColor | undefined {
  const lower = color.toLowerCase();
  const direct = NOTION_OPTION_COLORS.find(
    (name) => name !== "default" && lower.includes(name)
  );
  if (direct) {
    return direct;
  }
  const alias = Object.keys(COLOR_ALIASES).find((name) => lower.includes(name));
  return alias ? COLOR_ALIASES[alias] : undefined;
}

/**
 * The Notion color of a table option: its explicit color when it names one
 * (`"red"`, `"bg-emerald-100"`), otherwise the hue the table gives the tag.
 */
export function notionColorFor(option: {
  value: string;
  color?: string;
}): NotionOptionColor {
  const named = option.color ? namedColor(option.color) : undefined;
  if (named) {
    return named;
  }
  const hue = tagHue(option.value);
  return HUE_COLORS.find(([limit]) => hue < limit)?.[1] ?? "red";
}

const optionValue = (option: SchemaColumnOption): string =>
  typeof option === "string" ? option : String(option.value ?? "");

const optionColor = (option: SchemaColumnOption): string | undefined =>
  typeof option === "string" ? undefined : option.color;

const fieldOptionNames = (field: TargetSchemaField): Set<string> =>
  new Set(
    (field.options ?? []).map((option) =>
      (typeof option === "string" ? option : option.name).trim().toLowerCase()
    )
  );

/** Table options the field lacks, with Notion colors. */
export function missingOptions(
  column: SchemaColumn,
  field: TargetSchemaField
): { name: string; color: NotionOptionColor }[] {
  const names = fieldOptionNames(field);
  const missing: { name: string; color: NotionOptionColor }[] = [];
  for (const option of column.options ?? []) {
    const name = optionValue(option).trim();
    if (name && !names.has(name.toLowerCase())) {
      names.add(name.toLowerCase());
      missing.push({
        name,
        color: notionColorFor({ value: name, color: optionColor(option) }),
      });
    }
  }
  return missing;
}

// Field resolution -----------------------------------------------------------------

/** Where a mapped field is now. */
export interface ResolvedField {
  /** `ambiguous`: gone by name, and its saved position cannot be used. */
  status: "found" | "renamed" | "missing" | "deleted" | "ambiguous";
  field?: TargetSchemaField;
  /** The saved name, for renames. */
  from?: string;
}

const DIACRITICS = /[̀-ͯ]/g;

const loose = (name: string) =>
  name.normalize("NFD").replace(DIACRITICS, "").toLowerCase().trim();

const byName = (fields: readonly TargetSchemaField[], name: string) =>
  fields.find((field) => field.name === name) ??
  fields.find((field) => field.name.trim() === name.trim());

/** How far the key column moved: the shift applied to saved positions. */
export function keyIndexShift(
  fields: readonly TargetSchemaField[],
  keyField: string | undefined,
  keyFieldIndex: number | undefined
): number {
  if (keyFieldIndex === undefined || !keyField) {
    return 0;
  }
  const key = byName(fields, keyField);
  return key?.index === undefined ? 0 : key.index - keyFieldIndex;
}

export interface ResolveFieldOptions {
  /** Names other entries or the key use: a position never resolves to them. */
  taken?: ReadonlySet<string>;
  /** Added to saved positions (see `keyIndexShift`). */
  shift?: number;
}

function resolveByIndex(
  entry: SchemaMappingEntry,
  fields: readonly TargetSchemaField[],
  options: ResolveFieldOptions
): TargetSchemaField | undefined {
  if (entry.fieldIndex === undefined) {
    return;
  }
  const index = entry.fieldIndex + (options.shift ?? 0);
  const field = fields.find((item) => item.index === index);
  return field && !options.taken?.has(field.name) ? field : undefined;
}

/**
 * Finds a mapped field: by stable id first, then by name, then (sheets) by
 * its saved position shifted like the key column. A field found by id or
 * position under another name is `renamed`; an id that is gone is `deleted`.
 */
export function resolveMappedField(
  entry: SchemaMappingEntry,
  fields: readonly TargetSchemaField[],
  options: ResolveFieldOptions = {}
): ResolvedField {
  const name = entry.field ?? "";
  if (entry.fieldId) {
    const field = fields.find((item) => item.id === entry.fieldId);
    if (field) {
      return field.name === name
        ? { status: "found", field }
        : { status: "renamed", field, from: name };
    }
  }
  const named = byName(fields, name);
  if (named) {
    return { status: "found", field: named };
  }
  const moved = resolveByIndex(entry, fields, options);
  if (moved) {
    return { status: "renamed", field: moved, from: name };
  }
  if (entry.fieldId) {
    return { status: "deleted" };
  }
  return { status: entry.fieldIndex === undefined ? "missing" : "ambiguous" };
}

/**
 * The mapping with current names, ids and positions: renamed fields take
 * their new name, name-only entries gain the field's id and position. Hosts
 * save it so later renames are followed ("Update mapping").
 */
export function upgradeMapping<T extends SchemaMappingEntry>(
  mapping: readonly T[],
  targetSchema: TargetSchema,
  hints: { keyField?: string; keyFieldIndex?: number } = {}
): T[] {
  const shift = keyIndexShift(
    targetSchema.fields,
    hints.keyField,
    hints.keyFieldIndex
  );
  const taken = new Set(
    mapping.flatMap((entry) => (entry.field ? [entry.field] : []))
  );
  if (hints.keyField) {
    taken.add(hints.keyField);
  }
  return mapping.map((entry) => {
    if (!entry.field) {
      return entry;
    }
    const resolved = resolveMappedField(entry, targetSchema.fields, {
      taken,
      shift,
    });
    const field = resolved.field;
    if (!field) {
      return entry;
    }
    return {
      ...entry,
      field: field.name,
      ...(field.id ? { fieldId: field.id } : {}),
      ...(field.index === undefined ? {} : { fieldIndex: field.index }),
    };
  });
}

// Checks -----------------------------------------------------------------------------

const KEY_KINDS: readonly TargetTypeKind[] = [
  "title",
  "text",
  "number",
  "unknown",
];

interface CheckContext {
  input: CheckTargetSchemaInput;
  provider: TargetProvider | undefined;
  direction: SchemaDirection;
  keyField: string;
  columns: Map<string, SchemaColumn>;
  issues: SchemaIssue[];
}

const writes = (direction: SchemaDirection) => direction !== "pull";

const push = (context: CheckContext, issue: SchemaIssue) => {
  context.issues.push(issue);
};

function missingFieldIssue(
  context: CheckContext,
  entry: SchemaMappingEntry,
  status: "missing" | "deleted"
): SchemaIssue | null {
  const column = context.columns.get(entry.columnId);
  const field = entry.field ?? "";
  const code = status === "deleted" ? "deleted_field" : "missing_field";
  // A generic target without a provider adds new fields itself on send.
  if (!context.provider) {
    return null;
  }
  if (!writes(context.direction)) {
    return {
      severity: "warning",
      code,
      columnId: entry.columnId,
      field,
      detail: {},
    };
  }
  const type =
    context.provider === "notion" ? notionTypeFor(column?.type) : "text";
  const options =
    column &&
    context.provider === "notion" &&
    (type === "select" || type === "multi_select")
      ? missingOptions(column, { name: field })
      : [];
  return {
    severity: "fixable",
    code,
    columnId: entry.columnId,
    field,
    detail: { expected: column?.type },
    fix: {
      kind: "create_field",
      field,
      type,
      columnId: entry.columnId,
      ...(options.length > 0 ? { options } : {}),
    },
  };
}

const sampleText = (value: unknown): string =>
  Array.isArray(value) ? value.join(", ") : String(value ?? "").trim();

const NUMBER_TEXT = /^[-+]?[\d\s.,']*\d[\d\s.,']*%?$/;
const EMAIL_TEXT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_TEXT = /^(https?:\/\/|mailto:|tel:)\S+$/i;
const BOOLEAN_WORDS = new Set([
  "true",
  "false",
  "yes",
  "no",
  "oui",
  "non",
  "1",
  "0",
  "x",
  "",
]);

const SAMPLE_CHECKS: Partial<
  Record<TableTypeFamily, (text: string) => boolean>
> = {
  number: (text) => NUMBER_TEXT.test(text),
  date: (text) => !Number.isNaN(Date.parse(text)),
  boolean: (text) => BOOLEAN_WORDS.has(text.toLowerCase()),
  email: (text) => EMAIL_TEXT.test(text),
  url: (text) => URL_TEXT.test(text),
};

/** Sampled values a column of `type` cannot take. */
export function invalidSamples(
  type: string | undefined,
  sample: readonly unknown[] | undefined
): number {
  const check = SAMPLE_CHECKS[tableTypeFamily(type)];
  if (!check) {
    return 0;
  }
  return (sample ?? [])
    .filter((value) => typeof value !== "number" && typeof value !== "boolean")
    .map(sampleText)
    .filter((text) => text !== "" && !check(text)).length;
}

function coerceSeverity(
  context: CheckContext,
  column: SchemaColumn,
  field: TargetSchemaField
): { code: SchemaIssueCode; severity: SchemaIssueSeverity; invalid: number } {
  // Pull reads values into the column: sampled values that fail block it.
  const invalid =
    context.direction === "push"
      ? 0
      : invalidSamples(column.type, field.sample);
  if (invalid > 0 && context.provider !== "sheets") {
    return { code: "incompatible_type", severity: "blocking", invalid };
  }
  return { code: "coercible_type", severity: "warning", invalid };
}

const COMPATIBILITY_CODES: Record<
  Exclude<TypeCompatibility, "ok" | "coerce">,
  SchemaIssueCode
> = {
  no: "incompatible_type",
  unsupported: "unsupported_type",
  read_only: "read_only_field",
};

function typeIssue(
  context: CheckContext,
  column: SchemaColumn,
  field: TargetSchemaField
): SchemaIssue | null {
  const compatibility = typeCompatibility(
    column.type,
    field.type,
    context.direction
  );
  if (compatibility === "ok") {
    return null;
  }
  const base = {
    columnId: column.id,
    field: field.name,
    ...(field.id ? { fieldId: field.id } : {}),
  };
  const detail = { actual: field.type, expected: column.type };
  if (compatibility === "coerce") {
    // Text that must parse: a warning unless sampled values fail a pull.
    const { code, severity, invalid } = coerceSeverity(context, column, field);
    return {
      ...base,
      code,
      severity,
      detail: invalid > 0 ? { ...detail, invalid } : detail,
    };
  }
  // Cells take anything: a sheet's sampled type is only a warning.
  const severity = context.provider === "sheets" ? "warning" : "blocking";
  return {
    ...base,
    code: COMPATIBILITY_CODES[compatibility],
    severity,
    detail,
  };
}

function optionsIssue(
  context: CheckContext,
  column: SchemaColumn,
  field: TargetSchemaField
): SchemaIssue | null {
  const kind = targetTypeKind(field.type);
  const choice = kind === "select" || kind === "status" || kind === "multi";
  if (!(writes(context.direction) && choice && field.options)) {
    return null;
  }
  const missing = missingOptions(column, field);
  if (missing.length === 0) {
    return null;
  }
  const base = {
    code: "missing_options" as const,
    columnId: column.id,
    field: field.name,
    ...(field.id ? { fieldId: field.id } : {}),
    detail: {
      actual: field.type,
      options: missing.map((option) => option.name),
    },
  };
  // Notion's API cannot add status options; a person adds them in Notion.
  if (context.provider === "notion" && kind === "status") {
    return { ...base, severity: "blocking" };
  }
  if (context.provider !== "notion") {
    return { ...base, severity: "warning" };
  }
  return {
    ...base,
    severity: "fixable",
    fix: {
      kind: "add_options",
      field: field.name,
      ...(field.id ? { fieldId: field.id } : {}),
      type: kind === "multi" ? "multi_select" : "select",
      options: missing,
    },
  };
}

function checkEntry(
  context: CheckContext,
  entry: SchemaMappingEntry,
  resolved: ResolvedField
): void {
  const column = context.columns.get(entry.columnId);
  if (resolved.status === "ambiguous") {
    // Writing would add the old header again: the mapping is chosen again.
    push(context, {
      severity: "blocking",
      code: "field_missing",
      columnId: entry.columnId,
      field: entry.field ?? "",
      detail: {},
    });
    return;
  }
  if (resolved.status === "missing" || resolved.status === "deleted") {
    const issue = missingFieldIssue(context, entry, resolved.status);
    if (issue) {
      push(context, issue);
    }
    return;
  }
  const field = resolved.field;
  if (!field) {
    return;
  }
  if (resolved.status === "renamed") {
    push(context, {
      severity: "warning",
      code: "renamed_field",
      columnId: entry.columnId,
      field: field.name,
      ...(field.id ? { fieldId: field.id } : {}),
      detail: { from: resolved.from, to: field.name },
    });
  }
  if (!column) {
    return;
  }
  for (const issue of [
    typeIssue(context, column, field),
    optionsIssue(context, column, field),
  ]) {
    if (issue) {
      push(context, issue);
    }
  }
}

function checkKey(context: CheckContext, resolvedKey: ResolvedField): void {
  const keyField = context.keyField;
  const key = resolvedKey.field;
  if (!key) {
    // A generic target adds the key column itself on send.
    if (!context.provider) {
      return;
    }
    push(context, {
      severity: "fixable",
      code: "missing_key",
      field: keyField,
      detail: {},
      fix: {
        kind: "create_field",
        field: keyField,
        type: context.provider === "notion" ? "rich_text" : "text",
        key: true,
      },
    });
    return;
  }
  if (!KEY_KINDS.includes(targetTypeKind(key.type))) {
    push(context, {
      severity: context.provider === "sheets" ? "warning" : "blocking",
      code: "key_wrong_type",
      field: key.name,
      ...(key.id ? { fieldId: key.id } : {}),
      detail: { actual: key.type },
    });
  }
}

function checkDuplicates(
  context: CheckContext,
  targets: readonly { entry: SchemaMappingEntry; name: string }[],
  keyName: string | undefined
): void {
  const byField = new Map<string, SchemaMappingEntry[]>();
  for (const { entry, name } of targets) {
    const list = byField.get(loose(name)) ?? [];
    list.push(entry);
    byField.set(loose(name), list);
  }
  for (const { entry, name } of targets) {
    const others = (byField.get(loose(name)) ?? []).filter(
      (other) => other !== entry
    );
    const isKey = keyName !== undefined && loose(name) === loose(keyName);
    if (others.length > 0 || isKey) {
      push(context, {
        severity: "blocking",
        code: "duplicate_mapping",
        columnId: entry.columnId,
        field: name,
        detail: {
          columns: others.map(
            (other) =>
              context.columns.get(other.columnId)?.header ?? other.columnId
          ),
        },
      });
    }
  }
}

function checkTitle(
  context: CheckContext,
  targets: readonly { name: string }[],
  keyName: string | undefined
): void {
  if (context.provider !== "notion" || !writes(context.direction)) {
    return;
  }
  const title = context.input.targetSchema.fields.find(
    (field) => targetTypeKind(field.type) === "title"
  );
  const filled =
    !title ||
    title.name === keyName ||
    targets.some((target) => target.name === title.name);
  if (!filled) {
    push(context, {
      severity: "blocking",
      code: "title_unmapped",
      field: title.name,
      ...(title.id ? { fieldId: title.id } : {}),
      detail: {},
    });
  }
}

const SEVERITY_RANK: Record<SchemaIssueSeverity, number> = {
  blocking: 0,
  fixable: 1,
  warning: 2,
};

/**
 * What stands between the table and the target: missing, deleted or renamed
 * fields, types that do not fit in the direction, options the target lacks,
 * the key field, a field mapped twice, computed fields as write targets and
 * an unmapped Notion title. Blocking issues stop a run; fixable ones are
 * additive changes `prepareNotionDatabase` / `prepareSheet` can make;
 * warnings let the run go on. Issues are sorted by severity.
 */
export function checkTargetSchema(input: CheckTargetSchemaInput): SchemaReport {
  const fields = input.targetSchema.fields;
  const keyField = input.keyField?.trim() || SCHEMA_DEFAULT_KEY_FIELD;
  const context: CheckContext = {
    input,
    provider: input.targetSchema.provider,
    direction: input.direction ?? "push",
    keyField,
    columns: new Map(input.columns.map((column) => [column.id, column])),
    issues: [],
  };
  const shift = keyIndexShift(fields, keyField, input.keyFieldIndex);
  const mapped = input.mapping.filter((entry) => entry.field);
  const taken = new Set<string>([
    keyField,
    ...mapped.map((entry) => entry.field ?? ""),
  ]);
  const resolvedKey = resolveMappedField(
    { columnId: "", field: keyField, fieldId: input.keyFieldId },
    fields
  );
  const targets: { entry: SchemaMappingEntry; name: string }[] = [];
  for (const entry of mapped) {
    const resolved = resolveMappedField(entry, fields, { taken, shift });
    checkEntry(context, entry, resolved);
    targets.push({ entry, name: resolved.field?.name ?? entry.field ?? "" });
  }
  checkKey(context, resolvedKey);
  const keyName = resolvedKey.field?.name ?? keyField;
  checkDuplicates(context, targets, keyName);
  checkTitle(context, targets, keyName);
  const issues = context.issues
    .map((issue, order) => ({ issue, order }))
    .sort(
      (left, right) =>
        SEVERITY_RANK[left.issue.severity] -
          SEVERITY_RANK[right.issue.severity] || left.order - right.order
    )
    .map(({ issue }) => issue);
  return {
    issues,
    fixes: issues.flatMap((issue) =>
      issue.severity === "fixable" && issue.fix ? [issue.fix] : []
    ),
  };
}

/**
 * True when the report has a blocking issue: a scheduled run must pause
 * (with the issues as its message) instead of failing row by row.
 */
export function schemaBlocksRun(
  report: Pick<SchemaReport, "issues"> | null | undefined
): boolean {
  return (report?.issues ?? []).some((issue) => issue.severity === "blocking");
}

/** Every renamed field of a report, as "from → to". */
export function schemaRenames(
  report: Pick<SchemaReport, "issues"> | null | undefined
): { columnId: string; from: string; to: string }[] {
  return (report?.issues ?? []).flatMap((issue) =>
    issue.code === "renamed_field" &&
    issue.columnId &&
    issue.detail.from &&
    issue.detail.to
      ? [
          {
            columnId: issue.columnId,
            from: issue.detail.from,
            to: issue.detail.to,
          },
        ]
      : []
  );
}
