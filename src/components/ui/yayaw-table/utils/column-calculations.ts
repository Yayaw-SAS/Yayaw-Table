/**
 * Pure calculation functions for column footer aggregations.
 * Operates on an array of raw cell values extracted from visible rows.
 */

import type { CalculationType } from "../types/footer-types";

/**
 * Extract a typed value from a cell.
 * Returns `undefined` for null/undefined/empty-string.
 */
const normalize = (value: unknown): unknown => {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }
  return value;
};

const toNumber = (v: unknown): number | undefined => {
  if (typeof v === "number" && Number.isFinite(v)) {
    return v;
  }
  if (typeof v === "string") {
    const parsed = Number(v);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
};

const toDate = (v: unknown): Date | undefined => {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v;
  }
  if (typeof v === "string" || typeof v === "number") {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) {
      return d;
    }
  }
  return undefined;
};

const toBoolean = (v: unknown): boolean | undefined => {
  if (typeof v === "boolean") {
    return v;
  }
  if (typeof v === "number") {
    if (v === 1) {
      return true;
    }
    if (v === 0) {
      return false;
    }
    return undefined;
  }
  if (typeof v === "string") {
    const normalized = v.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") {
      return true;
    }
    if (normalized === "false" || normalized === "0") {
      return false;
    }
  }
  return undefined;
};

/**
 * Compute a column calculation over a set of raw values.
 *
 * @param values - raw cell values for a single column across all visible rows
 * @param type - the calculation to perform
 * @param columnType - the column data type (number, date, etc.) for formatting hints
 * @returns the calculated result as a display-ready value, or null if not applicable
 */
export const calculateColumn = (
  values: unknown[],
  type: CalculationType,
  columnType?: string,
  locale?: string
): { raw: number | string | null; label: string } => {
  const total = values.length;
  const normalized = values.map(normalize);
  const nonEmpty = normalized.filter((v) => v !== undefined);
  const emptyCount = total - nonEmpty.length;
  const booleanValues = nonEmpty
    .map(toBoolean)
    .filter((value): value is boolean => value !== undefined);
  const trueCount = booleanValues.filter(Boolean).length;
  const falseCount = booleanValues.length - trueCount;

  switch (type) {
    case "none":
      return { raw: null, label: "" };

    case "count_all":
      return { raw: total, label: String(total) };

    case "count_values":
      return { raw: nonEmpty.length, label: String(nonEmpty.length) };

    case "count_unique": {
      const unique = new Set(nonEmpty.map(String));
      return { raw: unique.size, label: String(unique.size) };
    }

    case "count_empty":
      return { raw: emptyCount, label: String(emptyCount) };

    case "count_not_empty":
      return { raw: nonEmpty.length, label: String(nonEmpty.length) };

    case "count_true":
      return { raw: trueCount, label: String(trueCount) };

    case "count_false":
      return { raw: falseCount, label: String(falseCount) };

    case "percent_empty": {
      if (total === 0) {
        return { raw: 0, label: "0%" };
      }
      const pct = Math.round((emptyCount / total) * 100);
      return { raw: pct, label: `${pct}%` };
    }

    case "percent_not_empty": {
      if (total === 0) {
        return { raw: 0, label: "0%" };
      }
      const pct = Math.round((nonEmpty.length / total) * 100);
      return { raw: pct, label: `${pct}%` };
    }

    case "percent_true": {
      if (total === 0) {
        return { raw: 0, label: "0%" };
      }
      const pct = Math.round((trueCount / total) * 100);
      return { raw: pct, label: `${pct}%` };
    }

    case "percent_false": {
      if (total === 0) {
        return { raw: 0, label: "0%" };
      }
      const pct = Math.round((falseCount / total) * 100);
      return { raw: pct, label: `${pct}%` };
    }

    case "sum":
      return computeNumericOrDate(nonEmpty, columnType, "sum", locale);

    case "average":
      return computeNumericOrDate(nonEmpty, columnType, "average", locale);

    case "median":
      return computeNumericOrDate(nonEmpty, columnType, "median", locale);

    case "min":
      return computeNumericOrDate(nonEmpty, columnType, "min", locale);

    case "max":
      return computeNumericOrDate(nonEmpty, columnType, "max", locale);

    case "range":
      return computeNumericOrDate(nonEmpty, columnType, "range", locale);

    default:
      return { raw: null, label: "" };
  }
};

type NumericOp = "sum" | "average" | "median" | "min" | "max" | "range";

const computeNumericOrDate = (
  nonEmpty: unknown[],
  columnType: string | undefined,
  op: NumericOp,
  locale?: string
): { raw: number | string | null; label: string } => {
  if (columnType === "date") {
    return computeDate(nonEmpty, op, locale);
  }
  return computeNumeric(nonEmpty, op, locale);
};

const computeNumeric = (
  nonEmpty: unknown[],
  op: NumericOp,
  locale?: string
): { raw: number | string | null; label: string } => {
  const numbers = nonEmpty.map(toNumber).filter((n): n is number => n !== undefined);
  if (numbers.length === 0) {
    return { raw: null, label: "—" };
  }

  switch (op) {
    case "sum": {
      const s = numbers.reduce((a, b) => a + b, 0);
      return { raw: s, label: s.toLocaleString(locale) };
    }
    case "average": {
      const avg = numbers.reduce((a, b) => a + b, 0) / numbers.length;
      return {
        raw: avg,
        label: avg.toLocaleString(locale, { maximumFractionDigits: 2 }),
      };
    }
    case "median": {
      const sorted = [...numbers].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const med =
        sorted.length % 2 === 0
          ? (sorted[mid - 1] + sorted[mid]) / 2
          : sorted[mid];
      return {
        raw: med,
        label: med.toLocaleString(locale, { maximumFractionDigits: 2 }),
      };
    }
    case "min": {
      const m = Math.min(...numbers);
      return { raw: m, label: m.toLocaleString(locale) };
    }
    case "max": {
      const m = Math.max(...numbers);
      return { raw: m, label: m.toLocaleString(locale) };
    }
    case "range": {
      const min = Math.min(...numbers);
      const max = Math.max(...numbers);
      const r = max - min;
      return { raw: r, label: r.toLocaleString(locale) };
    }
    default:
      return { raw: null, label: "—" };
  }
};

const computeDate = (
  nonEmpty: unknown[],
  op: NumericOp,
  locale?: string
): { raw: number | string | null; label: string } => {
  const dates = nonEmpty.map(toDate).filter((d): d is Date => d !== undefined);
  if (dates.length === 0) {
    return { raw: null, label: "—" };
  }

  const timestamps = dates.map((d) => d.getTime());
  const formatter = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  switch (op) {
    case "min": {
      const minTs = Math.min(...timestamps);
      return { raw: minTs, label: formatter.format(new Date(minTs)) };
    }
    case "max": {
      const maxTs = Math.max(...timestamps);
      return { raw: maxTs, label: formatter.format(new Date(maxTs)) };
    }
    case "range": {
      const minTs = Math.min(...timestamps);
      const maxTs = Math.max(...timestamps);
      const diffDays = Math.round((maxTs - minTs) / (1_000 * 60 * 60 * 24));
      return { raw: diffDays, label: `${diffDays}d` };
    }
    case "sum":
    case "average":
    case "median":
      return { raw: null, label: "—" };
    default:
      return { raw: null, label: "—" };
  }
};
