import { format as formatDateFns } from "date-fns";
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
  locale?: string
): string => {
  const safeLocale = resolveLocale(locale);

  switch (preset) {
    case "localized-short":
      return new Intl.DateTimeFormat(safeLocale, {
        dateStyle: "short",
      }).format(date);
    case "localized-medium":
      return new Intl.DateTimeFormat(safeLocale, {
        dateStyle: "medium",
      }).format(date);
    case "localized-long":
      return new Intl.DateTimeFormat(safeLocale, {
        dateStyle: "long",
      }).format(date);
    case "month-name-long":
      return new Intl.DateTimeFormat(safeLocale, {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }).format(date);
    case "month-year":
      return new Intl.DateTimeFormat(safeLocale, {
        month: "long",
        year: "numeric",
      }).format(date);
    case "dmy-numeric":
      return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
    case "dmy-short":
      return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${String(date.getFullYear()).slice(-2)}`;
    case "mdy-numeric":
      return `${pad2(date.getMonth() + 1)}/${pad2(date.getDate())}/${date.getFullYear()}`;
    case "mdy-short":
      return `${pad2(date.getMonth() + 1)}/${pad2(date.getDate())}/${String(date.getFullYear()).slice(-2)}`;
    case "iso-date":
      return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
    default:
      return new Intl.DateTimeFormat(safeLocale, {
        dateStyle: "short",
      }).format(date);
  }
};

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

const formatWithLegacyPattern = (
  date: Date,
  dateFormat: string,
  showTime: boolean
): string => {
  const formatString = showTime ? `${dateFormat} HH:mm` : dateFormat;
  return formatDateFns(date, formatString);
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
    const parsedDate = new Date(value);
    return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate;
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

export const formatDateForDisplay = (
  value: unknown,
  config: DateDisplayConfig = {}
): string | undefined => {
  const parsedDate = toValidDate(value);
  if (!parsedDate) {
    return;
  }

  const preset = resolvePreset(config);
  if (preset) {
    return appendTimeIfNeeded(
      formatWithPreset(parsedDate, preset, config.locale),
      parsedDate,
      Boolean(config.showTime),
      config.locale
    );
  }

  if (config.dateFormat) {
    try {
      return formatWithLegacyPattern(
        parsedDate,
        config.dateFormat,
        Boolean(config.showTime)
      );
    } catch {
      return appendTimeIfNeeded(
        formatWithPreset(
          parsedDate,
          DEFAULT_DATE_DISPLAY_PRESET,
          config.locale
        ),
        parsedDate,
        Boolean(config.showTime),
        config.locale
      );
    }
  }

  return appendTimeIfNeeded(
    formatWithPreset(parsedDate, DEFAULT_DATE_DISPLAY_PRESET, config.locale),
    parsedDate,
    Boolean(config.showTime),
    config.locale
  );
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
