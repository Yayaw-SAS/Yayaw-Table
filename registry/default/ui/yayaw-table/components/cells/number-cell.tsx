/**
 * Number cell component for data tables
 * Shows formatted number values with appropriate styling
 */
"use client";

import { useLocale } from "../../providers/table-provider";
import {
  formatNumber,
  type NumberFormatConfig,
} from "../../utils/number-format";
import { numberBarRatio } from "../../utils/value-format";

export interface NumberCellProps {
  /**
   * Optional CSS class name
   */
  className?: string;

  /**
   * Optional formatter function to format the number (overrides numberFormat)
   */
  formatter?: (value: number) => string;

  /**
   * Display format: "space" | "dot" | "comma" | "locale" or options.
   * Used when formatter is not provided.
   */
  numberFormat?: NumberFormatConfig;

  /**
   * The numeric value to display
   */
  value: number | string;
}

/**
 * Cell component for displaying number values
 * Handles NaN and formatting options
 */
export function NumberCell({
  className = "",
  formatter,
  numberFormat,
  value,
}: NumberCellProps) {
  const locale = useLocale();
  // Handle null or undefined
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">-</span>;
  }

  // Convert to number if it's a string
  const numValue = typeof value === "string" ? Number(value) : value;

  // Handle NaN
  if (Number.isNaN(numValue)) {
    return <span className={`text-muted-foreground ${className}`}>-</span>;
  }

  // Custom formatter takes precedence
  if (formatter) {
    return <span className={className}>{formatter(numValue)}</span>;
  }

  // Configurable format (e.g. space/dot thousands)
  if (numberFormat !== undefined) {
    const text = formatNumber(numValue, numberFormat, undefined, locale);
    const ratio = numberBarRatio(numValue, numberFormat);
    if (ratio === undefined) {
      return <span className={className}>{text}</span>;
    }
    return (
      <span className={`inline-flex w-full items-center gap-2 ${className}`}>
        <span
          aria-hidden="true"
          className="h-1.5 min-w-8 flex-1 overflow-hidden rounded-full bg-muted"
        >
          <span
            className="block h-full rounded-full bg-primary"
            style={{ width: `${Math.round(ratio * 100)}%` }}
          />
        </span>
        <span className="shrink-0 tabular-nums">{text}</span>
      </span>
    );
  }

  // Default display
  return <span className={className}>{String(numValue)}</span>;
}
