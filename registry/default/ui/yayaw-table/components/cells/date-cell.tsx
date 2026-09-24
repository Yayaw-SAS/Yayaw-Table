/**
 * Date cell component for data tables
 * Shows formatted date values with appropriate styling
 */
"use client";

import { useLocale } from "../../providers/table-provider";
import type { DateDisplayPreset } from "../../types/date-types";
import { formatDateForDisplay, toValidDate } from "../../utils/date-display";

export interface DateCellProps {
  /**
   * Optional CSS class name
   */
  className?: string;

  /** date-fns pattern; wins over the presets when set. */
  dateFormat?: string;

  /**
   * Date display preset (strict preset-based formatting)
   */
  dateDisplayPreset?: DateDisplayPreset;

  /**
   * Fallback date display preset (typically table-level default)
   */
  fallbackDateDisplayPreset?: DateDisplayPreset;

  /**
   * Whether to show the time
   * @default false
   */
  showTime?: boolean;

  /** IANA zone for presets, e.g. "Europe/Paris". */
  timeZone?: string;

  /** Force a 12- or 24-hour clock where a time is shown. */
  hour12?: boolean;

  /**
   * The date value to display
   */
  value: Date | null | number | string | undefined;
}

/**
 * Cell component for displaying formatted date values
 */
export function DateCell({
  className = "",
  dateFormat,
  dateDisplayPreset,
  fallbackDateDisplayPreset,
  showTime = false,
  timeZone,
  hour12,
  value,
}: DateCellProps) {
  const locale = useLocale();

  // If the value is not a valid date, return a placeholder
  if (!value) {
    return <span className="text-muted-foreground">-</span>;
  }

  // If the input cannot be parsed to a valid date, keep explicit fallback.
  if (!toValidDate(value)) {
    return <span className="text-muted-foreground">Invalid date</span>;
  }

  const displayValue = formatDateForDisplay(value, {
    dateDisplayPreset,
    fallbackDateDisplayPreset,
    dateFormat,
    locale,
    showTime,
    timeZone,
    hour12,
  });

  if (!displayValue) {
    return <span className="text-muted-foreground">Invalid date</span>;
  }

  return <span className={className}>{displayValue}</span>;
}
