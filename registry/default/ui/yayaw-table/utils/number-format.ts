/**
 * Number format configuration for numeric columns.
 * Supports presets (space/dot/comma thousands) or explicit separators.
 */

/** Preset: " " = 1 234 567.89, "." = 1.234.567,89, "locale" = Intl */
export type NumberFormatPreset = "space" | "dot" | "comma" | "locale";

export interface NumberFormatOptions {
  /** Thousands separator (e.g. " ", ".", ",") */
  thousandsSeparator?: string;
  /** Decimal separator (e.g. ".", ",") */
  decimalSeparator?: string;
  /** Fixed number of decimal places; omit for automatic */
  decimals?: number;
  /** Prefix for monetary display (e.g. "€ " or "$") */
  prefix?: string;
  /** Suffix for monetary display (e.g. " €" or " $") */
  suffix?: string;
}

/** Config: preset name or explicit options */
export type NumberFormatConfig = NumberFormatPreset | NumberFormatOptions;

const PRESETS: Record<
  NumberFormatPreset,
  { thousandsSeparator: string; decimalSeparator: string }
> = {
  space: { thousandsSeparator: " ", decimalSeparator: "." },
  dot: { thousandsSeparator: ".", decimalSeparator: "," },
  comma: { thousandsSeparator: ",", decimalSeparator: "." },
  locale: { thousandsSeparator: "", decimalSeparator: "" }, // use Intl
};

function isPreset(config: NumberFormatConfig): config is NumberFormatPreset {
  return typeof config === "string";
}

/**
 * Resolve config to options (with defaults for locale)
 */
export function resolveNumberFormat(
  config: NumberFormatConfig
): NumberFormatOptions {
  if (isPreset(config)) {
    if (config === "locale") {
      return { thousandsSeparator: "", decimalSeparator: "" };
    }
    return PRESETS[config];
  }
  return config;
}

/**
 * Format a number with the given config.
 * - "locale": uses Intl.NumberFormat with undefined locale (browser default).
 * - Otherwise: splits integer/fraction, inserts thousands separator, joins with decimal separator.
 */
export function formatNumber(
  value: number,
  config: NumberFormatConfig,
  decimals?: number
): string {
  if (!Number.isFinite(value)) {
    return "—";
  }

  const opts = resolveNumberFormat(config);
  const useLocale = isPreset(config) && config === "locale";

  if (useLocale) {
    const dec = decimals ?? opts.decimals;
    return new Intl.NumberFormat(undefined, {
      maximumFractionDigits: dec ?? 2,
      minimumFractionDigits: dec,
    }).format(value);
  }

  const dec = decimals ?? opts.decimals ?? 2;
  const decimalSep = opts.decimalSeparator ?? ".";
  const thousandsSep = opts.thousandsSeparator ?? " ";

  const [intPart, fracPart] = value.toFixed(dec).split(".");
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSep);
  const numeric =
    dec <= 0
      ? withThousands
      : `${withThousands}${decimalSep}${fracPart ?? "0".repeat(dec)}`;
  const prefix = opts.prefix ?? "";
  const suffix = opts.suffix ?? "";
  return `${prefix}${numeric}${suffix}`;
}
