import {
  type ColumnNumberFormat,
  formatNumberValue,
  type NumberFormatConfig,
  resolveNumberFormat,
} from "./value-format";

/** Presentation of an aggregate: raw value × scale + offset. Queries keep raw units. */
export interface MetricDisplayFormat {
  /** Positive finite multiplier; division is expressed as its reciprocal. */
  scale?: number;
  /** Finite display offset, applied once after aggregation. */
  offset?: number;
  /** Fixed fractional digits, from 0 to 12. */
  decimals?: number;
  /** Literal unit label, not an expression or an Intl unit identifier. */
  unit?: string;
}

const KEYS = new Set(["scale", "offset", "decimals", "unit"]);
const CONTROL_CHARACTERS = /[\p{Cc}\p{Cf}]/u;

/** Validate numeric options before copying any part of a display transform. */
function isMetricNumber(
  key: "scale" | "offset" | "decimals",
  value: unknown
): value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return false;
  }
  if (key === "scale") {
    return value > 0;
  }
  return (
    key !== "decimals" || (Number.isInteger(value) && value >= 0 && value <= 12)
  );
}

function metricUnit(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return;
  }
  const unit = value.trim();
  return unit && unit.length <= 32 && !CONTROL_CHARACTERS.test(unit)
    ? unit
    : undefined;
}

/** Strictly accept the whole format, never silently keep half a conversion. */
export function normalizeMetricFormat(
  value: unknown
): MetricDisplayFormat | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return;
  }
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !KEYS.has(key))) {
    return;
  }
  const result: MetricDisplayFormat = {};
  for (const key of ["scale", "offset", "decimals"] as const) {
    const number = input[key];
    if (number === undefined) {
      continue;
    }
    if (!isMetricNumber(key, number)) {
      return;
    }
    result[key] = number;
  }
  if (input.unit !== undefined) {
    const unit = metricUnit(input.unit);
    if (!unit) {
      return;
    }
    result.unit = unit;
  }
  return result;
}

/** The same bounded contract is advertised by dashboard and saved-chart schemas. */
export const METRIC_FORMAT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  description:
    "Display only: raw aggregate × scale + offset; queries, sorting, shares and comparisons keep raw units. No expressions.",
  properties: {
    scale: {
      type: "number",
      exclusiveMinimum: 0,
      description:
        "Positive multiplier; use 0.000001 to divide by one million.",
    },
    offset: {
      type: "number",
      description:
        "Added once after scaling the aggregate, not to each record.",
    },
    decimals: { type: "integer", minimum: 0, maximum: 12 },
    unit: {
      type: "string",
      minLength: 1,
      maxLength: 32,
      description:
        "Literal unit appended with a space, for example Mbit/s or ms.",
    },
  },
} as const;

/** Every metric label (ticks, tooltips, data labels, KPI and sparkline title) uses this. */
export function metricValueFormatter(
  format: MetricDisplayFormat,
  inherited: NumberFormatConfig | undefined,
  locale: string
): (value: number) => string {
  const valid = normalizeMetricFormat(format);
  const options: ColumnNumberFormat =
    valid?.unit === undefined
      ? { ...resolveNumberFormat(inherited) }
      : { suffix: ` ${valid.unit}` };
  if (valid?.decimals !== undefined) {
    options.decimals = valid.decimals;
  }
  return (value) => {
    const converted = value * (valid?.scale ?? 1) + (valid?.offset ?? 0);
    // Never present overflow as a real measurement.
    return Number.isFinite(converted)
      ? formatNumberValue(converted, options, locale)
      : "—";
  };
}
