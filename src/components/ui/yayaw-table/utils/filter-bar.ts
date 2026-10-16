/**
 * Quick filters reuse catalogue options and the native column-filter state.
 * Date columns get a period instead: one advanced filter rule per column, so
 * every display mode (charts and calendars have no column headers) and every
 * host that reads date rules filters by it.
 */
import {
  calendarDay,
  type RelativeDateToken,
  relativeDateTokenOf,
} from "./date-filter-days";

export interface FilterBarOption {
  value: string | number | boolean;
  label: string;
  disabled?: boolean;
}

export interface FilterBarColumn {
  id: string;
  header: string;
  type?: string;
  enableFiltering?: boolean;
  options?: unknown;
}

export const filterValueKey = (value: unknown): string =>
  `${typeof value}:${String(value)}`;

export function filterValues(value: unknown): unknown[] {
  if (value === undefined || value === null || value === "") {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

export function filterBarOptions(
  column: FilterBarColumn,
  value: unknown,
  booleanLabels: { yes: string; no: string }
): FilterBarOption[] {
  const options: FilterBarOption[] = Array.isArray(column.options)
    ? column.options
    : [];
  const initial =
    options.length || column.type !== "boolean"
      ? options
      : [
          { value: true, label: booleanLabels.yes },
          { value: false, label: booleanLabels.no },
        ];
  const result = new Map(
    initial.map((option) => [filterValueKey(option.value), option])
  );
  // Retain selections loaded from saved views even if an option was removed.
  for (const selected of filterValues(value)) {
    if (!["string", "number", "boolean"].includes(typeof selected)) {
      continue;
    }
    const key = filterValueKey(selected);
    if (!result.has(key)) {
      result.set(key, {
        value: selected as FilterBarOption["value"],
        label: String(selected),
      });
    }
  }
  return [...result.values()];
}

export function filterBarColumns<T extends FilterBarColumn>(
  columns: T[],
  ids: string[] = []
): T[] {
  return [...new Set(ids)].flatMap((id) => {
    const column = columns.find((item) => item.id === id);
    return column &&
      column.enableFiltering !== false &&
      (Array.isArray(column.options) ||
        column.type === "boolean" ||
        column.type === "date")
      ? [column]
      : [];
  });
}

export function replaceColumnFilter<T extends { id: string; value: unknown }>(
  filters: T[],
  id: string,
  values: unknown[]
): { id: string; value: unknown }[] {
  const other = filters.filter((filter) => filter.id !== id);
  return values.length ? [...other, { id, value: values }] : other;
}

/** The advanced filter rule a date quick filter keeps for its column. */
export const filterBarDateRuleId = (columnId: string): string =>
  `filter-bar-${columnId}`;

/** A date quick filter's period: a relative token, or days from / to. */
export interface FilterBarDateValue {
  token?: RelativeDateToken;
  from?: string;
  to?: string;
}

interface FilterBarDateRule {
  id: string;
  columnId: string;
  operator: "between" | "equals" | "greaterThanOrEqual" | "lessThanOrEqual";
  values: unknown;
  type: "date";
  isActive: true;
}

/** The period a column's date quick filter holds in the advanced rules. */
export function filterBarDateValue(
  rules: readonly { id: string; operator?: unknown; values?: unknown }[],
  columnId: string
): FilterBarDateValue {
  const rule = rules.find((item) => item.id === filterBarDateRuleId(columnId));
  if (!rule) {
    return {};
  }
  const token = relativeDateTokenOf(rule.values);
  if (token) {
    return { token };
  }
  const values = Array.isArray(rule.values) ? rule.values : [rule.values];
  const first = calendarDay(values[0]);
  switch (rule.operator) {
    case "between":
      return { from: first, to: calendarDay(values[1]) };
    case "greaterThanOrEqual":
      return { from: first };
    case "lessThanOrEqual":
      return { to: first };
    default:
      return {};
  }
}

function filterBarDateRule(
  columnId: string,
  { token, from, to }: FilterBarDateValue
): FilterBarDateRule | undefined {
  const rule = {
    id: filterBarDateRuleId(columnId),
    columnId,
    type: "date",
    isActive: true,
  } as const;
  if (token) {
    return { ...rule, operator: "equals", values: token };
  }
  if (from && to) {
    return { ...rule, operator: "between", values: [from, to] };
  }
  if (from || to) {
    return {
      ...rule,
      operator: from ? "greaterThanOrEqual" : "lessThanOrEqual",
      values: from ?? to,
    };
  }
  return;
}

/** The advanced rules with the column's date quick filter set to `value` (removed when empty). */
export function replaceFilterBarDateRule<T extends { id: string }>(
  rules: readonly T[],
  columnId: string,
  value: FilterBarDateValue
): (T | FilterBarDateRule)[] {
  const id = filterBarDateRuleId(columnId);
  const rule = filterBarDateRule(columnId, value);
  const others = rules.filter((item) => item.id !== id);
  return rule ? [...others, rule] : others;
}
