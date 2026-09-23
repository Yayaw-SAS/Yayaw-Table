/**
 * Data › Import, shared by the React and Vue editions: reading CSV, matching
 * its fields to the table's columns, converting values per column type,
 * planning creates and updates, and writing them through the host (bulk
 * `importRows` first, else the table's `create` and `update` actions).
 *
 * The table owns the whole flow; the host only stores rows. Sources other
 * than CSV (Notion, Google Sheets) plug in through `ImportSource`.
 */
import {
  fieldTypeFamily,
  matchFieldsByName,
  normalizeFieldName,
} from "./field-matching";

type MaybePromise<T> = T | Promise<T>;

// CSV --------------------------------------------------------------------------

export type CsvDelimiter = "," | ";" | "\t" | "|";

export const CSV_DELIMITERS: readonly CsvDelimiter[] = [",", ";", "\t", "|"];

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
  delimiter: CsvDelimiter;
}

export interface ParseCsvOptions {
  /** Detected from the first lines when left out. */
  delimiter?: CsvDelimiter;
  /** The first row holds the headers (default); otherwise "Column 1"… */
  headers?: boolean;
  /** Name of an unnamed column, from its 0-based index. */
  columnName?: (index: number) => string;
}

const BOM = "\uFEFF";
const DETECTION_LINES = 10;

/** A quoted field from just after its opening quote: its text and the index of its closing quote. */
function readQuoted(
  text: string,
  start: number
): { value: string; end: number } {
  let value = "";
  let index = start;
  while (index < text.length) {
    const char = text[index] as string;
    if (char !== '"') {
      value += char;
    } else if (text[index + 1] === '"') {
      value += '"';
      index += 1;
    } else {
      return { value, end: index };
    }
    index += 1;
  }
  return { value, end: index };
}

/** Splits CSV text into records (RFC 4180: quotes, escaped quotes, newlines in quotes, CRLF/LF). */
function csvRecords(
  text: string,
  delimiter: string,
  limit = Number.POSITIVE_INFINITY
) {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let index = 0;
  const endRecord = () => {
    record.push(field);
    records.push(record);
    record = [];
    field = "";
  };
  while (index < text.length && records.length < limit) {
    const char = text[index] as string;
    if (char === '"' && field === "") {
      const quoted = readQuoted(text, index + 1);
      field = quoted.value;
      index = quoted.end;
    } else if (char === delimiter) {
      record.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") {
        index += 1;
      }
      endRecord();
    } else {
      field += char;
    }
    index += 1;
  }
  if ((field !== "" || record.length > 0) && records.length < limit) {
    endRecord();
  }
  return records;
}

const isBlankRecord = (record: readonly string[]) =>
  record.every((value) => value.trim() === "");

/** The delimiter splitting the first lines into the most, and most consistent, fields. */
export function detectCsvDelimiter(text: string): CsvDelimiter {
  const sample = text.startsWith(BOM) ? text.slice(1) : text;
  let best: { delimiter: CsvDelimiter; score: number } = {
    delimiter: ",",
    score: 0,
  };
  for (const delimiter of CSV_DELIMITERS) {
    const counts = csvRecords(sample, delimiter, DETECTION_LINES)
      .filter((record) => !isBlankRecord(record))
      .map((record) => record.length);
    const fields = Math.min(...counts);
    const consistent = counts.every((count) => count === counts[0]);
    // Consistent splits beat irregular ones; one field means no split at all.
    const score = fields > 1 ? fields * (consistent ? 2 : 1) : 0;
    if (score > best.score) {
      best = { delimiter, score };
    }
  }
  return best.delimiter;
}

const defaultColumnName = (index: number) => `Column ${index + 1}`;

/** Headers and rows of CSV text; blank lines are ignored and rows padded to the headers. */
export function parseCsv(
  text: string,
  options: ParseCsvOptions = {}
): ParsedCsv {
  const source = text.startsWith(BOM) ? text.slice(1) : text;
  const delimiter = options.delimiter ?? detectCsvDelimiter(source);
  const records = csvRecords(source, delimiter).filter(
    (record) => !isBlankRecord(record)
  );
  const width = Math.max(0, ...records.map((record) => record.length));
  const name = options.columnName ?? defaultColumnName;
  const withHeaders = options.headers !== false;
  const first = withHeaders ? (records[0] ?? []) : [];
  const headers = Array.from({ length: width }, (_, index) => {
    const header = (first[index] ?? "").trim();
    return header || name(index);
  });
  const rows = (withHeaders ? records.slice(1) : records).map((record) =>
    Array.from({ length: width }, (_, index) => record[index] ?? "")
  );
  return { headers, rows, delimiter };
}

// Windows-1252 characters for bytes 0x80–0x9F (0 where the code page has none).
const CP1252_HIGH = [
  0x20_ac, 0, 0x20_1a, 0x01_92, 0x20_1e, 0x20_26, 0x20_20, 0x20_21, 0x02_c6,
  0x20_30, 0x01_60, 0x20_39, 0x01_52, 0, 0x01_7d, 0, 0, 0x20_18, 0x20_19,
  0x20_1c, 0x20_1d, 0x20_22, 0x20_13, 0x20_14, 0x02_dc, 0x21_22, 0x01_61,
  0x20_3a, 0x01_53, 0, 0x01_7e, 0x01_78,
];
const CP1252_HIGH_START = 0x80;
const CP1252_HIGH_END = 0x9f;

/** Windows-1252 decoding, independent of the runtime's TextDecoder labels. */
function decodeWindows1252(view: Uint8Array): string {
  let text = "";
  for (const byte of view) {
    const high =
      byte >= CP1252_HIGH_START && byte <= CP1252_HIGH_END
        ? CP1252_HIGH[byte - CP1252_HIGH_START]
        : 0;
    text += String.fromCharCode(high || byte);
  }
  return text;
}

/** UTF-8 text of a file, or windows-1252 when the bytes are not valid UTF-8 (older Excel exports). */
export function decodeCsvFile(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(view);
  } catch {
    return decodeWindows1252(view);
  }
}

// Columns and fields -----------------------------------------------------------

/** A table column as the import sees it. */
export interface ImportColumn {
  id: string;
  header: string;
  type?: string;
  /** Choices of select and multiSelect columns. */
  options?: readonly { value: unknown; label?: string }[];
  numberFormat?: unknown;
  required?: boolean;
  /** Unknown choices are kept as new options instead of failing. */
  allowNewOptions?: boolean;
}

/** A source field: a CSV header, a Notion property… with sample values. */
export interface ImportField {
  name: string;
  sample: string[];
}

export type ImportMapping = { field: string; columnId: string | null }[];

/** Option value that leaves a source field out of the import. */
export const IMPORT_IGNORE = "__yayaw_ignore__";

const SAMPLE_SIZE = 20;

/** One field per header, with up to 20 non-empty values. */
export function importFields(
  table: { headers: readonly string[]; rows: readonly (readonly string[])[] },
  sampleSize = SAMPLE_SIZE
): ImportField[] {
  return table.headers.map((name, index) => ({
    name,
    sample: table.rows
      .map((row) => (row[index] ?? "").trim())
      .filter(Boolean)
      .slice(0, sampleSize),
  }));
}

// Values -----------------------------------------------------------------------

export type ImportErrorCode =
  | "required"
  | "invalid_number"
  | "invalid_date"
  | "invalid_boolean"
  | "unknown_option"
  | "invalid_url"
  | "invalid_email"
  | "invalid_json"
  | "duplicate_key";

export type ImportValueResult = { value: unknown } | { error: ImportErrorCode };

export type DateOrder = "dmy" | "mdy";

export interface CoerceOptions {
  locale?: string;
  /** Day or month first for dates like 03/04/2026; detected from the column when left out. */
  dateOrder?: DateOrder;
  /** Keep unknown choices instead of failing (also per column). */
  allowNewOptions?: boolean;
}

const TRUE_WORDS = new Set([
  "true",
  "yes",
  "y",
  "oui",
  "o",
  "vrai",
  "1",
  "x",
  "on",
  "checked",
  "✓",
  "✔",
]);
const FALSE_WORDS = new Set([
  "false",
  "no",
  "n",
  "non",
  "faux",
  "0",
  "off",
  "unchecked",
]);
const NUMBER_NOISE = /[^\d.,\-+()]/g;
const NUMBER_SHAPE = /^[-+]?(\d+\.?\d*|\.\d+)$/;
const SCIENTIFIC = /^[-+]?\d+(\.\d+)?[eE][-+]?\d+$/;
const PARENTHESES = /[()]/g;
const THREE_DIGITS_AFTER = /^\d{1,3}([.,])\d{3}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ISO_DATE =
  /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;
const PARTS_DATE =
  /^(\d{1,4})[/.-](\d{1,2})[/.-](\d{1,4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;
const EXCEL_SERIAL = /^\d{1,5}(\.\d+)?$/;
const HAS_LETTERS = /\p{L}/u;
const LIST_SEPARATOR = /[;,|\n]/;
const MS_PER_DAY = 86_400_000;
// Excel's day 0 is 1899-12-30 once its 1900 leap-year bug is accounted for.
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);
const MAX_EXCEL_SERIAL = 2_958_465;

/** The locale's decimal separator ("," in French, "." in English). */
function localeDecimal(locale?: string): string {
  try {
    return (
      new Intl.NumberFormat(locale)
        .formatToParts(1.5)
        .find((part) => part.type === "decimal")?.value ?? "."
    );
  } catch {
    return ".";
  }
}

const numberFormatOf = (column: ImportColumn): Record<string, unknown> =>
  column.numberFormat && typeof column.numberFormat === "object"
    ? (column.numberFormat as Record<string, unknown>)
    : {};

/** Which of "," and "." is the decimal separator in `text`. */
function decimalSeparator(
  text: string,
  column: ImportColumn,
  locale?: string
): string {
  const configured = numberFormatOf(column).decimalSeparator;
  if (configured === "," || configured === ".") {
    return configured;
  }
  const comma = text.lastIndexOf(",");
  const dot = text.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    return comma > dot ? "," : ".";
  }
  const separator = comma >= 0 ? "," : ".";
  if (text.split(separator).length > 2) {
    // "1.234.567": repeated, so grouping.
    return separator === "," ? "." : ",";
  }
  // "1,234" is a thousand unless the locale writes decimals with a comma.
  if (THREE_DIGITS_AFTER.test(text) && localeDecimal(locale) !== separator) {
    return separator === "," ? "." : ",";
  }
  return separator;
}

function parseNumber(
  raw: string,
  column: ImportColumn,
  locale?: string
): number | undefined {
  if (SCIENTIFIC.test(raw)) {
    return Number(raw);
  }
  const percent = raw.includes("%");
  const cleaned = raw.replace(NUMBER_NOISE, "");
  const negative =
    (cleaned.startsWith("(") && cleaned.endsWith(")")) ||
    raw.trim().startsWith("−");
  const digits = cleaned.replace(PARENTHESES, "");
  if (!digits) {
    return;
  }
  const decimal = decimalSeparator(digits, column, locale);
  const grouping = decimal === "," ? "." : ",";
  const normalized = digits.split(grouping).join("").replace(decimal, ".");
  if (!NUMBER_SHAPE.test(normalized)) {
    return;
  }
  const value = Number(normalized) * (negative ? -1 : 1);
  const format = numberFormatOf(column);
  const fractionPercent =
    format.style === "percent" && format.percentBase !== "whole";
  return percent && fractionPercent ? value / 100 : value;
}

const pad = (value: number) => String(value).padStart(2, "0");

const isValidDay = (year: number, month: number, day: number) => {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

interface DateParts {
  year: number;
  month: number;
  day: number;
  time?: string;
}

const fullYear = (year: number) => {
  if (year >= 100) {
    return year;
  }
  return year < 70 ? 2000 + year : 1900 + year;
};

function partsFromMatch(
  match: RegExpMatchArray,
  order: DateOrder
): DateParts | undefined {
  const [first, second, third] = [match[1], match[2], match[3]].map(Number) as [
    number,
    number,
    number,
  ];
  const time = match[4]
    ? `${pad(Number(match[4]))}:${match[5]}:${match[6] ?? "00"}`
    : undefined;
  if ((match[1] ?? "").length === 4) {
    return { year: first, month: second, day: third, time };
  }
  const year = fullYear(third);
  return order === "mdy"
    ? { year, month: first, day: second, time }
    : { year, month: second, day: first, time };
}

function excelDate(serial: number): DateParts & { iso: string } {
  const date = new Date(EXCEL_EPOCH + Math.round(serial * MS_PER_DAY));
  const iso = date.toISOString();
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    time: serial % 1 === 0 ? undefined : iso.slice(11, 19),
    iso,
  };
}

function dateParts(raw: string, order: DateOrder): DateParts | undefined {
  const iso = raw.match(ISO_DATE);
  if (iso) {
    if (iso[4]) {
      const parsed = new Date(raw.replace(" ", "T"));
      if (Number.isNaN(parsed.getTime())) {
        return;
      }
    }
    return partsFromMatch(iso, order);
  }
  const parts = raw.match(PARTS_DATE);
  if (parts) {
    return partsFromMatch(parts, order);
  }
  if (EXCEL_SERIAL.test(raw)) {
    const serial = Number(raw);
    return serial >= 1 && serial <= MAX_EXCEL_SERIAL
      ? excelDate(serial)
      : undefined;
  }
  if (HAS_LETTERS.test(raw)) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return {
        year: parsed.getFullYear(),
        month: parsed.getMonth() + 1,
        day: parsed.getDate(),
      };
    }
  }
}

/** Day-first unless the locale writes month first (en-US), or the column says otherwise. */
export function defaultDateOrder(locale?: string): DateOrder {
  try {
    const parts = new Intl.DateTimeFormat(locale).formatToParts(
      new Date(Date.UTC(2026, 10, 22))
    );
    const month = parts.findIndex((part) => part.type === "month");
    const day = parts.findIndex((part) => part.type === "day");
    return month >= 0 && day >= 0 && month < day ? "mdy" : "dmy";
  } catch {
    return "dmy";
  }
}

/** Day or month first for a whole column: a first part above 12 means days first, a second one months first. */
export function detectDateOrder(
  values: readonly string[],
  locale?: string
): DateOrder {
  let dayFirst = false;
  let monthFirst = false;
  for (const value of values) {
    const match = value.trim().match(PARTS_DATE);
    if (match && (match[1] ?? "").length <= 2) {
      dayFirst ||= Number(match[1]) > 12;
      monthFirst ||= Number(match[2]) > 12;
    }
  }
  if (dayFirst !== monthFirst) {
    return dayFirst ? "dmy" : "mdy";
  }
  return defaultDateOrder(locale);
}

function parseDate(
  raw: string,
  column: ImportColumn,
  options: CoerceOptions
): ImportValueResult {
  const parts = dateParts(
    raw,
    options.dateOrder ?? defaultDateOrder(options.locale)
  );
  if (!(parts && isValidDay(parts.year, parts.month, parts.day))) {
    return { error: "invalid_date" };
  }
  const day = `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
  const withTime =
    fieldTypeFamily(column.type) === "date" && column.type !== "date";
  if (!(parts.time || withTime)) {
    return { value: day };
  }
  const iso = raw.match(ISO_DATE);
  if (iso?.[7]) {
    return { value: new Date(raw.replace(" ", "T")).toISOString() };
  }
  return { value: `${day}T${parts.time ?? "00:00:00"}` };
}

const optionMatches = (
  option: { value: unknown; label?: string },
  text: string
): boolean => {
  const wanted = normalizeFieldName(text);
  return (
    normalizeFieldName(String(option.value)) === wanted ||
    (option.label !== undefined && normalizeFieldName(option.label) === wanted)
  );
};

function parseOption(
  raw: string,
  column: ImportColumn,
  allowNew: boolean
): ImportValueResult {
  if (!column.options?.length) {
    return { value: raw };
  }
  const option = column.options.find((item) => optionMatches(item, raw));
  if (option) {
    return { value: option.value };
  }
  return allowNew ? { value: raw } : { error: "unknown_option" };
}

function parseOptions(
  raw: string,
  column: ImportColumn,
  allowNew: boolean
): ImportValueResult {
  const values: unknown[] = [];
  for (const item of raw.split(LIST_SEPARATOR)) {
    const text = item.trim();
    if (text) {
      const result = parseOption(text, column, allowNew);
      if ("error" in result) {
        return result;
      }
      values.push(result.value);
    }
  }
  return { value: values };
}

function parseUrl(raw: string): ImportValueResult {
  const text = raw.startsWith("www.") ? `https://${raw}` : raw;
  try {
    const url = new URL(text);
    return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol)
      ? { value: text }
      : { error: "invalid_url" };
  } catch {
    return { error: "invalid_url" };
  }
}

function parseJson(raw: string): ImportValueResult {
  try {
    return { value: JSON.parse(raw) };
  } catch {
    return { error: "invalid_json" };
  }
}

function parseBoolean(raw: string): ImportValueResult {
  const word = raw.toLowerCase();
  if (TRUE_WORDS.has(word)) {
    return { value: true };
  }
  return FALSE_WORDS.has(word)
    ? { value: false }
    : { error: "invalid_boolean" };
}

const TEXT_TYPES = new Set(["url", "image", "email", "json", "code"]);

/** The column's parser key: a type family, or url, image, email, json. */
const parserFor = (column: ImportColumn): string => {
  const type = column.type ?? "text";
  if (TEXT_TYPES.has(type)) {
    return type === "image" ? "url" : type;
  }
  return fieldTypeFamily(type) ?? "text";
};

/**
 * One cell converted for a column: `{ value }` (`null` when empty) or
 * `{ error }` with a code the screens translate.
 */
export function coerceImportValue(
  raw: string | null | undefined,
  column: ImportColumn,
  options: CoerceOptions = {}
): ImportValueResult {
  const text = (raw ?? "").trim();
  if (!text) {
    return column.required ? { error: "required" } : { value: null };
  }
  const allowNew = Boolean(options.allowNewOptions || column.allowNewOptions);
  switch (parserFor(column)) {
    case "number": {
      const value = parseNumber(text, column, options.locale);
      return value === undefined ? { error: "invalid_number" } : { value };
    }
    case "date":
      return parseDate(text, column, options);
    case "boolean":
      return parseBoolean(text);
    case "select":
      return parseOption(text, column, allowNew);
    case "multi":
      return parseOptions(text, column, allowNew);
    case "url":
      return parseUrl(text);
    case "email":
      return EMAIL.test(text) ? { value: text } : { error: "invalid_email" };
    case "json":
      return parseJson(text);
    default:
      return { value: text };
  }
}

// Mapping ----------------------------------------------------------------------

const INFERENCE_THRESHOLD = 0.8;

/** Share of a field's samples a column converts; text columns never win on samples. */
function sampleScore(
  field: ImportField,
  column: ImportColumn,
  locale?: string
) {
  if (parserFor(column) === "text" || field.sample.length === 0) {
    return 0;
  }
  const options = { locale, dateOrder: detectDateOrder(field.sample, locale) };
  const converted = field.sample.filter(
    (value) => !("error" in coerceImportValue(value, column, options))
  ).length;
  return converted / field.sample.length;
}

/** The only unused column clearly converting a field's samples. */
function inferColumn(
  field: ImportField,
  columns: readonly ImportColumn[],
  used: ReadonlySet<string>,
  locale?: string
): string | null {
  const scored = columns
    .filter((column) => !used.has(column.id))
    .map((column) => ({
      id: column.id,
      score: sampleScore(field, column, locale),
    }))
    .filter((entry) => entry.score >= INFERENCE_THRESHOLD)
    .sort((left, right) => right.score - left.score);
  const [best, next] = scored;
  return best && !(next && next.score === best.score) ? best.id : null;
}

/** The type family a field's samples look like, to break ties between same-named columns. */
function sampleType(field: ImportField, locale?: string): string | undefined {
  if (field.sample.length === 0) {
    return;
  }
  for (const type of ["number", "date", "boolean"]) {
    if (sampleScore(field, { id: "", header: "", type }, locale) === 1) {
      return type;
    }
  }
}

/**
 * Each field to the column answering to its name (header or id; accents, case
 * and separators ignored), same-typed columns first, each column used once.
 * Fields no name matches go to the one remaining column converting their
 * samples; the others are ignored (`null`).
 */
export function defaultImportMapping(
  fields: readonly ImportField[],
  columns: readonly ImportColumn[],
  options: { locale?: string } = {}
): ImportMapping {
  const matches = matchFieldsByName(
    fields.map((field) => ({
      key: field.name,
      names: [field.name],
      type: sampleType(field, options.locale),
    })),
    columns.map((column) => ({
      key: column.id,
      names: [column.header, column.id],
      type: column.type,
    }))
  );
  const used = new Set(matches.filter((id): id is string => Boolean(id)));
  return fields.map((field, index) => {
    const matched = matches[index] ?? null;
    if (matched) {
      return { field: field.name, columnId: matched };
    }
    const inferred = inferColumn(field, columns, used, options.locale);
    if (inferred) {
      used.add(inferred);
    }
    return { field: field.name, columnId: inferred };
  });
}

/** A key column when one of the mapped columns is an id; otherwise none. */
export function defaultImportKey(
  mapping: ImportMapping,
  columns: readonly ImportColumn[]
): string | null {
  const mapped = new Set(mapping.map((entry) => entry.columnId));
  const id = columns.find(
    (column) =>
      mapped.has(column.id) &&
      ["id", "key", "yayaw id"].includes(normalizeFieldName(column.id))
  );
  return id?.id ?? null;
}

// Plan -------------------------------------------------------------------------

export interface ImportRowValues {
  /** 0-based index of the data row in the source. */
  rowIndex: number;
  values: Record<string, unknown>;
  /** Existing record to update. */
  id?: string;
}

export interface ImportCellError {
  rowIndex: number;
  columnId: string;
  code: ImportErrorCode;
  raw: string;
}

export interface ImportPlan {
  creates: ImportRowValues[];
  updates: ImportRowValues[];
  errors: ImportCellError[];
  /** Data rows with at least one error. */
  errorRows: number[];
  /** Rows with nothing to write. */
  skipped: number[];
}

export interface PlanImportInput {
  rows: readonly (readonly string[])[];
  /** Source field names, in the order of the rows' cells. */
  fields: readonly string[];
  mapping: ImportMapping;
  columns: readonly ImportColumn[];
  keyColumnId?: string | null;
  /** The record id holding a key value, if any. */
  existing?: (key: string) => string | undefined;
  locale?: string;
  allowNewOptions?: boolean;
}

interface MappedColumn {
  column: ImportColumn;
  index: number;
  dateOrder: DateOrder;
}

function mappedColumns(input: PlanImportInput): MappedColumn[] {
  const byId = new Map(input.columns.map((column) => [column.id, column]));
  return input.mapping.flatMap((entry) => {
    const column = entry.columnId ? byId.get(entry.columnId) : undefined;
    const index = input.fields.indexOf(entry.field);
    if (!column || index < 0) {
      return [];
    }
    const values = input.rows.map((row) => row[index] ?? "");
    return [
      { column, index, dateOrder: detectDateOrder(values, input.locale) },
    ];
  });
}

const keyText = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value).trim();

interface PlannedRow {
  values: Record<string, unknown>;
  errors: ImportCellError[];
  empty: boolean;
}

function planRow(
  row: readonly string[],
  rowIndex: number,
  mapped: readonly MappedColumn[],
  input: PlanImportInput
): PlannedRow {
  const values: Record<string, unknown> = {};
  const errors: ImportCellError[] = [];
  let empty = true;
  for (const { column, index, dateOrder } of mapped) {
    const raw = row[index] ?? "";
    empty &&= raw.trim() === "";
    const result = coerceImportValue(raw, column, {
      locale: input.locale,
      dateOrder,
      allowNewOptions: input.allowNewOptions,
    });
    if ("error" in result) {
      errors.push({ rowIndex, columnId: column.id, code: result.error, raw });
    } else if (result.value !== null) {
      values[column.id] = result.value;
    }
  }
  return { values, errors, empty };
}

/** Required errors do not apply to updates: an empty cell leaves the value unchanged. */
const updateErrors = (errors: ImportCellError[]) =>
  errors.filter((error) => error.code !== "required");

/**
 * What an import will do: rows whose key matches a record update it (empty
 * cells keep their value), the others are created. A key repeated in the
 * file is an error on its later rows.
 */
export function planImport(input: PlanImportInput): ImportPlan {
  const mapped = mappedColumns(input);
  const plan: ImportPlan = {
    creates: [],
    updates: [],
    errors: [],
    errorRows: [],
    skipped: [],
  };
  const seenKeys = new Set<string>();
  for (const [rowIndex, row] of input.rows.entries()) {
    const planned = planRow(row, rowIndex, mapped, input);
    if (planned.empty) {
      plan.skipped.push(rowIndex);
    } else {
      addPlannedRow(plan, planned, rowIndex, input, seenKeys);
    }
  }
  return plan;
}

/** Adds a non-empty row as a create or an update, with its errors. */
function addPlannedRow(
  plan: ImportPlan,
  planned: PlannedRow,
  rowIndex: number,
  input: PlanImportInput,
  seenKeys: Set<string>
): void {
  const keyColumnId = input.keyColumnId ?? null;
  const key = keyColumnId ? keyText(planned.values[keyColumnId]) : "";
  const id = key ? input.existing?.(key) : undefined;
  const errors = id ? updateErrors(planned.errors) : planned.errors;
  if (keyColumnId && key && seenKeys.has(key)) {
    errors.push({
      rowIndex,
      columnId: keyColumnId,
      code: "duplicate_key",
      raw: key,
    });
  }
  if (key) {
    seenKeys.add(key);
  }
  if (errors.length > 0) {
    plan.errors.push(...errors);
    plan.errorRows.push(rowIndex);
  }
  if (id) {
    plan.updates.push({ rowIndex, values: planned.values, id });
  } else {
    plan.creates.push({ rowIndex, values: planned.values });
  }
}

export interface ImportSummary {
  creates: number;
  updates: number;
  errorRows: number;
  skipped: number;
}

/** Counts shown before importing; rows with errors are left out when skipped. */
export function summarizeImport(
  plan: ImportPlan,
  options: { skipErrors?: boolean } = {}
): ImportSummary {
  const failing = new Set(plan.errorRows);
  const count = (rows: ImportRowValues[]) =>
    options.skipErrors === false
      ? rows.length
      : rows.filter((row) => !failing.has(row.rowIndex)).length;
  return {
    creates: count(plan.creates),
    updates: count(plan.updates),
    errorRows: plan.errorRows.length,
    skipped: plan.skipped.length,
  };
}

// Run --------------------------------------------------------------------------

export interface ImportBatch {
  creates: ImportRowValues[];
  updates: (ImportRowValues & { id: string })[];
}

export interface ImportRowFailure {
  rowIndex: number;
  message?: string;
}

/** What the host's bulk import reports for one batch. */
export interface ImportBatchResult {
  created?: number;
  updated?: number;
  failures?: ImportRowFailure[];
}

interface ActionResult {
  success: boolean;
  error?: string;
}

export interface ImportAdapters {
  /** Server-side bulk write, preferred when provided. */
  importRows?: (batch: ImportBatch) => MaybePromise<ImportBatchResult>;
  create?: (values: Record<string, unknown>) => MaybePromise<ActionResult>;
  update?: (
    id: string,
    values: Record<string, unknown>
  ) => MaybePromise<ActionResult>;
}

export interface ImportRunOptions {
  batchSize?: number;
  /** Leave rows with errors out (default); otherwise nothing runs while errors remain. */
  skipErrors?: boolean;
  signal?: AbortSignal;
  onProgress?: (progress: { done: number; total: number }) => void;
}

export interface ImportRunResult {
  created: number;
  updated: number;
  failed: number;
  failures: ImportRowFailure[];
  aborted: boolean;
}

const DEFAULT_BATCH_SIZE = 50;
const AUTH_STATUSES = new Set([401, 403]);
const AUTH_CODES = new Set([
  "unauthorized",
  "forbidden",
  "invalid_credentials",
]);

/** Sign-in and permission errors stop an import; the others fail their rows only. */
export function isImportAuthError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const { status, code } = error as { status?: unknown; code?: unknown };
  return (
    (typeof status === "number" && AUTH_STATUSES.has(status)) ||
    (typeof code === "string" && AUTH_CODES.has(code))
  );
}

const errorMessage = (error: unknown): string | undefined => {
  if (error instanceof Error) {
    return error.message;
  }
  return typeof error === "string" ? error : undefined;
};

/** The planned rows to write, in source order, as batches. */
export function importBatches(
  plan: ImportPlan,
  options: Pick<ImportRunOptions, "batchSize" | "skipErrors"> = {}
): ImportBatch[] {
  const failing = new Set(options.skipErrors === false ? [] : plan.errorRows);
  const rows = [
    ...plan.creates.map((row) => ({ row, update: false })),
    ...plan.updates.map((row) => ({ row, update: true })),
  ]
    .filter(({ row }) => !failing.has(row.rowIndex))
    .sort((left, right) => left.row.rowIndex - right.row.rowIndex);
  const size = Math.max(1, options.batchSize ?? DEFAULT_BATCH_SIZE);
  const batches: ImportBatch[] = [];
  for (let start = 0; start < rows.length; start += size) {
    const slice = rows.slice(start, start + size);
    batches.push({
      creates: slice.filter((item) => !item.update).map((item) => item.row),
      updates: slice
        .filter((item) => item.update)
        .map((item) => item.row as ImportRowValues & { id: string }),
    });
  }
  return batches;
}

const batchRows = (batch: ImportBatch) =>
  batch.creates.length + batch.updates.length;

async function writeRow(
  write: () => MaybePromise<ActionResult>,
  rowIndex: number
): Promise<ImportRowFailure | null> {
  try {
    const result = await write();
    return result.success ? null : { rowIndex, message: result.error };
  } catch (error) {
    if (isImportAuthError(error)) {
      throw error;
    }
    return { rowIndex, message: errorMessage(error) };
  }
}

/** One batch through the table's own create and update actions. */
async function writeWithActions(
  batch: ImportBatch,
  adapters: ImportAdapters
): Promise<Required<ImportBatchResult>> {
  const { create, update } = adapters;
  const missing = (rowIndex: number) => Promise.resolve({ rowIndex });
  const creates = batch.creates.map((row) =>
    create
      ? writeRow(() => create(row.values), row.rowIndex)
      : missing(row.rowIndex)
  );
  const updates = batch.updates.map((row) =>
    update
      ? writeRow(() => update(row.id, row.values), row.rowIndex)
      : missing(row.rowIndex)
  );
  const [created, updated] = await Promise.all([
    Promise.all(creates),
    Promise.all(updates),
  ]);
  return {
    created: created.filter((failure) => !failure).length,
    updated: updated.filter((failure) => !failure).length,
    failures: [...created, ...updated].filter(
      (failure): failure is ImportRowFailure => Boolean(failure)
    ),
  };
}

async function writeBatch(
  batch: ImportBatch,
  adapters: ImportAdapters
): Promise<Required<ImportBatchResult>> {
  if (!adapters.importRows) {
    return await writeWithActions(batch, adapters);
  }
  try {
    const result = await adapters.importRows(batch);
    const failures = result.failures ?? [];
    return {
      created: result.created ?? 0,
      updated: result.updated ?? 0,
      failures,
    };
  } catch (error) {
    if (isImportAuthError(error)) {
      throw error;
    }
    const message = errorMessage(error);
    return {
      created: 0,
      updated: 0,
      failures: [...batch.creates, ...batch.updates].map((row) => ({
        rowIndex: row.rowIndex,
        message,
      })),
    };
  }
}

/**
 * Writes a plan batch after batch, reporting progress. Failed rows are
 * collected; only sign-in and permission errors stop it (and throw). An
 * aborted import stops between batches.
 */
export async function runImport(
  plan: ImportPlan,
  adapters: ImportAdapters,
  options: ImportRunOptions = {}
): Promise<ImportRunResult> {
  const batches = importBatches(plan, options);
  const total = batches.reduce((sum, batch) => sum + batchRows(batch), 0);
  const result: ImportRunResult = {
    created: 0,
    updated: 0,
    failed: 0,
    failures: [],
    aborted: false,
  };
  let done = 0;
  options.onProgress?.({ done, total });
  for (const batch of batches) {
    if (options.signal?.aborted) {
      result.aborted = true;
      break;
    }
    const written = await writeBatch(batch, adapters);
    result.created += written.created;
    result.updated += written.updated;
    result.failed += written.failures.length;
    result.failures.push(...written.failures);
    done += batchRows(batch);
    options.onProgress?.({ done, total });
  }
  return result;
}

/** Record ids by key value, from rows already loaded. */
export function existingLookupFromRows(
  rows: readonly Record<string, unknown>[],
  columnId: string,
  rowId: (row: Record<string, unknown>, index: number) => string
): (key: string) => string | undefined {
  const ids = new Map<string, string>();
  for (const [index, row] of rows.entries()) {
    const key = keyText(row[columnId]);
    if (key && !ids.has(key)) {
      ids.set(key, rowId(row, index));
    }
  }
  return (key) => ids.get(key.trim());
}
