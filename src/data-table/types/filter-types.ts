/**
 * Advanced filter types inspired by bazza/ui
 * Provides type-safe filtering for different data types
 */

import type { ReactElement } from 'react';

/**
 * Supported column data types for filtering
 */
export type ColumnDataType =
  | 'text'
  | 'number'
  | 'date'
  | 'option'
  | 'multiOption';

/**
 * Filter operators mapped by data type
 */
export type FilterOperators = {
  text:
    | 'contains'
    | 'equals'
    | 'startsWith'
    | 'endsWith'
    | 'notContains'
    | 'isEmpty'
    | 'isNotEmpty';
  number:
    | 'equals'
    | 'greaterThan'
    | 'lessThan'
    | 'greaterThanOrEqual'
    | 'lessThanOrEqual'
    | 'between'
    | 'notEquals'
    | 'isEmpty'
    | 'isNotEmpty';
  date:
    | 'equals'
    | 'before'
    | 'after'
    | 'between'
    | 'notEquals'
    | 'isEmpty'
    | 'isNotEmpty';
  option: 'is' | 'isNot' | 'isAnyOf' | 'isNoneOf' | 'isEmpty' | 'isNotEmpty';
  multiOption:
    | 'contains'
    | 'containsAll'
    | 'containsNone'
    | 'isEmpty'
    | 'isNotEmpty';
};

/**
 * Filter values mapped by data type
 */
export type FilterValues<TType extends ColumnDataType = ColumnDataType> =
  TType extends 'text'
    ? string
    : TType extends 'number'
      ? number | [number, number]
      : TType extends 'date'
        ? Date | [Date, Date]
        : TType extends 'option'
          ? string | string[]
          : TType extends 'multiOption'
            ? string[]
            : unknown;

/**
 * Advanced filter model for a single column
 */
export interface AdvancedFilterModel<
  TType extends ColumnDataType = ColumnDataType,
> {
  /** Unique identifier for the filter */
  id: string;
  /** Column ID this filter applies to */
  columnId: string;
  /** Data type of the column */
  type: TType;
  /** Filter operator */
  operator: FilterOperators[TType];
  /** Filter values */
  values: FilterValues<TType>;
  /** Whether the filter is currently active */
  isActive: boolean;
  /** Optional label for display */
  label?: string;
  /** Timestamp when filter was created */
  createdAt: Date;
  /** Timestamp when filter was last modified */
  updatedAt: Date;
}

/**
 * Collection of active filters
 */
export type AdvancedFiltersState = AdvancedFilterModel[];

/**
 * Column option for option-based filters
 */
export interface ColumnOption {
  /** Display label */
  label: string;
  /** Internal value */
  value: string;
  /** Optional icon component */
  icon?: ReactElement | React.ComponentType;
  /** Count of occurrences (for faceted filtering) */
  count?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Filter configuration for a column
 */
export interface ColumnFilterConfig<
  TType extends ColumnDataType = ColumnDataType,
> {
  /** Data type of the column */
  type: TType;
  /** Available operators (defaults to all for the type) */
  operators?: FilterOperators[TType][];
  /** Options for option/multiOption types */
  options?: ColumnOption[];
  /** Minimum value for number types */
  min?: number;
  /** Maximum value for number types */
  max?: number;
  /** Placeholder text for input */
  placeholder?: string;
  /** Whether to show faceted counts */
  faceted?: boolean;
  /** Whether this column can be filtered */
  filterable?: boolean;
  /** Custom filter function for client-side filtering */
  filterFn?: (
    value: unknown,
    filterValue: FilterValues<TType>,
    operator: FilterOperators[TType]
  ) => boolean;
  /** Transform function for displaying values */
  displayValueFn?: (value: FilterValues<TType>) => string;
}

/**
 * Faceted values for a column
 */
export type FacetedValues = {
  /** For option-based columns: Map of option value to count */
  uniqueValues?: Map<string, number>;
  /** For number columns: [min, max] range */
  range?: [number, number];
  /** For date columns: [earliest, latest] range */
  dateRange?: [Date, Date];
};

/**
 * Configuration for all filterable columns
 */
export type ColumnsFilterConfig = Record<string, ColumnFilterConfig>;

/**
 * Faceted data for all columns
 */
export type ColumnsFacetedData = Record<string, FacetedValues>;

/**
 * Advanced filter preset for saving/loading filter combinations
 */
export interface AdvancedFilterPreset {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Description */
  description?: string;
  /** The filters in this preset */
  filters: AdvancedFiltersState;
  /** Whether this is a default/system preset */
  isDefault?: boolean;
  /** Creation timestamp */
  createdAt: Date;
  /** Tags for categorization */
  tags?: string[];
}

/**
 * Filter strategy - where filtering happens
 */
export type FilterStrategy = 'client' | 'server';

/**
 * Filter context for passing data to components
 */
export interface FilterContext {
  /** Current filters state */
  filters: AdvancedFiltersState;
  /** Available columns configuration */
  columnsConfig: ColumnsFilterConfig;
  /** Faceted data for columns */
  facetedData?: ColumnsFacetedData;
  /** Filter strategy */
  strategy: FilterStrategy;
  /** Actions for managing filters */
  actions: FilterActions;
}

/**
 * Actions for managing filters
 */
export interface FilterActions {
  /** Add a new filter */
  addFilter: (
    filter: Omit<AdvancedFilterModel, 'id' | 'createdAt' | 'updatedAt'>
  ) => void;
  /** Update an existing filter */
  updateFilter: (
    filterId: string,
    updates: Partial<AdvancedFilterModel>
  ) => void;
  /** Remove a filter */
  removeFilter: (filterId: string) => void;
  /** Clear all filters */
  clearFilters: () => void;
  /** Toggle filter active state */
  toggleFilter: (filterId: string) => void;
  /** Apply a filter preset */
  applyPreset: (preset: AdvancedFilterPreset) => void;
  /** Save current filters as preset */
  savePreset: (name: string, description?: string) => AdvancedFilterPreset;
}

/**
 * Filter operators labels for display
 */
export const FILTER_OPERATORS_LABELS: Record<
  ColumnDataType,
  Record<string, string>
> = {
  text: {
    contains: 'Contains',
    equals: 'Equals',
    startsWith: 'Starts with',
    endsWith: 'Ends with',
    notContains: 'Does not contain',
    isEmpty: 'Is empty',
    isNotEmpty: 'Is not empty',
  },
  number: {
    equals: 'Equals',
    greaterThan: 'Greater than',
    lessThan: 'Less than',
    greaterThanOrEqual: 'Greater than or equal',
    lessThanOrEqual: 'Less than or equal',
    between: 'Between',
    notEquals: 'Not equal',
    isEmpty: 'Is empty',
    isNotEmpty: 'Is not empty',
  },
  date: {
    equals: 'Equals',
    before: 'Before',
    after: 'After',
    between: 'Between',
    notEquals: 'Not equal',
    isEmpty: 'Is empty',
    isNotEmpty: 'Is not empty',
  },
  option: {
    is: 'Is',
    isNot: 'Is not',
    isAnyOf: 'Is any of',
    isNoneOf: 'Is none of',
    isEmpty: 'Is empty',
    isNotEmpty: 'Is not empty',
  },
  multiOption: {
    contains: 'Contains',
    containsAll: 'Contains all',
    containsNone: 'Contains none',
    isEmpty: 'Is empty',
    isNotEmpty: 'Is not empty',
  },
};

/**
 * Default operators for each data type
 */
export const DEFAULT_OPERATORS = {
  text: [
    'contains',
    'equals',
    'startsWith',
    'endsWith',
    'notContains',
    'isEmpty',
    'isNotEmpty',
  ] as const,
  number: [
    'equals',
    'greaterThan',
    'lessThan',
    'greaterThanOrEqual',
    'lessThanOrEqual',
    'between',
    'notEquals',
    'isEmpty',
    'isNotEmpty',
  ] as const,
  date: [
    'equals',
    'before',
    'after',
    'between',
    'notEquals',
    'isEmpty',
    'isNotEmpty',
  ] as const,
  option: [
    'is',
    'isNot',
    'isAnyOf',
    'isNoneOf',
    'isEmpty',
    'isNotEmpty',
  ] as const,
  multiOption: [
    'contains',
    'containsAll',
    'containsNone',
    'isEmpty',
    'isNotEmpty',
  ] as const,
} as const;
