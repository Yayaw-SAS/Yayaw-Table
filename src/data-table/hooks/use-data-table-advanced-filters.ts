/**
 * Integration hook that combines existing useDataTable with advanced filters
 * Provides backward compatibility while adding advanced filtering capabilities
 */

import type { ColumnFiltersState } from '@tanstack/react-table';
import { useCallback, useMemo } from 'react';
import type {
  AdvancedFilterModel,
  AdvancedFiltersState,
  ColumnDataType,
  ColumnOption,
  ColumnsFilterConfig,
  FilterActions,
  FilterStrategy,
} from '../types/filter-types';
import { useDataTable } from './use-data-table';
import { useTableUrlState } from './use-table-url-state';

const DEBUG = false;

// Helper functions
function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

// Filter helper functions
function applyTextFilter(value: unknown, filter: AdvancedFilterModel): boolean {
  const textValue = String(value || '').toLowerCase();
  const textFilter = String(filter.values || '').toLowerCase();

  switch (filter.operator) {
    case 'contains':
      return textValue.includes(textFilter);
    case 'equals':
      return textValue === textFilter;
    case 'startsWith':
      return textValue.startsWith(textFilter);
    case 'endsWith':
      return textValue.endsWith(textFilter);
    case 'notContains':
      return !textValue.includes(textFilter);
    case 'isEmpty':
      return !textValue || textValue.trim() === '';
    case 'isNotEmpty':
      return textValue && textValue.trim() !== '';
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
    case 'equals':
      return numValue === numFilter;
    case 'greaterThan':
      return numValue > numFilter;
    case 'lessThan':
      return numValue < numFilter;
    case 'greaterThanOrEqual':
      return numValue >= numFilter;
    case 'lessThanOrEqual':
      return numValue <= numFilter;
    case 'notEquals':
      return numValue !== numFilter;
    case 'between':
      if (Array.isArray(filter.values) && filter.values.length === 2) {
        const min = Number(filter.values[0]);
        const max = Number(filter.values[1]);
        return numValue >= min && numValue <= max;
      }
      return true;
    case 'isEmpty':
      return value == null || value === '';
    case 'isNotEmpty':
      return value != null && value !== '';
    default:
      return true;
  }
}

function applyOptionFilter(
  value: unknown,
  filter: AdvancedFilterModel
): boolean {
  switch (filter.operator) {
    case 'is':
      return value === filter.values;
    case 'isAnyOf':
      return (
        Array.isArray(filter.values) &&
        (filter.values as unknown[]).includes(value)
      );
    case 'isNot':
      return value !== filter.values;
    case 'isNoneOf':
      return (
        Array.isArray(filter.values) &&
        !(filter.values as unknown[]).includes(value)
      );
    case 'isEmpty':
      return value == null || value === '';
    case 'isNotEmpty':
      return value != null && value !== '';
    default:
      return true;
  }
}

// Helper function for date filtering
const applyDateFilter = (
  value: unknown,
  filter: AdvancedFilterModel
): boolean => {
  const dateValue =
    value instanceof Date ? value : new Date(value as string | number);
  const dateFilter =
    filter.values instanceof Date
      ? filter.values
      : new Date(filter.values as string | number);

  switch (filter.operator) {
    case 'equals':
      return dateValue.getTime() === dateFilter.getTime();
    case 'greaterThan':
      return dateValue > dateFilter;
    case 'lessThan':
      return dateValue < dateFilter;
    case 'greaterThanOrEqual':
      return dateValue >= dateFilter;
    case 'lessThanOrEqual':
      return dateValue <= dateFilter;
    case 'between':
      if (Array.isArray(filter.values) && filter.values.length === 2) {
        const startDate = new Date(filter.values[0] as string | number);
        const endDate = new Date(filter.values[1] as string | number);
        return dateValue >= startDate && dateValue <= endDate;
      }
      return true;
    case 'isEmpty':
      return value == null;
    case 'isNotEmpty':
      return value != null;
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
    case 'contains':
      return String(value)
        .toLowerCase()
        .includes(String(filter.values).toLowerCase());
    case 'equals':
    case 'is':
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
        case 'text':
          return applyTextFilter(value, filter);
        case 'number':
          return applyNumberFilter(value, filter);
        case 'option':
        case 'multiOption':
          return applyOptionFilter(value, filter);
        case 'date':
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
    strategy = 'client',
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
    if (strategy === 'server' || !data.length || !advancedFilters.length) {
      return data;
    }

    return applyFilters(data, advancedFilters, accessors);
  }, [data, advancedFilters, accessors, strategy]);

  // Compute faceted data for options
  const _facetedData = useMemo(() => {
    if (!(autoComputeFaceted && data.length)) {
      return {};
    }

    return computeFacetedData(data, advancedColumnsConfig, accessors);
  }, [data, advancedColumnsConfig, accessors, autoComputeFaceted]);

  // Advanced filter actions using URL state
  const advancedActions: FilterActions = useMemo(
    () => ({
      addFilter: (
        filterData: Omit<AdvancedFilterModel, 'id' | 'createdAt' | 'updatedAt'>
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
        if (DEBUG) {
          // DEBUG: New filter added to collection
          console.log(
            'Added filter:',
            newFilter,
            'Total filters:',
            newFilters.length
          );
        }
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
        if (DEBUG) {
          // DEBUG: Filter updated with new properties
          console.log('Updated filter:', filterId, 'Updates:', updates);
        }
        setAdvancedFiltersFromUI(newFilters);
      },

      removeFilter: (filterId: string) => {
        const newFilters = advancedFilters.filter(
          (filter) => filter.id !== filterId
        );
        if (DEBUG) {
          // DEBUG: Filter removed from collection
          console.log(
            'Removed filter:',
            filterId,
            'Remaining:',
            newFilters.length
          );
        }
        setAdvancedFiltersFromUI(newFilters);
      },

      toggleFilter: (filterId: string) => {
        const newFilters = advancedFilters.map((filter) =>
          filter.id === filterId
            ? { ...filter, isActive: !filter.isActive, updatedAt: new Date() }
            : filter
        );
        if (DEBUG) {
          // DEBUG: Filter toggled active state
          console.log('Toggled filter:', filterId);
        }
        setAdvancedFiltersFromUI(newFilters);
      },

      clearFilters: () => {
        if (DEBUG) {
          // DEBUG: All filters cleared
          console.log('Cleared all filters');
        }
        resetAdvancedFilters();
      },

      applyPreset: (_preset: Record<string, unknown>) => {
        // TODO: Implement preset functionality
        if (DEBUG) {
          // DEBUG: Preset application requested
          console.log('Apply preset requested (not yet implemented)');
        }
      },

      savePreset: (name: string, description?: string) => {
        // TODO: Implement preset functionality
        if (DEBUG) {
          // DEBUG: Save preset requested
          console.log('Save preset requested:', name, description);
        }
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
      let value: string | number | Date = '';
      let operator = 'contains';

      switch (type) {
        case 'text':
          value = String(existingLegacyFilter.value || '');
          operator = 'contains';
          break;
        case 'number':
          value = Number(existingLegacyFilter.value) || 0;
          operator = 'equals';
          break;
        case 'date':
          value =
            existingLegacyFilter.value instanceof Date
              ? existingLegacyFilter.value
              : new Date();
          operator = 'equals';
          break;
        case 'option':
          value = String(existingLegacyFilter.value || '');
          operator = 'is';
          break;
        case 'multiOption':
          value = Array.isArray(existingLegacyFilter.value)
            ? existingLegacyFilter.value
            : [];
          operator = 'contains';
          break;
        default:
          // Handle unknown column types as text
          value = String(existingLegacyFilter.value || '');
          operator = 'contains';
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
  return columnId === 'select' || columnId === 'actions';
};

// Helper function to get operators by column type
const getOperatorsByType = (type: ColumnDataType) => {
  const operatorMap = {
    option: ['is', 'isAnyOf', 'isNot', 'isEmpty', 'isNotEmpty'],
    text: [
      'contains',
      'equals',
      'startsWith',
      'endsWith',
      'notContains',
      'isEmpty',
      'isNotEmpty',
    ],
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
    ],
    date: [
      'equals',
      'before',
      'after',
      'between',
      'notEquals',
      'isEmpty',
      'isNotEmpty',
    ],
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
    faceted: type === 'option' || type === 'multiOption',
    placeholder: column.placeholder || `Filter by ${column.label}...`,
    ...(column.description && { description: column.description }),
  };

  // Type-specific configurations
  const typeConfigs = {
    number: {
      min: column.min || 0,
      max: column.max || 10_000,
      operators: getOperatorsByType('number'),
    },
    option: {
      options: column.options || getOptionsForColumn(column.id, type),
      operators: getOperatorsByType('option'),
    },
    text: {
      operators: getOperatorsByType('text'),
    },
    date: {
      operators: getOperatorsByType('date'),
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
    [key: string]: unknown;
  }>,
  typeMapping: Record<string, ColumnDataType> = {}
): ColumnsFilterConfig {
  return useMemo(() => {
    const config: ColumnsFilterConfig = {};

    if (DEBUG) {
      console.log('Building config for columns:', columns.length);
    }

    for (const column of columns) {
      // Skip system columns
      if (isSystemColumn(column.id)) {
        continue;
      }

      const type = typeMapping[column.id] || 'text';
      config[column.id] = createColumnConfig(column, type);
    }

    if (DEBUG) {
      console.log('Built config for', Object.keys(config).length, 'columns');
    }
    return config;
  }, [columns, typeMapping]);
}

// Helper function to get options for option-type columns
function getOptionsForColumn(
  columnId: string,
  type: ColumnDataType
): ColumnOption[] | undefined {
  if (type !== 'option') {
    return;
  }

  // Static options for our example - using consistent {value, label} format
  switch (columnId) {
    case 'category':
      return [
        { value: 'Laptops', label: 'Laptops' },
        { value: 'Phones', label: 'Phones' },
        { value: 'Tablets', label: 'Tablets' },
        { value: 'Accessories', label: 'Accessories' },
      ];
    case 'status':
      return [
        { value: 'In Stock', label: 'In Stock' },
        { value: 'Low Stock', label: 'Low Stock' },
        { value: 'Out of Stock', label: 'Out of Stock' },
      ];
    case 'isActive':
      return [
        { value: true, label: 'Active' },
        { value: false, label: 'Inactive' },
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
        if (columnId.includes('.')) {
          return columnId
            .split('.')
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
    typeof filters[0] === 'object' &&
    'type' in filters[0] &&
    'operator' in filters[0]
  );
}
