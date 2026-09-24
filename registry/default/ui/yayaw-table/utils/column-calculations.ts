/**
 * Pure calculation functions for column footer aggregations.
 * Operates on an array of raw cell values extracted from visible rows.
 */

import type { CalculationType } from "../types/footer-types";
import {
  type ColumnValueFormat,
  formatColumnCalculation,
  parseDateValue,
} from "./value-format";

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

interface CalculationResult {
  raw: number | string | null;
  label: string;
}

const EMPTY_RESULT: CalculationResult = { raw: null, label: "—" };

const percentOf = (count: number, total: number): number =>
  total === 0 ? 0 : Math.round((count / total) * 100);

/**
 * Compute a column calculation over a set of raw values.
 *
 * @param values - raw cell values for a single column across all visible rows
 * @param type - the calculation to perform
 * @param columnType - the column data type (number, date, etc.)
 * @param locale - the table locale
 * @param column - the column's formats: sums, averages and extremes read in
 *   them; counts and shares stay plain
 * @returns the raw result and its label, or null when not applicable
 */
export const calculateColumn = (
  values: unknown[],
  type: CalculationType,
  columnType?: string,
  locale?: string,
  column?: ColumnValueFormat
): CalculationResult => {
  const format = { ...column, type: columnType ?? column?.type };
  const labelled = (raw: number | null, shown: unknown = raw) =>
    raw === null
      ? EMPTY_RESULT
      : { raw, label: formatColumnCalculation(shown, type, format, locale) };
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
      return labelled(total);
    case "count_values":
    case "count_not_empty":
      return labelled(nonEmpty.length);
    case "count_unique":
      return labelled(new Set(nonEmpty.map(String)).size);
    case "count_empty":
      return labelled(emptyCount);
    case "count_true":
      return labelled(trueCount);
    case "count_false":
      return labelled(falseCount);
    case "percent_empty":
      return labelled(percentOf(emptyCount, total));
    case "percent_not_empty":
      return labelled(percentOf(nonEmpty.length, total));
    case "percent_true":
      return labelled(percentOf(trueCount, total));
    case "percent_false":
      return labelled(percentOf(falseCount, total));
    case "sum":
    case "average":
    case "median":
    case "min":
    case "max":
    case "range":
      return format.type === "date"
        ? computeDate(nonEmpty, type, labelled)
        : labelled(computeNumeric(nonEmpty, type));
    default:
      return { raw: null, label: "" };
  }
};

type NumericOp = "sum" | "average" | "median" | "min" | "max" | "range";

const computeNumeric = (nonEmpty: unknown[], op: NumericOp): number | null => {
  const numbers = nonEmpty
    .map(toNumber)
    .filter((n): n is number => n !== undefined)
    .sort((a, b) => a - b);
  const first = numbers.at(0);
  const last = numbers.at(-1);
  if (first === undefined || last === undefined) {
    return null;
  }
  const sum = numbers.reduce((a, b) => a + b, 0);
  switch (op) {
    case "sum":
      return sum;
    case "average":
      return sum / numbers.length;
    case "median": {
      const mid = Math.floor(numbers.length / 2);
      const upper = numbers[mid] ?? last;
      return numbers.length % 2 === 0
        ? ((numbers[mid - 1] ?? upper) + upper) / 2
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
};

/**
 * Earliest and latest dates keep the stored value, so a calendar day stays
 * that day in the column's format; the range counts whole days.
 */
const computeDate = (
  nonEmpty: unknown[],
  op: NumericOp,
  labelled: (raw: number | null, shown?: unknown) => CalculationResult
): CalculationResult => {
  const dated = nonEmpty.flatMap((value) => {
    const date = parseDateValue(value);
    return date ? [{ value, time: date.getTime() }] : [];
  });
  dated.sort((left, right) => left.time - right.time);
  const first = dated.at(0);
  const last = dated.at(-1);
  if (!(first && last)) {
    return EMPTY_RESULT;
  }
  switch (op) {
    case "min":
      return labelled(first.time, first.value);
    case "max":
      return labelled(last.time, last.value);
    case "range":
      return labelled(Math.round((last.time - first.time) / 86_400_000));
    default:
      return EMPTY_RESULT;
  }
};
