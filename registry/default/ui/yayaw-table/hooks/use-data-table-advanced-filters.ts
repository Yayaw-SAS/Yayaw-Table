/**
 * Integration hook that combines existing useDataTable with advanced filters
 * Provides backward compatibility while adding advanced filtering capabilities
 */

import type { ColumnFiltersState } from "@tanstack/react-table";
import { useCallback, useMemo } from "react";
import type {
  AdvancedFilterModel,
  AdvancedFilterPreset,
  AdvancedFiltersState,
  ColumnDataType,
  ColumnOption,
  ColumnsFilterConfig,
  FilterActions,
  FilterOperators,
  FilterStrategy,
} from "../types/filter-types";
import { useDataTable } from "./use-data-table";
import { useTableUrlState } from "./use-table-url-state";

const DEBUG = false;

// Helper functions
function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

// Filter helper functions
function applyTextFilter(value: unknown, filter: AdvancedFilterModel): boolean {
  const textValue = String(value || "").toLowerCase();
  const textFilter = String(filter.values || "").toLowerCase();

  switch (filter.operator) {
    case "contains":
      return textValue.includes(textFilter);
    case "equals":
      return textValue === textFilter;
    case "startsWith":
      return textValue.startsWith(textFilter);
    case "endsWith":
      return textValue.endsWith(textFilter);
    case "notContains":
      return !textValue.includes(textFilter);
    case "isEmpty":
      return !textValue || textValue.trim() === "";
    case "isNotEmpty":
      return Boolean(textValue && textValue.trim() !== "");
    default:
      return true;
  }
}

function applyNumberFilter(
  value: unknown,
  filter: AdvancedFilterModel
): boolean {
  const numValue = Number(value);
  const numFilter = Number(filter.values);

  switch (filter.operator) {
    case "equals":
      return numValue === numFilter;
    case "greaterThan":
      return numValue > numFilter;
    case "lessThan":
      return numValue < numFilter;
    case "greaterThanOrEqual":
      return numValue >= numFilter;
    case "lessThanOrEqual":
      return numValue <= numFilter;
    case "notEquals":
      return numValue !== numFilter;
    case "between":
      if (Array.isArray(filter.values) && filter.values.length === 2) {
        const min = Number(filter.values[0]);
        const max = Number(filter.values[1]);
        return numValue >= min && numValue <= max;
      }
      return true;
    case "isEmpty":
      return value == null || value === "";
    case "isNotEmpty":
      return value != null && value !== "";
    default:
      return true;
  }
}

function applyOptionFilter(
  value: unknown,
  filter: AdvancedFilterModel
): boolean {
  switch (filter.operator) {
    case "is":
      return value === filter.values;
    case "isAnyOf":
      return (
        Array.isArray(filter.values) &&
        (filter.values as unknown[]).includes(value)
      );
    case "isNot":
      return value !== filter.values;
    case "isNoneOf":
      return (
        Array.isArray(filter.values) &&
        !(filter.values as unknown[]).includes(value)
      );
    case "isEmpty":
      return value == null || value === "";
    case "isNotEmpty":
      return value != null && value !== "";
    default:
      return true;
  }
}

const toValidDate = (value: unknown): Date | undefined => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsedDate = new Date(value);
    return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate;
  }

  return;
};

const startOfDay = (date: Date): Date => {
  const normalizedDate = new Date(date);
  normalizedDate.setHours(0, 0, 0, 0);
  return normalizedDate;
};

const endOfDay = (date: Date): Date => {
  const normalizedDate = new Date(date);
  normalizedDate.setHours(23, 59, 59, 999);
  return normalizedDate;
};

const getDateTarget = (values: unknown): Date | undefined => {
  return toValidDate(Array.isArray(values) ? values[0] : values);
};

const getDateRange = (values: unknown): [Date, Date] | undefined => {
  if (!Array.isArray(values)) {
    const singleDate = toValidDate(values);
    return singleDate ? [singleDate, singleDate] : undefined;
  }

  const startDate = toValidDate(values[0]);
  const endDate = toValidDate(values[1] ?? values[0]);
  if (!(startDate && endDate)) {
    return;
  }

  return startDate.getTime() <= endDate.getTime()
    ? [startDate, endDate]
    : [endDate, startDate];
};

// Helper function for date filtering
const applyDateFilter = (
  value: unknown,
  filter: AdvancedFilterModel
): boolean => {
  const dateValue = toValidDate(value);

  if (filter.operator === "isEmpty") {
    return !dateValue;
  }

  if (filter.operator === "isNotEmpty") {
    return Boolean(dateValue);
  }

  if (!dateValue) {
    return false;
  }

  switch (filter.operator) {
    case "equals": {
      const targetDate = getDateTarget(filter.values);
      return targetDate
        ? startOfDay(dateValue).getTime() === startOfDay(targetDate).getTime()
        : false;
    }
    case "notEquals": {
      const targetDate = getDateTarget(filter.values);
      return targetDate
        ? startOfDay(dateValue).getTime() !== startOfDay(targetDate).getTime()
        : false;
    }
    case "before":
    case "lessThan": {
      const targetDate = getDateTarget(filter.values);
      return targetDate
        ? dateValue.getTime() < startOfDay(targetDate).getTime()
        : false;
    }
    case "after":
    case "greaterThan": {
      const targetDate = getDateTarget(filter.values);
      return targetDate
        ? dateValue.getTime() > endOfDay(targetDate).getTime()
        : false;
    }
    case "greaterThanOrEqual": {
      const targetDate = getDateTarget(filter.values);
      return targetDate
        ? dateValue.getTime() >= startOfDay(targetDate).getTime()
        : false;
    }
    case "lessThanOrEqual": {
      const targetDate = getDateTarget(filter.values);
      return targetDate
        ? dateValue.getTime() <= endOfDay(targetDate).getTime()
        : false;
    }
    case "between": {
      const range = getDateRange(filter.values);
      if (!range) {
        return false;
      }

      const [startDate, endDate] = range;
      const valueTime = dateValue.getTime();
      return (
        valueTime >= startOfDay(startDate).getTime() &&
        valueTime <= endOfDay(endDate).getTime()
      );
    }
    default:
      return true;
  }
};

// Helper function for fallback filtering (backward compatibility)
const applyFallbackFilter = (
  value: unknown,
  filter: AdvancedFilterModel
): boolean => {
  switch (filter.operator) {
    case "contains":
      return String(value)
        .toLowerCase()
        .includes(String(filter.values).toLowerCase());
    case "equals":
    case "is":
      return value === filter.values;
    default:
      return true;
  }
};

function applyFilters<TData>(
  data: TData[],
  filters: AdvancedFilterModel[],
  accessors: Record<string, (row: TData) => unknown>
): TData[] {
  if (!filters.length) {
    return data;
  }

  return data.filter((row) => {
    return filters.every((filter) => {
      if (!filter.isActive) {
        return true;
      }

      const accessor = accessors[filter.columnId];
      if (!accessor) {
        return true;
      }

      const value = accessor(row);

      // Enhanced filtering logic using helper functions
      switch (filter.type) {
        case "text":
          return applyTextFilter(value, filter);
        case "number":
          return applyNumberFilter(value, filter);
        case "option":
        case "multiOption":
          return applyOptionFilter(value, filter);
        case "date":
          return applyDateFilter(value, filter);
        default:
          return applyFallbackFilter(value, filter);
      }
    });
  });
}

function computeFacetedData(
  _data: unknown[],
  _columnsConfig: ColumnsFilterConfig,
  _accessors: Record<string, (row: unknown) => unknown>
): Record<string, unknown> {
  // Simple implementation - just return empty for now
  return {};
}

export interface UseDataTableAdvancedFiltersOptions<
  TData = Record<string, unknown>,
> {
  /** Table identifier */
  tableType: string;
  /** Filter strategy - client or server */
  strategy?: FilterStrategy;
  /** Data to filter (for client-side filtering) */
  data?: TData[];
  /** Advanced columns configuration */
  advancedColumnsConfig?: ColumnsFilterConfig;
  /** Column accessors for data extraction */
  accessors?: Record<string, (row: TData) => unknown>;
  /** Auto-compute faceted data */
  autoComputeFaceted?: boolean;
}

export interface UseDataTableAdvancedFiltersReturn<
  TData = Record<string, unknown>,
> {
  // Original useDataTable return values
  columnFilters: ColumnFiltersState;
  setColumnFilters: (state: ColumnFiltersState) => void;

  // Advanced filters values
  advancedFilters: AdvancedFiltersState;
  advancedActions: FilterActions;
  filteredData: TData[];
  hasAdvancedFilters: boolean;
  activeAdvancedFiltersCount: number;

  // Combined state
  hasAnyFilters: boolean;
  totalActiveFiltersCount: number;

  // Utility functions
  clearAllFilters: () => void;
  convertLegacyToAdvanced: (columnId: string, type: ColumnDataType) => void;
}

/**
 * Hook that integrates existing table filtering with advanced filters using URL state
 */
export function useDataTableAdvancedFilters<TData = Record<string, unknown>>(
  options: UseDataTableAdvancedFiltersOptions<TData>
): UseDataTableAdvancedFiltersReturn<TData> {
  const {
    tableType,
    strategy = "client",
    data = [],
    advancedColumnsConfig = {},
    accessors = {},
    autoComputeFaceted = true,
  } = options;

  // Use existing data table hook for backward compatibility
  const dataTableResult = useDataTable({ tableType });
  const { setColumnFilters } = dataTableResult;
  const columnFilters = dataTableResult.state.columnFilters;

  // Use URL state for advanced filters
  const {
    advancedFiltersParam,
    setAdvancedFiltersFromUI,
    resetAdvancedFilters,
  } = useTableUrlState({ tableId: tableType });

  // Advanced filters from URL state
  const advancedFilters = advancedFiltersParam || [];

  if (DEBUG) {
    // Debug log for advanced filters
  }

  // Apply client-side filtering
  const filteredData = useMemo(() => {
    if (strategy === "server" || !data.length || !advancedFilters.length) {
      return data;
    }

    return applyFilters(data, advancedFilters, accessors);
  }, [data, advancedFilters, accessors, strategy]);

  // Compute faceted data for options
  const _facetedData = useMemo(() => {
    if (!(autoComputeFaceted && data.length)) {
      return {};
    }

    return computeFacetedData(
      data,
      advancedColumnsConfig,
      accessors as Record<string, (row: unknown) => unknown>
    );
  }, [data, advancedColumnsConfig, accessors, autoComputeFaceted]);

  // Advanced filter actions using URL state
  const advancedActions: FilterActions = useMemo(
    () => ({
      addFilter: (
        filterData: Omit<AdvancedFilterModel, "id" | "createdAt" | "updatedAt">
      ) => {
        const now = new Date();
        const newFilter: AdvancedFilterModel = {
          ...filterData,
          id: generateId(),
          label: filterData.label || filterData.columnId,
          createdAt: now,
          updatedAt: now,
        };

        const newFilters = [...advancedFilters, newFilter];
        setAdvancedFiltersFromUI(newFilters);
      },

      updateFilter: (
        filterId: string,
        updates: Partial<AdvancedFilterModel>
      ) => {
        const newFilters = advancedFilters.map((filter) =>
          filter.id === filterId
            ? { ...filter, ...updates, updatedAt: new Date() }
            : filter
        );
        setAdvancedFiltersFromUI(newFilters);
      },

      removeFilter: (filterId: string) => {
        const newFilters = advancedFilters.filter(
          (filter) => filter.id !== filterId
        );
        setAdvancedFiltersFromUI(newFilters);
      },

      toggleFilter: (filterId: string) => {
        const newFilters = advancedFilters.map((filter) =>
          filter.id === filterId
            ? { ...filter, isActive: !filter.isActive, updatedAt: new Date() }
            : filter
        );
        setAdvancedFiltersFromUI(newFilters);
      },

      clearFilters: () => {
        resetAdvancedFilters();
      },

      applyPreset: (_preset: AdvancedFilterPreset) => {
        // TODO: Implement preset functionality
      },

      savePreset: (name: string, description?: string) => {
        // TODO: Implement preset functionality
        return {
          id: generateId(),
          name,
          description,
          filters: advancedFilters,
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: [],
          isPublic: false,
        };
      },
    }),
    [advancedFilters, setAdvancedFiltersFromUI, resetAdvancedFilters]
  );

  // Convert legacy filter to advanced filter
  const convertLegacyToAdvanced = useCallback(
    (columnId: string, type: ColumnDataType) => {
      const existingLegacyFilter = columnFilters.find(
        (f: { id: string }) => f.id === columnId
      );
      if (!existingLegacyFilter) {
        return;
      }

      // Remove from legacy filters
      setColumnFilters(
        columnFilters.filter((f: { id: string }) => f.id !== columnId)
      );

      // Add to advanced filters
      let value:
        | string
        | number
        | Date
        | string[]
        | [number, number]
        | [Date, Date] = "";
      let operator: FilterOperators[ColumnDataType] = "contains";

      switch (type) {
        case "text":
          value = String(existingLegacyFilter.value || "");
          operator = "contains" as FilterOperators["text"];
          break;
        case "number":
          value = Number(existingLegacyFilter.value) || 0;
          operator = "equals" as FilterOperators["number"];
          break;
        case "date":
          value =
            existingLegacyFilter.value instanceof Date
              ? existingLegacyFilter.value
              : new Date();
          operator = "equals" as FilterOperators["date"];
          break;
        case "option":
          value = String(existingLegacyFilter.value || "");
          operator = "is" as FilterOperators["option"];
          break;
        case "multiOption":
          value = Array.isArray(existingLegacyFilter.value)
            ? (existingLegacyFilter.value as string[])
            : [];
          operator = "contains" as FilterOperators["multiOption"];
          break;
        default:
          // Handle unknown column types as text
          value = String(existingLegacyFilter.value || "");
          operator = "contains" as FilterOperators["text"];
          break;
      }

      advancedActions.addFilter({
        columnId,
        type,
        operator,
        values: value,
        isActive: true,
      });
    },
    [columnFilters, setColumnFilters, advancedActions]
  );

  // Clear all filters (both legacy and advanced)
  const clearAllFilters = useCallback(() => {
    setColumnFilters([]);
    advancedActions.clearFilters();
  }, [setColumnFilters, advancedActions]);

  // Calculate combined state
  const hasAdvancedFilters = advancedFilters.length > 0;
  const activeAdvancedFiltersCount = advancedFilters.filter(
    (f) => f.isActive
  ).length;
  const hasLegacyFilters = columnFilters.length > 0;
  const hasAnyFilters = hasAdvancedFilters || hasLegacyFilters;
  const totalActiveFiltersCount =
    activeAdvancedFiltersCount + columnFilters.length;

  return {
    // Legacy compatibility
    columnFilters,
    setColumnFilters,

    // Advanced filters
    advancedFilters,
    advancedActions,
    filteredData,
    hasAdvancedFilters,
    activeAdvancedFiltersCount,

    // Combined state
    hasAnyFilters,
    totalActiveFiltersCount,

    // Utilities
    clearAllFilters,
    convertLegacyToAdvanced,
  };
}

// Helper function to check if column is a system column
const isSystemColumn = (columnId: string): boolean => {
  return columnId === "select" || columnId === "actions";
};

const normalizeColumnDataType = (type: unknown): ColumnDataType | undefined => {
  if (typeof type !== "string") {
    return;
  }

  switch (type) {
    case "text":
    case "number":
    case "date":
    case "option":
    case "multiOption":
      return type;
    case "boolean":
    case "select":
    case "tag":
      return "option";
    case "string":
    case "code":
      return "text";
    default:
      return;
  }
};

const resolveColumnFilterType = (
  column: {
    id: string;
    type?: ColumnDataType | string;
    options?: unknown;
  },
  typeMapping: Record<string, ColumnDataType>
): ColumnDataType => {
  const mappedType = normalizeColumnDataType(typeMapping[column.id]);
  if (mappedType) {
    return mappedType;
  }

  const declaredType = normalizeColumnDataType(column.type);
  if (declaredType) {
    return declaredType;
  }

  if (Array.isArray(column.options) && column.options.length > 0) {
    return "option";
  }

  return "text";
};

// Helper function to get operators by column type
const getOperatorsByType = (
  type: ColumnDataType
): FilterOperators[ColumnDataType][] => {
  const operatorMap: Record<ColumnDataType, FilterOperators[ColumnDataType][]> =
    {
      option: [
        "is",
        "isAnyOf",
        "isNot",
        "isEmpty",
        "isNotEmpty",
      ] as FilterOperators["option"][],
      text: [
        "contains",
        "equals",
        "startsWith",
        "endsWith",
        "notContains",
        "isEmpty",
        "isNotEmpty",
      ] as FilterOperators["text"][],
      number: [
        "equals",
        "greaterThan",
        "lessThan",
        "greaterThanOrEqual",
        "lessThanOrEqual",
        "between",
        "notEquals",
        "isEmpty",
        "isNotEmpty",
      ] as FilterOperators["number"][],
      date: [
        "equals",
        "before",
        "after",
        "between",
        "notEquals",
        "isEmpty",
        "isNotEmpty",
      ] as FilterOperators["date"][],
      multiOption: [
        "contains",
        "containsAll",
        "containsNone",
        "isEmpty",
        "isNotEmpty",
      ] as FilterOperators["multiOption"][],
    };
  return operatorMap[type] || [];
};

// Helper function to create column configuration
const createColumnConfig = (
  column: {
    id: string;
    label: string;
    canFilter?: boolean;
    [key: string]: unknown;
  },
  type: ColumnDataType
) => {
  const baseConfig = {
    type,
    filterable: column.canFilter !== false,
    faceted: type === "option" || type === "multiOption",
    placeholder: String(column.placeholder) || `Filter by ${column.label}...`,
    ...(column.description ? { description: String(column.description) } : {}),
  };

  // Type-specific configurations
  const typeConfigs = {
    number: {
      min: Number(column.min) || 0,
      max: Number(column.max) || 10_000,
      operators: getOperatorsByType("number"),
    },
    option: {
      options: (Array.isArray(column.options)
        ? column.options
        : getOptionsForColumn(column.id, type)) as ColumnOption[],
      operators: getOperatorsByType("option"),
    },
    text: {
      operators: getOperatorsByType("text"),
    },
    date: {
      operators: getOperatorsByType("date"),
    },
    multiOption: {
      options: (Array.isArray(column.options)
        ? column.options
        : getOptionsForColumn(column.id, type)) as ColumnOption[],
      operators: getOperatorsByType("multiOption"),
    },
  };

  return {
    ...baseConfig,
    ...(typeConfigs[type] || {}),
  };
};

export function useColumnsFilterConfig(
  columns: Array<{
    id: string;
    label: string;
    canFilter?: boolean;
    type?: ColumnDataType | string;
    options?: unknown;
    [key: string]: unknown;
  }>,
  typeMapping: Record<string, ColumnDataType> = {}
): ColumnsFilterConfig {
  return useMemo(() => {
    const config: ColumnsFilterConfig = {};
    for (const column of columns) {
      // Skip system columns
      if (isSystemColumn(column.id)) {
        continue;
      }

      const type = resolveColumnFilterType(column, typeMapping);
      config[column.id] = createColumnConfig(column, type);
    }
    return config;
  }, [columns, typeMapping]);
}

// Helper function to get options for option-type columns
function getOptionsForColumn(
  columnId: string,
  type: ColumnDataType
): ColumnOption[] | undefined {
  if (type !== "option") {
    return;
  }

  // Static options for our example - using consistent {value, label} format
  switch (columnId) {
    case "category":
      return [
        { value: "Laptops", label: "Laptops" },
        { value: "Phones", label: "Phones" },
        { value: "Tablets", label: "Tablets" },
        { value: "Accessories", label: "Accessories" },
      ];
    case "status":
      return [
        { value: "In Stock", label: "In Stock" },
        { value: "Low Stock", label: "Low Stock" },
        { value: "Out of Stock", label: "Out of Stock" },
      ];
    case "isActive":
      return [
        { value: "true", label: "Active" },
        { value: "false", label: "Inactive" },
      ];
    default:
      return;
  }
}

/**
 * Helper hook for creating accessors from table data
 */
export function useTableAccessors<TData = Record<string, unknown>>(
  _data: TData[],
  columnIds: string[]
): Record<string, (row: TData) => unknown> {
  return useMemo(() => {
    const accessors: Record<string, (row: TData) => unknown> = {};

    for (const columnId of columnIds) {
      accessors[columnId] = (row: TData) => {
        // Handle nested property access like "user.name"
        if (columnId.includes(".")) {
          return columnId
            .split(".")
            .reduce(
              (obj: unknown, key) => (obj as Record<string, unknown>)?.[key],
              row
            );
        }
        // Simple property access
        return (row as Record<string, unknown>)[columnId];
      };
    }

    return accessors;
  }, [columnIds]);
}

/**
 * Type guard to check if filters are advanced filters
 */
export function isAdvancedFiltersState(
  filters: ColumnFiltersState | AdvancedFiltersState
): filters is AdvancedFiltersState {
  return (
    Array.isArray(filters) &&
    filters.length > 0 &&
    typeof filters[0] === "object" &&
    "type" in filters[0] &&
    "operator" in filters[0]
  );
}
