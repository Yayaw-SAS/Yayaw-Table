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
  /**
   * Row field holding each row's ISO 4217 code: cells read in their row's
   * currency (`currency` is the fallback) and sums, averages and extremes are
   * kept per currency, never mixed (`"1 200,00 € · 300,00 $"`).
   */
  currencyColumn?: string;
  /** Show calculations over several currencies as one converted total. */
  currencyConversion?: CurrencyConversion;
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

/**
 * Conversion of per-currency calculations into one currency. `rates` is
 * plain JSON (units of `currency` for one unit of each code); `convert` is an
 * optional host callback asked for codes without a rate. When any currency
 * cannot be converted, the per-currency amounts are shown instead.
 */
export interface CurrencyConversion {
  /** Target ISO 4217 code. */
  currency: string;
  rates?: Record<string, number>;
  convert?: (
    amount: number,
    from: string,
    to: string
  ) => number | null | undefined;
  /** `"converted"` (default) shows the total only, `"both"` adds the amounts. */
  display?: "both" | "converted";
}

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

const LOCAL_DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?$/;

/** Milliseconds `timeZone` is ahead of UTC at an instant. */
function zoneOffset(time: number, timeZone: string): number {
  const clock = wallClock(new Date(time), timeZone);
  const asUtc = Date.UTC(
    clock.getFullYear(),
    clock.getMonth(),
    clock.getDate(),
    clock.getHours(),
    clock.getMinutes(),
    clock.getSeconds(),
    clock.getMilliseconds()
  );
  return asUtc - time;
}

const twoDigits = (value: number) => String(value).padStart(2, "0");

/**
 * A date and time as a `datetime-local` input shows it, `YYYY-MM-DDTHH:mm`:
 * the wall-clock time of the instant in `timeZone` (the runtime's, the
 * viewer's in a browser, without one). A day alone reads as its midnight.
 * Empty when the value is not a date.
 */
export function dateTimeInputValue(value: unknown, timeZone?: string): string {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  if (typeof value === "string" && LOCAL_DATE_TIME.test(value.trim())) {
    // A wall-clock time without a zone is already what the input shows.
    return value.trim().slice(0, 16).replace(" ", "T");
  }
  const date = parseDateValue(value);
  if (!date) {
    return "";
  }
  const zone = isCalendarDay(value) ? undefined : knownTimeZone(timeZone);
  const clock = zone ? wallClock(date, zone) : date;
  return `${String(clock.getFullYear()).padStart(4, "0")}-${twoDigits(clock.getMonth() + 1)}-${twoDigits(clock.getDate())}T${twoDigits(clock.getHours())}:${twoDigits(clock.getMinutes())}`;
}

/**
 * The instant a `datetime-local` input names, as an ISO 8601 string in UTC
 * (`"2026-10-11T07:30:00.000Z"`): the input's wall-clock time read in
 * `timeZone` (the runtime's without one). Empty text gives `""`; text that is
 * not a date and time gives `undefined`.
 */
export function dateTimeFromInput(
  text: string,
  timeZone?: string
): string | undefined {
  const value = text.trim();
  if (!value) {
    return "";
  }
  const match = LOCAL_DATE_TIME.exec(value);
  if (!match) {
    const date = parseDateValue(value);
    return date ? date.toISOString() : undefined;
  }
  const [year, month, day, hour, minute, second] = match
    .slice(1)
    .map((part) => Number(part ?? 0));
  const zone = knownTimeZone(timeZone);
  if (!zone) {
    const local = new Date(
      year ?? 0,
      (month ?? 1) - 1,
      day ?? 1,
      hour ?? 0,
      minute ?? 0,
      second ?? 0
    );
    return Number.isFinite(local.getTime()) ? local.toISOString() : undefined;
  }
  const asUtc = Date.UTC(
    year ?? 0,
    (month ?? 1) - 1,
    day ?? 1,
    hour ?? 0,
    minute ?? 0,
    second ?? 0
  );
  // The zone's offset at the guess, then at the corrected instant (DST edges).
  const first = asUtc - zoneOffset(asUtc, zone);
  const instant = asUtc - zoneOffset(first, zone);
  return Number.isFinite(instant) ? new Date(instant).toISOString() : undefined;
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
  /** A date column whose values are a date and a time (ISO 8601 instants). */
  withTime?: boolean;
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
    preset:
      column?.dateDisplayPreset ??
      (column?.withTime ? "dateTime" : fallbackPreset),
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

const CURRENCY_CODE = /^[A-Z]{3}$/;

/** An ISO 4217 code in upper case, or `undefined` for anything else. */
export function currencyCode(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return;
  }
  const code = value.trim().toUpperCase();
  return CURRENCY_CODE.test(code) ? code : undefined;
}

/**
 * The currency a row's amount is in: the row's `currencyColumn` value, else
 * the column's fixed `currency`.
 */
export function rowCurrency(
  config: NumberFormatConfig | undefined,
  row?: Readonly<Record<string, unknown>>
): string | undefined {
  if (!config || typeof config === "string") {
    return;
  }
  const own =
    config.currencyColumn && row
      ? currencyCode(row[config.currencyColumn])
      : undefined;
  return own ?? currencyCode(config.currency);
}

/** The number format with the row's currency, when the column reads one. */
export function rowNumberFormat(
  config: NumberFormatConfig | undefined,
  row?: Readonly<Record<string, unknown>>
): NumberFormatConfig | undefined {
  if (!(config && typeof config !== "string" && config.currencyColumn)) {
    return config;
  }
  const currency = rowCurrency(config, row);
  return currency ? { ...config, currency } : config;
}

/**
 * A number in its column's format and the table locale; with the row, in the
 * row's currency when the column has a `currencyColumn`.
 */
export function formatColumnNumber(
  value: unknown,
  column: ColumnValueFormat | undefined,
  locale?: string,
  row?: Readonly<Record<string, unknown>>
): string {
  return formatNumberValue(
    value,
    rowNumberFormat(column?.numberFormat, row),
    locale
  );
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
  fallbackPreset?: DateDisplayPreset,
  row?: Readonly<Record<string, unknown>>
): string | undefined {
  if (column?.type === "number") {
    return formatColumnNumber(value, column, locale, row);
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

/** Amounts by ISO 4217 code; `""` holds rows without a currency. */
export type CurrencyAmounts = Record<string, number>;

/** A calculation kept per currency, with its converted total when possible. */
export interface CurrencyCalculationResult {
  /** The converted total, the only currency's value, or `null` when mixed. */
  raw: number | null;
  label: string;
  byCurrency: CurrencyAmounts;
  /** Set when `currencyConversion` converted every currency. */
  converted?: { currency: string; value: number };
}

const CURRENCY_SEPARATOR = " · ";
const NO_CURRENCY = "";

/** True when a column's calculations are kept per currency. */
export function hasCurrencyColumn(
  column: ColumnValueFormat | undefined
): boolean {
  const config = column?.numberFormat;
  return Boolean(config && typeof config !== "string" && config.currencyColumn);
}

/** One value calculation over sorted numbers; `null` without numbers. */
function numericCalculation(
  numbers: number[],
  calculation: string
): number | null {
  const first = numbers.at(0);
  const last = numbers.at(-1);
  if (first === undefined || last === undefined) {
    return null;
  }
  const sum = numbers.reduce((total, value) => total + value, 0);
  switch (calculation) {
    case "sum":
      return sum;
    case "average":
      return sum / numbers.length;
    case "median": {
      const middle = Math.floor(numbers.length / 2);
      const upper = numbers[middle] ?? last;
      return numbers.length % 2 === 0
        ? ((numbers[middle - 1] ?? upper) + upper) / 2
        : upper;
    }
    case "min":
      return first;
    case "max":
      return last;
    case "range":
      return last - first;
    default:
      return null;
  }
}

/** One amount in the target currency, or `undefined` without a rate. */
function convertAmount(
  amount: number,
  from: string,
  conversion: CurrencyConversion
): number | undefined {
  const target = currencyCode(conversion.currency);
  if (!(target && from)) {
    return;
  }
  if (from === target) {
    return amount;
  }
  const rate = conversion.rates?.[from];
  if (typeof rate === "number" && Number.isFinite(rate) && rate > 0) {
    return amount * rate;
  }
  const converted = conversion.convert?.(amount, from, target);
  return typeof converted === "number" && Number.isFinite(converted)
    ? converted
    : undefined;
}

/** Codes in a stable order: alphabetical, amounts without a currency last. */
const currencyOrder = (codes: Iterable<string>): string[] =>
  [...codes].sort((left, right) => {
    if (left === NO_CURRENCY || right === NO_CURRENCY) {
      return left === NO_CURRENCY ? 1 : -1;
    }
    return left.localeCompare(right);
  });

/** One amount in its currency, in the column's format otherwise. */
function formatCurrencyAmount(
  amount: number,
  code: string,
  calculation: string,
  column: ColumnValueFormat | undefined,
  locale?: string
): string {
  const config = resolveNumberFormat(column?.numberFormat);
  const numberFormat: ColumnNumberFormat = code
    ? { ...config, style: "currency", currency: code }
    : {
        ...config,
        style: config.style === "currency" ? "decimal" : config.style,
        currency: undefined,
      };
  return formatColumnCalculation(
    amount,
    calculation,
    { ...column, type: "number", numberFormat },
    locale
  );
}

/**
 * Per-currency amounts as people read them: one amount per currency joined
 * with " · ", or one converted total. Sums convert per currency; other
 * calculations convert only from the values (see `calculateCurrencyColumn`).
 */
export function formatCurrencyAmounts(
  byCurrency: CurrencyAmounts,
  calculation: string,
  column: ColumnValueFormat | undefined,
  locale?: string,
  converted?: { currency: string; value: number }
): string {
  const parts = currencyOrder(Object.keys(byCurrency)).map((code) =>
    formatCurrencyAmount(
      byCurrency[code] ?? 0,
      code,
      calculation,
      column,
      locale
    )
  );
  const breakdown = parts.length ? parts.join(CURRENCY_SEPARATOR) : "—";
  if (!converted) {
    return breakdown;
  }
  const total = formatCurrencyAmount(
    converted.value,
    converted.currency,
    calculation,
    column,
    locale
  );
  const config = column?.numberFormat;
  const both =
    config &&
    typeof config !== "string" &&
    config.currencyConversion?.display === "both";
  return both && parts.length > 1 ? `${total} (${breakdown})` : total;
}

/** The conversion a column declares, when it has a usable target. */
function columnConversion(
  column: ColumnValueFormat | undefined
): CurrencyConversion | undefined {
  const config = column?.numberFormat;
  if (!config || typeof config === "string" || !config.currencyConversion) {
    return;
  }
  return currencyCode(config.currencyConversion.currency)
    ? config.currencyConversion
    : undefined;
}

/**
 * Per-currency amounts a host computed (`actions.aggregate` answering
 * `byCurrency`): only sums add up across currencies, so only sums convert.
 */
export function currencyAmountsResult(
  byCurrency: CurrencyAmounts,
  calculation: string,
  column: ColumnValueFormat | undefined,
  locale?: string
): CurrencyCalculationResult {
  const amounts: CurrencyAmounts = {};
  for (const [code, amount] of Object.entries(byCurrency)) {
    const numeric = Number(amount);
    if (Number.isFinite(numeric)) {
      amounts[currencyCode(code) ?? NO_CURRENCY] = numeric;
    }
  }
  const codes = Object.keys(amounts);
  const conversion = columnConversion(column);
  let converted: CurrencyCalculationResult["converted"];
  if (conversion && calculation === "sum" && codes.length > 1) {
    const values = codes.map((code) =>
      convertAmount(amounts[code] ?? 0, code, conversion)
    );
    if (values.every((value) => value !== undefined)) {
      converted = {
        currency: currencyCode(conversion.currency) ?? conversion.currency,
        value: values.reduce<number>((total, value) => total + (value ?? 0), 0),
      };
    }
  }
  const only =
    codes.length === 1 ? amounts[codes[0] ?? NO_CURRENCY] : undefined;
  return {
    raw: converted?.value ?? only ?? null,
    label: formatCurrencyAmounts(
      amounts,
      calculation,
      column,
      locale,
      converted
    ),
    byCurrency: amounts,
    converted,
  };
}

const toFiniteNumber = (value: unknown): number | undefined => {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    typeof value === "boolean"
  ) {
    return;
  }
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
};

/** Finite values grouped by their row's currency. */
function valuesByCurrency(
  values: readonly unknown[],
  rows: readonly Readonly<Record<string, unknown>>[],
  column: ColumnValueFormat | undefined
): Map<string, number[]> {
  const grouped = new Map<string, number[]>();
  for (const [index, value] of values.entries()) {
    const numeric = toFiniteNumber(value);
    if (numeric === undefined) {
      continue;
    }
    const code = rowCurrency(column?.numberFormat, rows[index]) ?? NO_CURRENCY;
    const list = grouped.get(code) ?? [];
    list.push(numeric);
    grouped.set(code, list);
  }
  return grouped;
}

/** The calculation over every value converted first, when all convert. */
function convertedCalculation(
  grouped: Map<string, number[]>,
  calculation: string,
  conversion: CurrencyConversion
): CurrencyCalculationResult["converted"] {
  const all = [...grouped].flatMap(([code, numbers]) =>
    numbers.map((amount) => convertAmount(amount, code, conversion))
  );
  const amounts = all.filter(
    (amount): amount is number => amount !== undefined
  );
  if (amounts.length !== all.length) {
    return;
  }
  const value = numericCalculation(
    amounts.sort((left, right) => left - right),
    calculation
  );
  return value === null
    ? undefined
    : {
        currency: currencyCode(conversion.currency) ?? conversion.currency,
        value,
      };
}

/**
 * A value calculation (sum, average, median, min, max, range) over a column
 * whose rows carry their currency: computed per currency and never mixed.
 * With `currencyConversion` covering every currency, each value is converted
 * first and the calculation runs once in the target currency. `undefined`
 * when the column has no `currencyColumn` or the calculation is a count.
 */
export function calculateCurrencyColumn(
  values: readonly unknown[],
  rows: readonly Readonly<Record<string, unknown>>[],
  calculation: string,
  column: ColumnValueFormat | undefined,
  locale?: string
): CurrencyCalculationResult | undefined {
  if (!(VALUE_CALCULATIONS.has(calculation) && hasCurrencyColumn(column))) {
    return;
  }
  const grouped = valuesByCurrency(values, rows, column);
  const byCurrency: CurrencyAmounts = {};
  for (const [code, numbers] of grouped) {
    const result = numericCalculation(
      numbers.sort((left, right) => left - right),
      calculation
    );
    if (result !== null) {
      byCurrency[code] = result;
    }
  }
  const conversion = columnConversion(column);
  const converted =
    conversion && grouped.size > 1
      ? convertedCalculation(grouped, calculation, conversion)
      : undefined;
  const codes = Object.keys(byCurrency);
  const only =
    codes.length === 1 ? byCurrency[codes[0] ?? NO_CURRENCY] : undefined;
  return {
    raw: converted?.value ?? only ?? null,
    label: formatCurrencyAmounts(
      byCurrency,
      calculation,
      column,
      locale,
      converted
    ),
    byCurrency,
    converted,
  };
}
