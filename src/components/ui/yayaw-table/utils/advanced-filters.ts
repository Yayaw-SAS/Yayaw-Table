/**
 * Advanced filters utilities
 * Provides client-side filtering functions and helpers
 */

import type {
  AdvancedFilterModel,
  AdvancedFiltersState,
  ColumnDataType,
  ColumnOption,
  FilterOperators,
  FilterValues,
} from "../types/filter-types";
import type { DateDisplayPreset } from "../types/date-types";
import { toValidDateRange } from "./date-display";
import {
  formatLocationFilterValue,
  matchesLocationFilter,
} from "./location-model";
import { dataTypeDateInput, matchesContractFilter } from "./table-contracts";
import {
  formatColumnDay,
  formatNumberValue as formatNumberText,
  type NumberFormatConfig,
} from "./value-format";

/**
 * Generate a unique ID for filters
 */
export function generateFilterId(): string {
  return `filter_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Create a new filter model
 */
export function createFilter<TType extends ColumnDataType>(
  columnId: string,
  type: TType,
  operator: FilterOperators[TType],
  values: FilterValues<TType>,
  options?: {
    label?: string;
    isActive?: boolean;
  }
): AdvancedFilterModel<TType> {
  const now = new Date();
  return {
    id: generateFilterId(),
    columnId,
    type,
    operator,
    values,
    isActive: options?.isActive ?? true,
    label: options?.label,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Update an existing filter
 */
export function updateFilter<TType extends ColumnDataType>(
  filter: AdvancedFilterModel<TType>,
  updates: Partial<Omit<AdvancedFilterModel<TType>, "id" | "createdAt">>
): AdvancedFilterModel<TType> {
  return {
    ...filter,
    ...updates,
    updatedAt: new Date(),
  };
}

/**
 * Client-side filtering functions for each data type
 */
export const clientFilterFunctions = {
  text: (
    value: unknown,
    filterValue: string,
    operator: FilterOperators["text"]
  ): boolean => {
    const strValue = String(value || "").toLowerCase();
    const strFilter = String(filterValue || "").toLowerCase();

    switch (operator) {
      case "contains":
        return strValue.includes(strFilter);
      case "equals":
        return strValue === strFilter;
      case "startsWith":
        return strValue.startsWith(strFilter);
      case "endsWith":
        return strValue.endsWith(strFilter);
      case "notContains":
        return !strValue.includes(strFilter);
      case "isEmpty":
        return !value || String(value).trim() === "";
      case "isNotEmpty":
        return !!value && String(value).trim() !== "";
      default:
        return true;
    }
  },

  number: (
    value: unknown,
    filterValue: number | [number, number],
    operator: FilterOperators["number"]
  ): boolean => {
    const numValue =
      typeof value === "number" ? value : Number.parseFloat(String(value));

    if (Number.isNaN(numValue)) {
      return operator === "isEmpty";
    }

    switch (operator) {
      case "equals":
        return numValue === (filterValue as number);
      case "greaterThan":
        return numValue > (filterValue as number);
      case "lessThan":
        return numValue < (filterValue as number);
      case "greaterThanOrEqual":
        return numValue >= (filterValue as number);
      case "lessThanOrEqual":
        return numValue <= (filterValue as number);
      case "between": {
        const [min, max] = filterValue as [number, number];
        return numValue >= min && numValue <= max;
      }
      case "notEquals":
        return numValue !== (filterValue as number);
      case "isEmpty":
        return value === null || value === undefined || Number.isNaN(numValue);
      case "isNotEmpty":
        return value !== null && value !== undefined && !Number.isNaN(numValue);
      default:
        return true;
    }
  },

  /**
   * Calendar days, compared like the shared contract (`matchesContractFilter`):
   * the record's day in the viewer's time zone against the rule's days,
   * `between` including both.
   */
  date: (
    value: unknown,
    filterValue: FilterValues<"date">,
    operator: FilterOperators["date"]
  ): boolean =>
    matchesContractFilter(value, {
      type: "date",
      operator,
      values: filterValue,
    }),

  select: (
    value: unknown,
    filterValue: string | string[],
    operator: FilterOperators["select"]
  ): boolean => {
    const strValue = String(value || "");

    switch (operator) {
      case "is":
        return strValue === (filterValue as string);
      case "isNot":
        return strValue !== (filterValue as string);
      case "isAnyOf": {
        const anyOfValues = Array.isArray(filterValue)
          ? filterValue
          : [filterValue];
        return anyOfValues.includes(strValue);
      }
      case "isNoneOf": {
        const noneOfValues = Array.isArray(filterValue)
          ? filterValue
          : [filterValue];
        return !noneOfValues.includes(strValue);
      }
      case "isEmpty":
        return !value || String(value).trim() === "";
      case "isNotEmpty":
        return !!value && String(value).trim() !== "";
      default:
        return true;
    }
  },

  multiSelect: (
    value: unknown,
    filterValue: string[],
    operator: FilterOperators["multiSelect"]
  ): boolean => {
    const arrayValue = Array.isArray(value)
      ? value.map(String)
      : [String(value || "")];
    const filterArray = Array.isArray(filterValue)
      ? filterValue
      : [filterValue];

    switch (operator) {
      case "contains":
        return filterArray.some((f) => arrayValue.includes(f));
      case "containsAll":
        return filterArray.every((f) => arrayValue.includes(f));
      case "containsNone":
        return !filterArray.some((f) => arrayValue.includes(f));
      case "isEmpty":
        return !value || (Array.isArray(value) && value.length === 0);
      case "isNotEmpty":
        return !!value && (!Array.isArray(value) || value.length > 0);
      default:
        return true;
    }
  },
};

/**
 * Apply a single filter to a data row
 */
export function applyFilter<TData = Record<string, unknown>>(
  dataRow: TData,
  filter: AdvancedFilterModel,
  accessor: (row: TData) => unknown
): boolean {
  if (!filter.isActive) {
    return true;
  }

  const value = accessor(dataRow);
  const { type, operator, values } = filter;

  switch (type) {
    case "text":
      return clientFilterFunctions.text(
        value,
        values as string,
        operator as FilterOperators["text"]
      );
    case "number":
      return clientFilterFunctions.number(
        value,
        values as number | [number, number],
        operator as FilterOperators["number"]
      );
    case "date":
      return clientFilterFunctions.date(
        value,
        values as FilterValues<"date">,
        operator as FilterOperators["date"]
      );
    case "select":
      return clientFilterFunctions.select(
        value,
        values as string | string[],
        operator as FilterOperators["select"]
      );
    case "multiSelect":
      return clientFilterFunctions.multiSelect(
        value,
        values as string[],
        operator as FilterOperators["multiSelect"]
      );
    case "location":
      return matchesLocationFilter(value, operator, values);
    default:
      return true;
  }
}

/**
 * Apply all filters to a dataset (client-side filtering)
 */
export function applyFilters<TData = Record<string, unknown>>(
  data: TData[],
  filters: AdvancedFiltersState,
  accessors: Record<string, (row: TData) => unknown>
): TData[] {
  if (!filters.length) {
    return data;
  }

  return data.filter((row) => {
    return filters.every((filter) => {
      const accessor = accessors[filter.columnId];
      if (!accessor) {
        return true;
      }
      return applyFilter(row, filter, accessor);
    });
  });
}

/**
 * Get unique values from data for faceted filtering
 */
export function getFacetedUniqueValues<TData = Record<string, unknown>>(
  data: TData[],
  accessor: (row: TData) => unknown
): Map<string, number> {
  const counts = new Map<string, number>();

  for (const row of data) {
    const value = accessor(row);
    if (Array.isArray(value)) {
      // For multi-select columns
      for (const v of value) {
        const strValue = String(v || "");
        counts.set(strValue, (counts.get(strValue) || 0) + 1);
      }
    } else {
      // For single-value columns
      const strValue = String(value || "");
      counts.set(strValue, (counts.get(strValue) || 0) + 1);
    }
  }

  return counts;
}

/**
 * Get numeric range from data
 */
export function getFacetedNumericRange<TData = Record<string, unknown>>(
  data: TData[],
  accessor: (row: TData) => unknown
): [number, number] | null {
  const values = data
    .map((row) => {
      const value = accessor(row);
      return typeof value === "number"
        ? value
        : Number.parseFloat(String(value));
    })
    .filter((v) => !Number.isNaN(v));

  if (values.length === 0) {
    return null;
  }

  return [Math.min(...values), Math.max(...values)];
}

/**
 * Get date range from data
 */
export function getFacetedDateRange<TData = Record<string, unknown>>(
  data: TData[],
  accessor: (row: TData) => unknown
): [Date, Date] | null {
  const dates = data
    .map((row) => {
      const value = accessor(row);
      const date =
        value instanceof Date ? value : new Date(value as string | number);
      return Number.isNaN(date.getTime()) ? null : date;
    })
    .filter((date): date is Date => date !== null);

  if (dates.length === 0) {
    return null;
  }

  return [
    new Date(Math.min(...dates.map((d) => d.getTime()))),
    new Date(Math.max(...dates.map((d) => d.getTime()))),
  ];
}

/** How a filter chip shows values: the column's formats and the table locale. */
export interface DateFilterDisplayOptions {
  dateDisplayPreset?: DateDisplayPreset;
  fallbackDateDisplayPreset?: DateDisplayPreset;
  dateFormat?: string;
  numberFormat?: NumberFormatConfig;
  locale?: string;
}

const isBlankFilterValue = (value: unknown) =>
  value === null || value === undefined || value === "";

/** Numbers in the column's format, including 0; ranges as "a - b". */
function formatNumberValue(
  operator: string,
  values: unknown,
  options?: DateFilterDisplayOptions
): string {
  const show = (value: unknown) =>
    isBlankFilterValue(value)
      ? ""
      : formatNumberText(value, options?.numberFormat, options?.locale);
  if (operator === "between" && Array.isArray(values)) {
    return `${show(values[0])} - ${show(values[1])}`;
  }
  return show(Array.isArray(values) ? values[0] : values);
}

/**
 * Filter dates are calendar days: they read in the date part of the
 * column's pattern or preset, never shifted by a time zone.
 */
function formatDateValue(
  operator: string,
  values: unknown,
  dateOptions?: DateFilterDisplayOptions
): string {
  const column = {
    dateDisplayPreset: dateOptions?.dateDisplayPreset,
    dateFormat: dateOptions?.dateFormat,
  };
  const day = (value: unknown) => {
    const key = dataTypeDateInput(value);
    return key
      ? formatColumnDay(
          key,
          column,
          dateOptions?.locale,
          dateOptions?.fallbackDateDisplayPreset
        )
      : undefined;
  };
  if (operator === "between") {
    const range = toValidDateRange(values);
    const start = range && day(range[0]);
    const end = range && day(range[1]);
    return start && end ? `${start} - ${end}` : String(values ?? "");
  }
  return day(Array.isArray(values) ? values[0] : values) ?? String(values ?? "");
}

/**
 * Format select values for display
 */
function formatSelectValue(values: unknown, options?: ColumnOption[]): string {
  // Options hold text; rules may hold the stored numbers or yes/no booleans.
  const label = (value: unknown) =>
    options?.find((opt) => opt.value === String(value))?.label ||
    String(value ?? "");
  return Array.isArray(values) ? values.map(label).join(", ") : label(values);
}

/**
 * Format filter value for display
 */
export function formatFilterValueForDisplay(
  type: ColumnDataType,
  operator: string,
  values: unknown,
  options?: ColumnOption[],
  dateOptions?: DateFilterDisplayOptions
): string {
  switch (type) {
    case "text":
      return String(values || "");
    case "number":
      return formatNumberValue(operator, values, dateOptions);
    case "date":
      return formatDateValue(operator, values, dateOptions);
    case "select":
    case "multiSelect":
      return formatSelectValue(values, options);
    case "location":
      return formatLocationFilterValue(
        operator,
        values,
        dateOptions?.locale ?? "en"
      );
    default:
      return String(values || "");
  }
}

/**
 * Convert advanced filters to TanStack Table ColumnFiltersState
 */
export function convertToTanStackFilters(filters: AdvancedFiltersState) {
  return filters
    .filter((filter) => filter.isActive)
    .map((filter) => ({
      id: filter.columnId,
      value: {
        type: filter.type,
        operator: filter.operator,
        values: filter.values,
      },
    }));
}

/**
 * Convert TanStack Table ColumnFiltersState to advanced filters
 */
export function convertFromTanStackFilters(
  tanStackFilters: Array<{ id: string; value: unknown }>,
  columnsConfig: Record<string, { type: ColumnDataType }>
): AdvancedFiltersState {
  return tanStackFilters
    .filter((filter) => filter.value && typeof filter.value === "object")
    .map((filter) => {
      const columnConfig = columnsConfig[filter.id];
      if (!columnConfig) {
        return null;
      }

      const filterValue = filter.value as {
        operator: FilterOperators[ColumnDataType];
        values: unknown[];
      };
      return createFilter(
        filter.id,
        columnConfig.type,
        filterValue.operator,
        filterValue.values as FilterValues<typeof columnConfig.type>
      );
    })
    .filter((filter): filter is AdvancedFilterModel => filter !== null);
}
