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

/** Presets become explicit options; objects pass through. */
export function resolveNumberFormat(
  config: NumberFormatConfig | undefined
): ColumnNumberFormat {
  if (config === undefined || config === "locale") {
    return {};
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
  /** IANA zone such as `"Europe/Paris"`; presets only, patterns use local time. */
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
  if (options.pattern) {
    return formatPattern(date, options.pattern);
  }
  const preset = options.preset ?? "localized-short";
  if (preset === "iso") {
    return date.toISOString();
  }
  if (preset === "relative") {
    return relative(date, options.locale, options.now ?? new Date());
  }
  const numeric = numericPreset(preset, date, options.timeZone);
  if (numeric) {
    return numeric;
  }
  return new Intl.DateTimeFormat(options.locale, {
    ...(INTL_PRESETS[preset] ?? INTL_PRESETS["localized-short"]),
    hour12: options.hour12,
    timeZone: options.timeZone,
  }).format(date);
}
