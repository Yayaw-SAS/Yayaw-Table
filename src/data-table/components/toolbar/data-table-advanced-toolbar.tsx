/**
 * Advanced toolbar component for DataTable
 * Provides advanced filtering, view management, and other table controls
 */
'use client';

// Import table configuration
import { useQueryClient } from '@tanstack/react-query';
import type {
  ColumnDef,
  ColumnFiltersState,
  ColumnSizingState,
  GroupingState,
  SortingState,
  Table,
  VisibilityState,
} from '@tanstack/react-table';
import { useSetAtom } from 'jotai';
import { PlusIcon, Search } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDataTable } from '../../hooks/use-data-table';
import {
  useColumnsFilterConfig,
  useDataTableAdvancedFilters,
  useTableAccessors,
} from '../../hooks/use-data-table-advanced-filters';
import { useTableConfig } from '../../hooks/use-table-config';
import { useTableInstance } from '../../hooks/use-table-instance';
import { useTranslations } from '../../providers/table-provider';
import type { ColumnDataType } from '../../types';
import {
  catalogueFormAtom,
  openCreateForm,
} from '../forms/atoms/catalogue-form-atoms';

import { TableMenu } from './table-menu';

// Debug flag to help track issues - activated for debugging
const DEBUG = false;

// Define DataTableColumnDef type to fix TypeScript errors
export type DataTableColumnDef<TData> = ColumnDef<TData> & {
  enableHiding?: boolean;
  meta?: {
    label?: string;
  };
};

/**
 * Props for the DataTableAdvancedToolbar component - DEPRECATED: use only tableId
 */
interface DataTableAdvancedToolbarProps<_TData = Record<string, unknown>> {
  /**
   * CSS class name
   */
  className?: string;

  /**
   * Column filters state
   */
  columnFilters?: ColumnFiltersState;

  /**
   * Available columns with their metadata
   */
  columns?: {
    canFilter?: boolean;
    canGroup?: boolean;
    canHide?: boolean;
    canSort?: boolean;
    id: string;
    label: string;
  }[];

  /**
   * Column visibility state
   */
  columnVisibility?: VisibilityState;

  /**
   * Grouping state
   */
  grouping?: GroupingState;

  /**
   * Whether to hide the global filter
   */
  hideGlobalFilter?: boolean;

  /**
   * Whether to hide the menu
   */
  hideMenu?: boolean;

  /**
   * Whether to hide view options
   */
  hideViewOptions?: boolean;

  /**
   * Menu button props
   */
  menuButtonProps?: Record<string, unknown>;

  /**
   * Function to set column filters
   */
  setColumnFilters?: (state: ColumnFiltersState) => void;

  /**
   * Function to set column visibility
   */
  setColumnVisibility?: (state: VisibilityState) => void;

  /**
   * Function to set grouping
   */
  setGrouping?: (state: GroupingState) => void;

  /**
   * Function to set sorting
   */
  setSorting?: (state: SortingState) => void;

  /**
   * Sorting state
   */
  sorting?: SortingState;

  /**
   * Table instance
   */
  table?: Table<Record<string, unknown>>;

  /**
   * Table ID for identifying which table this toolbar controls
   */
  tableId: string;

  /**
   * View options
   */
  viewOptions?: Record<string, unknown>;

  /**
   * Whether to enable advanced filtering
   */
  enableAdvancedFilters?: boolean;

  /**
   * Data for advanced filtering (optional, if not provided, will be fetched)
   */
  data?: Record<string, unknown>[];

  /**
   * Column type mapping for advanced filters
   */
  columnTypeMapping?: Record<
    string,
    'text' | 'number' | 'date' | 'option' | 'multiOption'
  >;
}

// Define DataTableState type to handle state properties
interface DataTableState {
  columnFilters?: ColumnFiltersState;
  columns?: Record<string, unknown>[];
  columnVisibility?: VisibilityState;
  grouping?: GroupingState;
  sorting?: SortingState;
}

// Removed unused renderToolbarContent function - was causing import errors

/**
 * Helper function to create column options from table configuration
 */
function createColumnOptions(
  tableConfig: Record<string, unknown>,
  columnTypeMapping: Record<string, string>
) {
  if (DEBUG) {
    console.log('🔧 Creating columnOptions from table config:', {
      tableConfig,
      'column definitions':
        (
          (tableConfig?.columns as Record<string, unknown>)
            ?.definitions as unknown[]
        )?.length || 0,
      columnTypeMapping,
    });
  }

  // Get column definitions from table configuration
  const columns = tableConfig.columns as Record<string, unknown> | undefined;
  const columnDefinitions =
    (columns?.definitions as Record<string, unknown>[]) || [];

  // Create column options from configuration instead of table instance
  const options = columnDefinitions
    .filter((colDef) => colDef.id !== 'select' && colDef.id !== 'actions') // Skip system columns
    .map((colDef) => {
      const option = {
        canFilter: colDef.enableColumnFilter !== false,
        canHide: true, // Most columns can be hidden
        canSort: colDef.enableSorting !== false,
        id: String(colDef.id),
        label: String(colDef.header || colDef.id),
        // Enhanced properties from column definition
        placeholder: `Filter by ${colDef.header || colDef.id}...`,
        type: colDef.type,
      };

      if (DEBUG) {
        console.log('🔧 Created column option:', option);
      }

      return option;
    });

  if (DEBUG) {
    console.log('🔧 Final columnOptions:', {
      'options length': options.length,
      options,
    });
  }
  return options;
}

/**
 * Helper function to setup table configuration and state
 */
function useToolbarSetup(tableId: string) {
  const { t } = useTranslations();

  const state = useDataTable({
    tableType: tableId,
  }) as unknown as DataTableState;

  const { config: tableConfig } = useTableConfig(tableId);

  return { t, state, tableConfig };
}

// Extracted: setup advanced filters related memoized values
function useAdvancedFiltersSetup(
  tableId: string,
  data: unknown[],
  columnOptions: {
    [key: string]: unknown;
    id: string;
    label: string;
    canFilter?: boolean;
  }[],
  columnTypeMapping: Record<
    string,
    'text' | 'number' | 'date' | 'option' | 'multiOption'
  >
) {
  const advancedColumnsConfig = useColumnsFilterConfig(
    columnOptions,
    columnTypeMapping
  );

  const accessors = useTableAccessors(
    data,
    columnOptions.map((col: unknown) =>
      String((col as Record<string, unknown>).id || '')
    )
  );

  const advancedFiltersResult = useDataTableAdvancedFilters({
    tableType: tableId,
    strategy: 'client',
    data,
    advancedColumnsConfig,
    accessors,
    autoComputeFaceted: true,
  });

  return { advancedColumnsConfig, accessors, advancedFiltersResult };
}

// Extracted: memoize final columns
function useFinalColumns(state: DataTableState, columnOptions: unknown[]) {
  return useMemo(() => state?.columns ?? columnOptions, [columnOptions, state]);
}

// Extracted: memoize final column visibility
function useFinalColumnVisibility(
  state: DataTableState,
  table?: Table<Record<string, unknown>>
) {
  return useMemo(() => {
    if (!table) {
      return {} as VisibilityState;
    }
    return (state?.columnVisibility ??
      table.getState().columnVisibility) as VisibilityState;
  }, [state?.columnVisibility, table]);
}

// Extracted: stable setter for column visibility
function useFinalSetColumnVisibility(
  propSetter: ((value: VisibilityState) => void) | undefined,
  dataTableSetter: ((value: VisibilityState) => void) | undefined
) {
  return useCallback(
    (value: VisibilityState) => {
      try {
        if (propSetter) {
          propSetter(value);
          return;
        }
        if (dataTableSetter) {
          dataTableSetter(value);
        }
      } catch (_error) {
        // ignore
      }
    },
    [propSetter, dataTableSetter]
  );
}

/**
 * Advanced toolbar component for DataTable
 * Combines search, filters, view management, and column visibility controls
 */
export function DataTableAdvancedToolbar<TData>({
  className: _className,
  hideGlobalFilter: _hideGlobalFilter,
  hideMenu: _hideMenu,
  hideViewOptions: _hideViewOptions,
  menuButtonProps: _menuButtonProps,
  table,
  viewOptions: _viewOptions,
  enableAdvancedFilters = false,
  data = [],
  columnTypeMapping = {},
  ...props
}: DataTableAdvancedToolbarProps<TData>) {
  // Ensure tableId is available
  const tableId = props.tableId || 'default';

  // Setup configuration and state
  const { t, state, tableConfig } = useToolbarSetup(tableId);

  // Advanced filters setup - create column options and configs
  const columnOptions = useMemo(
    () =>
      createColumnOptions(
        tableConfig as unknown as Record<string, unknown>,
        columnTypeMapping
      ),
    [tableConfig, columnTypeMapping]
  );

  const { advancedColumnsConfig, advancedFiltersResult } =
    useAdvancedFiltersSetup(tableId, data, columnOptions, columnTypeMapping);

  // Get final columns and visibility
  const finalColumns = useFinalColumns(state, columnOptions);
  const finalColumnVisibility = useFinalColumnVisibility(state, table);

  // QueryClient for invalidating queries
  const queryClient = useQueryClient();

  // Use data table hook to get all table state
  const {
    setColumnFilters,
    setColumnVisibility: dataTableSetColumnVisibility,
    setGrouping,
    setSorting,
    state: dataTableState,
  } = useDataTable({
    tableType: tableId,
  });

  // Create a table instance to use with the TableMenu
  const _tableInstance = useTableInstance({
    columns: [], // Empty columns since we only need the table structure for the menu
    data: [],
    tableId,
  });

  // Use props if provided (for backwards compatibility) or values from useDataTable
  const finalColumnFilters = props.columnFilters || state?.columnFilters || [];
  const finalGrouping = props.grouping || state?.grouping || [];
  const finalSetColumnFilters = props.setColumnFilters || setColumnFilters;

  // Specific handler for column visibility with debugging
  const finalSetColumnVisibility = useFinalSetColumnVisibility(
    props.setColumnVisibility,
    dataTableSetColumnVisibility
  );

  const finalSetGrouping = props.setGrouping || setGrouping;
  const finalSetSorting = props.setSorting || setSorting;
  const finalSorting =
    props.sorting || dataTableState?.sorting || state?.sorting || [];

  // Get the setter for the form state atom
  const setFormState = useSetAtom(catalogueFormAtom);

  // Get table configuration from hook
  const _tableConfig = tableConfig;

  // Count active filters
  const _activeFiltersCount = finalColumnFilters.length;

  // Helper function to convert column to TableMenu format
  const convertColumnForTableMenu = (col: unknown) => {
    // Handle both types: Record<string, unknown> and specific column type
    const isSpecificColumnType =
      col && typeof col === 'object' && 'canFilter' in col;

    return {
      canFilter: isSpecificColumnType
        ? ((col as { canFilter?: boolean }).canFilter ?? false)
        : false,
      canGroup: isSpecificColumnType
        ? ((col as { canGroup?: boolean }).canGroup ?? false)
        : false,
      canHide: isSpecificColumnType
        ? (col as { canHide?: boolean }).canHide !== false
        : true,
      canSort: isSpecificColumnType
        ? ((col as { canSort?: boolean }).canSort ?? true)
        : true,
      id: (col as { id?: string }).id || '',
      label:
        (col as { label?: string }).label ||
        (col as { id?: string }).id ||
        'Column',
    };
  };

  // Convert finalColumns to the format expected by TableMenu
  const tableMenuColumns = Array.isArray(finalColumns)
    ? finalColumns.map(convertColumnForTableMenu)
    : [];

  if (DEBUG) {
    // Debug log for table menu columns
  }

  return (
    <div className="flex items-center gap-2">
      {/* Create button */}
      <Button
        onClick={() => {
          // Set the form state to open the create form
          // Use tableId directly as the form type since they're now identical
          setFormState(
            openCreateForm(tableId, tableId, (_data) => {
              // Invalidate the table data query to refresh the table after successful submission
              queryClient.invalidateQueries({
                queryKey: ['tableData', tableId],
              });
            })
          );
        }}
        size="sm"
        variant="default"
      >
        <PlusIcon className="mr-2 h-4 w-4" />
        <span>{t('add_an_item')}</span>
      </Button>

      {/* Search bar */}
      <div className="relative">
        <Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-muted-foreground" />
        <Input className="h-8 w-64 pl-9" placeholder="Search..." />
      </div>

      {/* Options menu */}
      <TableMenu
        advancedFiltersConfig={
          enableAdvancedFilters
            ? {
                filters: advancedFiltersResult.advancedFilters,
                actions: advancedFiltersResult.advancedActions,
                columnsConfig: advancedColumnsConfig,
                onConvertToAdvanced:
                  advancedFiltersResult.convertLegacyToAdvanced as (
                    columnId: string,
                    type: ColumnDataType
                  ) => void,
              }
            : undefined
        }
        columns={tableMenuColumns}
        invalidateTable={async () => {
          await queryClient.invalidateQueries({
            queryKey: ['tableData', tableId],
          });
        }}
        setColumnFilters={finalSetColumnFilters}
        setColumnVisibility={finalSetColumnVisibility}
        setGrouping={finalSetGrouping}
        setSorting={finalSetSorting}
        state={{
          columnFilters: finalColumnFilters as ColumnFiltersState,
          columnOrder: [],
          columnPinning: { left: [], right: [] },
          columnSizing: {} as ColumnSizingState,
          columnSizingInfo: {
            columnSizingStart: [],
            deltaOffset: 0,
            deltaPercentage: 0,
            isResizingColumn: false,
            startOffset: 0,
            startSize: 0,
          },
          columnVisibility: finalColumnVisibility as VisibilityState,
          expanded: {},
          globalFilter: '',
          grouping: finalGrouping as GroupingState,
          pagination: { pageIndex: 0, pageSize: 10 },
          rowPinning: { bottom: [], top: [] },
          rowSelection: {},
          sorting: finalSorting as SortingState,
        }}
        tableId={tableId}
        useAdvancedFilters={enableAdvancedFilters}
      />
    </div>
  );
}
