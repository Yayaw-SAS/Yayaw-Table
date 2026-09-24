import { format as formatPattern, isValid, parseISO } from "date-fns";

/**
 * Number and date formatting shared by the React and Vue editions, so a
 * column configured once renders the same text in both.
 */

/** Grouping presets kept from the first React contract. */
export type NumberFormatPreset = "comma" | "dot" | "locale" | "space";

export interface ColumnNumberFormat {
  /** Intl style. Setting `currency` implies `"currency"`. */
  style?: "compact" | "currency" | "decimal" | "percent" | "unit";
  /** BCP 47 locale; defaults to the table locale. */
  locale?: string;
  /** ISO 4217 code such as `"EUR"`. */
  currency?: string;
  currencyDisplay?: "code" | "name" | "narrowSymbol" | "symbol";
  /** Intl unit such as `"kilogram"` or `"kilometer-per-hour"`. */
  unit?: string;
  unitDisplay?: "long" | "narrow" | "short";
  /** Fixed decimals. `decimalPlaces` is the earlier Vue name. */
  decimals?: number;
  decimalPlaces?: number;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  /** Replaces the locale's grouping separator; `"none"` removes grouping. */
  thousandsSeparator?: string;
  /** Replaces the locale's decimal separator. */
  decimalSeparator?: string;
  prefix?: string;
  suffix?: string;
  signDisplay?: "always" | "auto" | "exceptZero" | "never";
  /** `"parentheses"` shows negatives as (1,234.00), as in accounting. */
  negative?: "minus" | "parentheses";
  /** Percent input: `"fraction"` (0.25 = 25%, default) or `"whole"` (25 = 25%). */
  percentBase?: "fraction" | "whole";
  /** Render a progress bar beside the value, filled against `max`. */
  display?: "bar" | "number";
  /** Full-bar value; defaults to 1 for fraction percents and 100 otherwise. */
  max?: number;
}

export type NumberFormatConfig = ColumnNumberFormat | NumberFormatPreset;

const PRESET_SEPARATORS: Record<
  Exclude<NumberFormatPreset, "locale">,
  { thousandsSeparator: string; decimalSeparator: string; decimals: number }
> = {
  space: { thousandsSeparator: " ", decimalSeparator: ".", decimals: 2 },
  dot: { thousandsSeparator: ".", decimalSeparator: ",", decimals: 2 },
  comma: { thousandsSeparator: ",", decimalSeparator: ".", decimals: 2 },
};

/**
 * Presets become explicit options; objects pass through. The `"locale"`
 * preset keeps its historical two decimals at most.
 */
export function resolveNumberFormat(
  config: NumberFormatConfig | undefined
): ColumnNumberFormat {
  if (config === undefined) {
    return {};
  }
  if (config === "locale") {
    return { maximumFractionDigits: 2 };
  }
  return typeof config === "string" ? PRESET_SEPARATORS[config] : config;
}

function numberStyle(options: ColumnNumberFormat): Intl.NumberFormatOptions {
  const style = options.style ?? (options.currency ? "currency" : "decimal");
  if (style === "compact") {
    return { notation: "compact" };
  }
  if (style === "currency") {
    return {
      style,
      currency: options.currency ?? "USD",
      currencyDisplay: options.currencyDisplay,
    };
  }
  if (style === "unit") {
    return { style, unit: options.unit, unitDisplay: options.unitDisplay };
  }
  return { style };
}

function fractionDigits(options: ColumnNumberFormat): Intl.NumberFormatOptions {
  const fixed = options.decimals ?? options.decimalPlaces;
  if (fixed !== undefined) {
    return { minimumFractionDigits: fixed, maximumFractionDigits: fixed };
  }
  return {
    minimumFractionDigits: options.minimumFractionDigits,
    maximumFractionDigits: options.maximumFractionDigits,
  };
}

/** The value Intl receives: whole percents are divided by 100. */
function intlValue(value: number, options: ColumnNumberFormat): number {
  return options.style === "percent" && options.percentBase === "whole"
    ? value / 100
    : value;
}

export function formatNumberValue(
  value: unknown,
  config?: NumberFormatConfig,
  fallbackLocale?: string
): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return String(value);
  }
  const options = resolveNumberFormat(config);
  const parentheses = options.negative === "parentheses" && numeric < 0;
  const formatter = new Intl.NumberFormat(options.locale ?? fallbackLocale, {
    ...numberStyle(options),
    ...fractionDigits(options),
    signDisplay: parentheses ? "never" : options.signDisplay,
    useGrouping: options.thousandsSeparator !== "none",
  });
  const text = formatter
    .formatToParts(intlValue(parentheses ? -numeric : numeric, options))
    .map((part) => {
      if (part.type === "group" && options.thousandsSeparator !== undefined) {
        return options.thousandsSeparator === "none"
          ? ""
          : options.thousandsSeparator;
      }
      if (part.type === "decimal" && options.decimalSeparator !== undefined) {
        return options.decimalSeparator;
      }
      return part.value;
    })
    .join("");
  const affixed = `${options.prefix ?? ""}${text}${options.suffix ?? ""}`;
  return parentheses ? `(${affixed})` : affixed;
}

/** Fill ratio from 0 to 1 for the `display: "bar"` rendering. */
export function numberBarRatio(
  value: unknown,
  config?: NumberFormatConfig
): number | undefined {
  const options = resolveNumberFormat(config);
  const numeric = typeof value === "number" ? value : Number(value);
  if (options.display !== "bar" || !Number.isFinite(numeric)) {
    return;
  }
  const fraction =
    options.style === "percent" && options.percentBase !== "whole";
  const max = options.max ?? (fraction ? 1 : 100);
  return max > 0 ? Math.min(1, Math.max(0, numeric / max)) : 0;
}

/** Every date preset understood by both editions. */
export const DATE_DISPLAY_PRESETS = [
  "localized-short",
  "localized-medium",
  "localized-long",
  "month-name-long",
  "month-year",
  "dmy-numeric",
  "dmy-short",
  "mdy-numeric",
  "mdy-short",
  "iso-date",
  "iso",
  "date",
  "short",
  "long",
  "dateTime",
  "time",
  "relative",
] as const;

export type DateDisplayPreset = (typeof DATE_DISPLAY_PRESETS)[number];

export interface ColumnDateFormat {
  preset?: DateDisplayPreset;
  /** date-fns pattern such as `"dd MMM yyyy"`; wins over the preset. */
  pattern?: string;
  locale?: string;
  /**
   * IANA zone such as `"Europe/Paris"`, for presets and patterns alike.
   * Date-only values are calendar days and never shift.
   */
  timeZone?: string;
  /** Force a 12- or 24-hour clock where a time is shown. */
  hour12?: boolean;
  /** Reference instant for `"relative"`, mainly for tests. */
  now?: Date;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Date-only strings are calendar days in local time; other values are instants. */
export function parseDateValue(value: unknown): Date | undefined {
  if (value === null || value === undefined || value === "") {
    return;
  }
  let date: Date;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === "string") {
    date = DATE_ONLY.test(value)
      ? new Date(`${value}T00:00:00`)
      : parseISO(value);
    if (!isValid(date)) {
      // Formats the browser accepted before, such as "2026/09/05".
      date = new Date(value);
    }
  } else {
    date = new Date(value as number);
  }
  return isValid(date) ? date : undefined;
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3600],
  ["minute", 60],
  ["second", 1],
];

function relative(date: Date, locale: string | undefined, now: Date): string {
  const seconds = (date.getTime() - now.getTime()) / 1000;
  const [unit, size] = RELATIVE_UNITS.find(
    ([, length]) => Math.abs(seconds) >= length
  ) ??
    RELATIVE_UNITS.at(-1) ?? ["second", 1];
  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
    Math.round(seconds / size),
    unit
  );
}

const INTL_PRESETS: Partial<
  Record<DateDisplayPreset, Intl.DateTimeFormatOptions>
> = {
  "localized-short": { dateStyle: "short" },
  short: { dateStyle: "short" },
  "localized-medium": { dateStyle: "medium" },
  date: { dateStyle: "medium" },
  "localized-long": { dateStyle: "long" },
  long: { dateStyle: "full" },
  "month-name-long": { day: "2-digit", month: "long", year: "numeric" },
  "month-year": { month: "long", year: "numeric" },
  dateTime: { dateStyle: "medium", timeStyle: "short" },
  time: { timeStyle: "short" },
};

function numericParts(date: Date, timeZone?: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone,
  }).formatToParts(date);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return { day: get("day"), month: get("month"), year: get("year") };
}

function numericPreset(
  preset: DateDisplayPreset,
  date: Date,
  timeZone?: string
): string | undefined {
  const { day, month, year } = numericParts(date, timeZone);
  const short = year.slice(-2);
  switch (preset) {
    case "dmy-numeric":
      return `${day}/${month}/${year}`;
    case "dmy-short":
      return `${day}/${month}/${short}`;
    case "mdy-numeric":
      return `${month}/${day}/${year}`;
    case "mdy-short":
      return `${month}/${day}/${short}`;
    case "iso-date":
      return `${year}-${month}-${day}`;
    default:
      return;
  }
}

const KNOWN_TIME_ZONES = new Map<string, boolean>();

/** The zone when Intl knows it; an unknown zone shows local time. */
function knownTimeZone(timeZone: string | undefined): string | undefined {
  if (!timeZone) {
    return;
  }
  let known = KNOWN_TIME_ZONES.get(timeZone);
  if (known === undefined) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone }).format(0);
      known = true;
    } catch {
      known = false;
    }
    KNOWN_TIME_ZONES.set(timeZone, known);
  }
  return known ? timeZone : undefined;
}

/** A date-only string is a calendar day: no time zone moves it. */
function isCalendarDay(value: unknown): boolean {
  return typeof value === "string" && DATE_ONLY.test(value);
}

/**
 * The wall-clock time of an instant in `timeZone`, as a local Date, so a
 * date-fns pattern prints the zone's day and hour.
 */
function wallClock(date: Date, timeZone: string): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((item) => item.type === type)?.value ?? 0);
  const local = new Date(date.getTime());
  local.setFullYear(part("year"), part("month") - 1, part("day"));
  local.setHours(
    part("hour"),
    part("minute"),
    part("second"),
    date.getMilliseconds()
  );
  return local;
}

function formatWithPattern(
  date: Date,
  pattern: string,
  timeZone: string | undefined
): string | undefined {
  try {
    return formatPattern(timeZone ? wallClock(date, timeZone) : date, pattern);
  } catch {
    // A pattern date-fns rejects falls back to the preset.
    return;
  }
}

/**
 * A date as its column shows it: the pattern wins over the preset, and
 * `timeZone` applies to both. Date-only values are calendar days that no
 * zone shifts.
 */
export function formatDateValue(
  value: unknown,
  options: ColumnDateFormat = {}
): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  const date = parseDateValue(value);
  if (!date) {
    return String(value);
  }
  const timeZone = isCalendarDay(value)
    ? undefined
    : knownTimeZone(options.timeZone);
  const patterned = options.pattern
    ? formatWithPattern(date, options.pattern, timeZone)
    : undefined;
  if (patterned !== undefined) {
    return patterned;
  }
  const preset = options.preset ?? "localized-short";
  if (preset === "iso") {
    return date.toISOString();
  }
  if (preset === "relative") {
    return relative(date, options.locale, options.now ?? new Date());
  }
  const numeric = numericPreset(preset, date, timeZone);
  if (numeric) {
    return numeric;
  }
  return new Intl.DateTimeFormat(options.locale, {
    ...(INTL_PRESETS[preset] ?? INTL_PRESETS["localized-short"]),
    hour12: options.hour12,
    timeZone,
  }).format(date);
}

/**
 * The format settings a column declares. React and Vue column definitions
 * both fit, so every surface formats a field from the same declaration.
 */
export interface ColumnValueFormat {
  type?: string;
  numberFormat?: NumberFormatConfig;
  dateDisplayPreset?: DateDisplayPreset;
  dateFormat?: string;
  timeZone?: string;
  hour12?: boolean;
}

/**
 * A column's date options: its pattern, else its preset, else the table's
 * default preset; its time zone and clock apply to each.
 */
export function columnDateFormat(
  column: ColumnValueFormat | undefined,
  locale?: string,
  fallbackPreset?: DateDisplayPreset
): ColumnDateFormat {
  return {
    preset: column?.dateDisplayPreset ?? fallbackPreset,
    pattern: column?.dateFormat || undefined,
    locale,
    timeZone: column?.timeZone,
    hour12: column?.hour12,
  };
}

/** date-fns tokens, literals and quoted text, as date-fns reads a pattern. */
const PATTERN_TOKENS =
  /[yYQqMLwIdDecihHKkms]o|(\w)\1*|''|'(?:''|[^'])+(?:'|$)|./g;
const DATE_TOKEN = /^[GyYRuQqMLwIdDEeciP]/;
const TIME_TOKEN = /^[aAbBhHKkmsSXxOztTp]/;

/**
 * The date part of a date-fns pattern, for values that are days (chart
 * buckets, filter dates): `"dd/MM/yyyy HH:mm"` gives `"dd/MM/yyyy"`.
 */
export function datePartOfPattern(pattern: string): string | undefined {
  const tokens = pattern.match(PATTERN_TOKENS) ?? [];
  const dated = tokens.map((token) => DATE_TOKEN.test(token));
  const first = dated.indexOf(true);
  const last = dated.lastIndexOf(true);
  if (first < 0) {
    return;
  }
  return tokens
    .slice(first, last + 1)
    .filter((token) => !TIME_TOKEN.test(token))
    .join("");
}

/** Presets that show a day without a time. */
const DAY_PRESETS = new Set<DateDisplayPreset>([
  "localized-short",
  "localized-medium",
  "localized-long",
  "month-name-long",
  "dmy-numeric",
  "dmy-short",
  "mdy-numeric",
  "mdy-short",
  "iso-date",
  "date",
  "short",
  "long",
]);

/**
 * How a column shows a calendar day (a chart day, a filter date): the date
 * part of its pattern or preset, never a time, and no zone shift.
 */
export function columnDayFormat(
  column: ColumnValueFormat | undefined,
  locale?: string,
  fallbackPreset?: DateDisplayPreset
): ColumnDateFormat {
  const preset = column?.dateDisplayPreset ?? fallbackPreset;
  let dayPreset: DateDisplayPreset = "localized-medium";
  if (preset && DAY_PRESETS.has(preset)) {
    dayPreset = preset;
  } else if (preset === "iso") {
    dayPreset = "iso-date";
  }
  return {
    preset: dayPreset,
    pattern: column?.dateFormat
      ? datePartOfPattern(column.dateFormat)
      : undefined,
    locale,
  };
}

/** A calendar day (`YYYY-MM-DD` or a local Date) in its column's day format. */
export function formatColumnDay(
  value: unknown,
  column: ColumnValueFormat | undefined,
  locale?: string,
  fallbackPreset?: DateDisplayPreset
): string {
  return formatDateValue(
    value,
    columnDayFormat(column, locale, fallbackPreset)
  );
}

/** A number in its column's format and the table locale. */
export function formatColumnNumber(
  value: unknown,
  column: ColumnValueFormat | undefined,
  locale?: string
): string {
  return formatNumberValue(value, column?.numberFormat, locale);
}

/** A date in its column's pattern or preset, time zone and clock. */
export function formatColumnDate(
  value: unknown,
  column: ColumnValueFormat | undefined,
  locale?: string,
  fallbackPreset?: DateDisplayPreset
): string {
  return formatDateValue(
    value,
    columnDateFormat(column, locale, fallbackPreset)
  );
}

/** Calculations whose result is a value of the column: same unit, same format. */
const VALUE_CALCULATIONS = new Set([
  "sum",
  "average",
  "median",
  "min",
  "max",
  "range",
]);

/**
 * A footer, group or widget calculation as people read it. Sums, averages,
 * medians, extremes and ranges keep the column's number format; a date
 * column's earliest and latest values keep its date format and its range
 * reads in days. Counts stay plain whole numbers and `percent_*` shares
 * (0–100) plain percents, in the table locale.
 */
export function formatColumnCalculation(
  value: unknown,
  calculation: string,
  column: ColumnValueFormat | undefined,
  locale?: string,
  fallbackPreset?: DateDisplayPreset
): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  const numeric = typeof value === "number" ? value : Number(value);
  if (calculation.startsWith("percent_")) {
    return Number.isFinite(numeric)
      ? new Intl.NumberFormat(locale, {
          style: "percent",
          maximumFractionDigits: 0,
        }).format(numeric / 100)
      : String(value);
  }
  if (!VALUE_CALCULATIONS.has(calculation)) {
    return Number.isFinite(numeric)
      ? new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(
          numeric
        )
      : String(value);
  }
  if (column?.type === "date") {
    if (calculation !== "range") {
      return formatColumnDate(value, column, locale, fallbackPreset);
    }
    return Number.isFinite(numeric)
      ? new Intl.NumberFormat(locale, {
          style: "unit",
          unit: "day",
          unitDisplay: "narrow",
          maximumFractionDigits: 0,
        }).format(numeric)
      : String(value);
  }
  return formatColumnNumber(value, column, locale);
}

/**
 * Number and date values in their column's format; `undefined` for the other
 * types, whose text (option labels, places, links) each surface owns.
 */
export function formatColumnValue(
  value: unknown,
  column: ColumnValueFormat | undefined,
  locale?: string,
  fallbackPreset?: DateDisplayPreset
): string | undefined {
  if (column?.type === "number") {
    return formatColumnNumber(value, column, locale);
  }
  if (column?.type === "date") {
    return formatColumnDate(value, column, locale, fallbackPreset);
  }
  return;
}

/**
 * Whether a card property has nothing to show (null, blank text, empty list);
 * compact board cards leave such properties out in both editions.
 */
export function isBlankCardValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === "string") {
    return value.trim() === "";
  }
  return Array.isArray(value) && value.length === 0;
}
