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
} from '../types/filter-types';

/**
 * Generate a unique ID for filters
 */
export function generateFilterId(): string {
  return `filter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
  updates: Partial<Omit<AdvancedFilterModel<TType>, 'id' | 'createdAt'>>
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
    operator: FilterOperators['text']
  ): boolean => {
    const strValue = String(value || '').toLowerCase();
    const strFilter = String(filterValue || '').toLowerCase();

    switch (operator) {
      case 'contains':
        return strValue.includes(strFilter);
      case 'equals':
        return strValue === strFilter;
      case 'startsWith':
        return strValue.startsWith(strFilter);
      case 'endsWith':
        return strValue.endsWith(strFilter);
      case 'notContains':
        return !strValue.includes(strFilter);
      case 'isEmpty':
        return !value || String(value).trim() === '';
      case 'isNotEmpty':
        return !!value && String(value).trim() !== '';
      default:
        return true;
    }
  },

  number: (
    value: unknown,
    filterValue: number | [number, number],
    operator: FilterOperators['number']
  ): boolean => {
    const numValue =
      typeof value === 'number' ? value : Number.parseFloat(String(value));

    if (Number.isNaN(numValue)) {
      return operator === 'isEmpty';
    }

    switch (operator) {
      case 'equals':
        return numValue === (filterValue as number);
      case 'greaterThan':
        return numValue > (filterValue as number);
      case 'lessThan':
        return numValue < (filterValue as number);
      case 'greaterThanOrEqual':
        return numValue >= (filterValue as number);
      case 'lessThanOrEqual':
        return numValue <= (filterValue as number);
      case 'between': {
        const [min, max] = filterValue as [number, number];
        return numValue >= min && numValue <= max;
      }
      case 'notEquals':
        return numValue !== (filterValue as number);
      case 'isEmpty':
        return value === null || value === undefined || Number.isNaN(numValue);
      case 'isNotEmpty':
        return value !== null && value !== undefined && !Number.isNaN(numValue);
      default:
        return true;
    }
  },

  date: (
    value: unknown,
    filterValue: Date | [Date, Date],
    operator: FilterOperators['date']
  ): boolean => {
    const dateValue =
      value instanceof Date ? value : new Date(value as string | number);

    if (Number.isNaN(dateValue.getTime())) {
      return operator === 'isEmpty';
    }

    switch (operator) {
      case 'equals': {
        const filterDate = filterValue as Date;
        return dateValue.toDateString() === filterDate.toDateString();
      }
      case 'before':
        return dateValue < (filterValue as Date);
      case 'after':
        return dateValue > (filterValue as Date);
      case 'between': {
        const [startDate, endDate] = filterValue as [Date, Date];
        return dateValue >= startDate && dateValue <= endDate;
      }
      case 'notEquals': {
        const notEqualDate = filterValue as Date;
        return dateValue.toDateString() !== notEqualDate.toDateString();
      }
      case 'isEmpty':
        return !value || Number.isNaN(dateValue.getTime());
      case 'isNotEmpty':
        return !!value && !Number.isNaN(dateValue.getTime());
      default:
        return true;
    }
  },

  option: (
    value: unknown,
    filterValue: string | string[],
    operator: FilterOperators['option']
  ): boolean => {
    const strValue = String(value || '');

    switch (operator) {
      case 'is':
        return strValue === (filterValue as string);
      case 'isNot':
        return strValue !== (filterValue as string);
      case 'isAnyOf': {
        const anyOfValues = Array.isArray(filterValue)
          ? filterValue
          : [filterValue];
        return anyOfValues.includes(strValue);
      }
      case 'isNoneOf': {
        const noneOfValues = Array.isArray(filterValue)
          ? filterValue
          : [filterValue];
        return !noneOfValues.includes(strValue);
      }
      case 'isEmpty':
        return !value || String(value).trim() === '';
      case 'isNotEmpty':
        return !!value && String(value).trim() !== '';
      default:
        return true;
    }
  },

  multiOption: (
    value: unknown,
    filterValue: string[],
    operator: FilterOperators['multiOption']
  ): boolean => {
    const arrayValue = Array.isArray(value)
      ? value.map(String)
      : [String(value || '')];
    const filterArray = Array.isArray(filterValue)
      ? filterValue
      : [filterValue];

    switch (operator) {
      case 'contains':
        return filterArray.some((f) => arrayValue.includes(f));
      case 'containsAll':
        return filterArray.every((f) => arrayValue.includes(f));
      case 'containsNone':
        return !filterArray.some((f) => arrayValue.includes(f));
      case 'isEmpty':
        return !value || (Array.isArray(value) && value.length === 0);
      case 'isNotEmpty':
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
    case 'text':
      return clientFilterFunctions.text(
        value,
        values as string,
        operator as FilterOperators['text']
      );
    case 'number':
      return clientFilterFunctions.number(
        value,
        values as number | [number, number],
        operator as FilterOperators['number']
      );
    case 'date':
      return clientFilterFunctions.date(
        value,
        values as Date | [Date, Date],
        operator as FilterOperators['date']
      );
    case 'option':
      return clientFilterFunctions.option(
        value,
        values as string | string[],
        operator as FilterOperators['option']
      );
    case 'multiOption':
      return clientFilterFunctions.multiOption(
        value,
        values as string[],
        operator as FilterOperators['multiOption']
      );
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
      // For multi-option columns
      for (const v of value) {
        const strValue = String(v || '');
        counts.set(strValue, (counts.get(strValue) || 0) + 1);
      }
    } else {
      // For single-value columns
      const strValue = String(value || '');
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
      return typeof value === 'number'
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

/**
 * Format number values for display
 */
function formatNumberValue(operator: string, values: unknown): string {
  if (operator === 'between' && Array.isArray(values)) {
    return `${values[0]} - ${values[1]}`;
  }
  return String(values || '');
}

/**
 * Format date values for display
 */
function formatDateValue(operator: string, values: unknown): string {
  if (operator === 'between' && Array.isArray(values)) {
    const [start, end] = values as [Date, Date];
    return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
  }
  if (values instanceof Date) {
    return values.toLocaleDateString();
  }
  return String(values || '');
}

/**
 * Format option values for display
 */
function formatOptionValue(values: unknown, options?: ColumnOption[]): string {
  if (Array.isArray(values)) {
    return values
      .map((v) => options?.find((opt) => opt.value === v)?.label || v)
      .join(', ');
  }
  return (
    options?.find((opt) => opt.value === values)?.label || String(values || '')
  );
}

/**
 * Format filter value for display
 */
export function formatFilterValueForDisplay(
  type: ColumnDataType,
  operator: string,
  values: unknown,
  options?: ColumnOption[]
): string {
  switch (type) {
    case 'text':
      return String(values || '');
    case 'number':
      return formatNumberValue(operator, values);
    case 'date':
      return formatDateValue(operator, values);
    case 'option':
    case 'multiOption':
      return formatOptionValue(values, options);
    default:
      return String(values || '');
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
    .filter((filter) => filter.value && typeof filter.value === 'object')
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
