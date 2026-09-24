/**
 * Number format configuration for numeric columns.
 * The shared `value-format` module does the formatting; this file keeps the
 * historical import path and the `formatNumber(value, config, decimals)` API.
 */
import {
  type ColumnNumberFormat,
  formatNumberValue,
  type NumberFormatConfig as SharedNumberFormatConfig,
  type NumberFormatPreset as SharedNumberFormatPreset,
  resolveNumberFormat as resolveSharedNumberFormat,
} from "./value-format";

/** Preset: " " = 1 234 567.89, "." = 1.234.567,89, "locale" = Intl */
export type NumberFormatPreset = SharedNumberFormatPreset;

export type NumberFormatOptions = ColumnNumberFormat;

/** Config: preset name or explicit options */
export type NumberFormatConfig = SharedNumberFormatConfig;

/** The "locale" preset keeps its historical two decimals at most. */
export function resolveNumberFormat(
  config: NumberFormatConfig
): NumberFormatOptions {
  return resolveSharedNumberFormat(config);
}

/**
 * Format a number with the given config, optionally forcing its decimals.
 */
export function formatNumber(
  value: number,
  config: NumberFormatConfig,
  decimals?: number,
  locale?: string
): string {
  if (!Number.isFinite(value)) {
    return "—";
  }
  const options = resolveNumberFormat(config);
  return formatNumberValue(
    value,
    decimals === undefined ? options : { ...options, decimals },
    locale
  );
}
