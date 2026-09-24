import { formatDateValue, parseDateValue } from "./value-format";
import {
  DEFAULT_DATE_DISPLAY_PRESET,
  type DateDisplayPreset,
} from "../types/date-types";

interface DateDisplayConfig {
  dateDisplayPreset?: DateDisplayPreset;
  fallbackDateDisplayPreset?: DateDisplayPreset;
  dateFormat?: string;
  locale?: string;
  showTime?: boolean;
  /** IANA zone for presets, e.g. "Europe/Paris". */
  timeZone?: string;
  hour12?: boolean;
}

const pad2 = (value: number): string => value.toString().padStart(2, "0");
const YEAR_MONTH_GROUP_KEY_REGEX = /^(\d{4})-(\d{2})$/;

const resolveLocale = (locale?: string): string => {
  if (!locale) {
    return "en-US";
  }

  try {
    // Validate locale to avoid runtime crashes with malformed values.
    new Intl.DateTimeFormat(locale);
    return locale;
  } catch {
    return "en-US";
  }
};

const formatLocalTime = (date: Date, locale?: string): string => {
  return new Intl.DateTimeFormat(resolveLocale(locale), {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const resolvePreset = ({
  dateDisplayPreset,
  fallbackDateDisplayPreset,
}: DateDisplayConfig): DateDisplayPreset | undefined => {
  return dateDisplayPreset ?? fallbackDateDisplayPreset;
};

const formatWithPreset = (
  date: Date,
  preset: DateDisplayPreset,
  locale?: string,
  zone: Pick<DateDisplayConfig, "hour12" | "timeZone"> = {}
): string =>
  formatDateValue(date, {
    preset,
    locale: resolveLocale(locale),
    timeZone: zone.timeZone,
    hour12: zone.hour12,
  });

const appendTimeIfNeeded = (
  label: string,
  date: Date,
  showTime: boolean,
  locale?: string
): string => {
  if (!showTime) {
    return label;
  }

  return `${label} ${formatLocalTime(date, locale)}`;
};

const isDateWithSet = (value: unknown): value is { set: unknown } => {
  return Boolean(
    value &&
      typeof value === "object" &&
      "set" in value &&
      Object.prototype.hasOwnProperty.call(value, "set")
  );
};

export const toValidDate = (value: unknown): Date | undefined => {
  if (isDateWithSet(value)) {
    return toValidDate(value.set);
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }

  if (typeof value === "string" || typeof value === "number") {
    // A date-only string is a local calendar day, as in date filters.
    return parseDateValue(value);
  }

  return;
};

export const toValidDateRange = (value: unknown): [Date, Date] | undefined => {
  if (!Array.isArray(value)) {
    const singleDate = toValidDate(value);
    return singleDate ? [singleDate, singleDate] : undefined;
  }

  const startDate = toValidDate(value[0]);
  const endDate = toValidDate(value[1] ?? value[0]);
  if (!(startDate && endDate)) {
    if (startDate) {
      return [startDate, startDate];
    }
    if (endDate) {
      return [endDate, endDate];
    }
    return;
  }

  return startDate.getTime() <= endDate.getTime()
    ? [startDate, endDate]
    : [endDate, startDate];
};

/** The value the shared formatter reads: date-only strings stay calendar days. */
const dateSource = (value: unknown, parsedDate: Date): unknown => {
  if (isDateWithSet(value)) {
    return dateSource(value.set, parsedDate);
  }
  return typeof value === "string" ||
    typeof value === "number" ||
    value instanceof Date
    ? value
    : parsedDate;
};

/**
 * A date as its column shows it, through the shared formatter: the column's
 * pattern wins over its preset, then the table's default preset.
 */
export const formatDateForDisplay = (
  value: unknown,
  config: DateDisplayConfig = {}
): string | undefined => {
  const parsedDate = toValidDate(value);
  if (!parsedDate) {
    return;
  }
  const showTime = Boolean(config.showTime);
  let pattern: string | undefined;
  if (config.dateFormat) {
    pattern = showTime ? `${config.dateFormat} HH:mm` : config.dateFormat;
  }
  const label = formatDateValue(dateSource(value, parsedDate), {
    preset: resolvePreset(config) ?? DEFAULT_DATE_DISPLAY_PRESET,
    pattern,
    locale: resolveLocale(config.locale),
    timeZone: config.timeZone,
    hour12: config.hour12,
  });
  return pattern
    ? label
    : appendTimeIfNeeded(label, parsedDate, showTime, config.locale);
};

export const formatDateRangeForDisplay = (
  value: unknown,
  config: DateDisplayConfig = {}
): string | undefined => {
  const range = toValidDateRange(value);
  if (!range) {
    return;
  }

  const startLabel = formatDateForDisplay(range[0], config);
  const endLabel = formatDateForDisplay(range[1], config);
  if (!(startLabel && endLabel)) {
    return;
  }

  return `${startLabel} - ${endLabel}`;
};

export const toYearMonthGroupKey = (value: unknown): string | undefined => {
  const parsedDate = toValidDate(value);
  if (!parsedDate) {
    return;
  }

  return `${parsedDate.getFullYear()}-${pad2(parsedDate.getMonth() + 1)}`;
};

export const formatYearMonthGroupLabel = (
  valueOrKey: unknown,
  locale?: string
): string => {
  if (typeof valueOrKey === "string") {
    const match = YEAR_MONTH_GROUP_KEY_REGEX.exec(valueOrKey);
    if (match) {
      const year = Number.parseInt(match[1], 10);
      const monthIndex = Number.parseInt(match[2], 10) - 1;
      if (!Number.isNaN(year) && monthIndex >= 0 && monthIndex <= 11) {
        return formatWithPreset(
          new Date(year, monthIndex, 1),
          "month-year",
          locale
        );
      }
    }
  }

  const parsedDate = toValidDate(valueOrKey);
  if (!parsedDate) {
    return "";
  }

  return formatWithPreset(parsedDate, "month-year", locale);
};
