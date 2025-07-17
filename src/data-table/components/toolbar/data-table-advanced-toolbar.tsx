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
import { useTableInstance } from '../../hooks/use-table-instance';
import {
  useTableConfig,
  useTranslations,
} from '../../providers/table-provider';
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

  // Get the configuration helpers from the provider
  const getTableConfig = useTableConfig();
  const { t } = useTranslations();

  const state = useDataTable({
    tableType: tableId,
  }) as unknown as DataTableState;

  // Advanced filters setup - get enhanced column configurations
  const columnOptions = useMemo(() => {
    if (DEBUG) {
      // Debug logs for column options setup
    }

    // Get table configuration first
    const _tableConfig = getTableConfig?.(tableId);
    // TableConfig doesn't have columns.definitions property, so use empty array
    const columnDefinitions: unknown[] = [];

    if (DEBUG) {
      // Debug logs for column definitions
    }

    if (!table) {
      if (DEBUG) {
        // Debug logs for table fallback
      }
      // No table available and no column definitions, return empty array
      return [];
    }

    const allColumns = table.getAllColumns();
    if (DEBUG) {
      // Debug logs for all columns
    }

    // Merge table columns with enhanced configuration
    const options = allColumns.map((column) => {
      const columnDef = column.columnDef as DataTableColumnDef<TData>;
      const configDef = columnDefinitions.find(
        (def: unknown) => (def as Record<string, unknown>)?.id === column.id
      ) as Record<string, unknown> | undefined;

      const option = {
        canFilter: column.getCanFilter(),
        canHide: columnDef.enableHiding !== false,
        canSort: column.getCanSort(),
        id: column.id,
        label: String(
          columnDef.meta?.label || configDef?.header || column.id || 'Unknown'
        ),
        // Enhanced properties from our table config
        placeholder: configDef?.placeholder,
        description: configDef?.description,
        options: configDef?.options,
        min: configDef?.min,
        max: configDef?.max,
        type: configDef?.type,
      };

      if (DEBUG) {
        // Debug log for option creation
      }

      return option;
    });

    if (DEBUG) {
      // Debug log for final options
    }
    return options;
  }, [table, tableId, getTableConfig]);

  // Create advanced columns configuration from table columns
  const advancedColumnsConfig = useColumnsFilterConfig(
    columnOptions,
    columnTypeMapping
  );

  // Create accessors for advanced filtering
  const accessors = useTableAccessors(
    data,
    columnOptions.map((col: unknown) =>
      String((col as Record<string, unknown>).id || '')
    )
  );

  if (DEBUG) {
    // Debug log for accessors
  }

  // Set up advanced filters if enabled
  const advancedFiltersResult = useDataTableAdvancedFilters({
    tableType: tableId,
    strategy: 'client',
    data,
    advancedColumnsConfig,
    accessors,
    autoComputeFaceted: true,
  });

  if (DEBUG) {
    // Debug log for advanced filters setup
  }

  // Get final columns
  const finalColumns = useMemo(() => {
    if (DEBUG) {
      // Debug log for final columns
    }
    return state?.columns ?? columnOptions;
  }, [columnOptions, state]);

  if (DEBUG) {
    // Debug log for final columns state
  }

  // Get final column visibility
  const finalColumnVisibility = useMemo(() => {
    if (!table) {
      return {};
    }
    return state?.columnVisibility ?? table.getState().columnVisibility;
  }, [state?.columnVisibility, table]);

  if (DEBUG) {
    // Debug log for column visibility
  }

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
  const finalSetColumnVisibility = useCallback(
    (value: VisibilityState) => {
      if (DEBUG) {
        // Debug log for column visibility change
      }

      try {
        // Use the provided setter from props if available, otherwise use the one from useDataTable
        if (props.setColumnVisibility) {
          props.setColumnVisibility(value);
        } else if (dataTableSetColumnVisibility) {
          dataTableSetColumnVisibility(value);
        } else {
          // No visibility setter available
        }
      } catch (_error) {
        // Ignore visibility update errors
      }
    },
    [props.setColumnVisibility, dataTableSetColumnVisibility]
  );

  const finalSetGrouping = props.setGrouping || setGrouping;
  const finalSetSorting = props.setSorting || setSorting;
  const finalSorting =
    props.sorting || dataTableState?.sorting || state?.sorting || [];

  // Get the setter for the form state atom
  const setFormState = useSetAtom(catalogueFormAtom);

  // Get table configuration directly using tableId
  const _tableConfig = getTableConfig?.(tableId);

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
