/**
 * Hook for creating and managing a TanStack Table instance
 * Uses URL parameters as the source of truth
 */
'use client';

import {
  type ColumnDef,
  type ColumnFiltersState,
  type ColumnOrderState,
  type ColumnPinningState,
  type ExpandedState,
  type GroupingState,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getGroupedRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type OnChangeFn,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  type Table,
  useReactTable,
  type VisibilityState,
} from '@tanstack/react-table';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useTableUrlState } from './use-table-url-state';

const DEBUG = false;
/**
 * Options for the useTableInstance hook
 */
export interface UseTableInstanceOptions<TData> {
  columns: ColumnDef<TData>[];
  data: TData[];
  enableColumnFilters?: boolean;
  enableColumnPinning?: boolean;
  enableGrouping?: boolean;
  enableMultiRowSelection?: boolean;
  enablePagination?: boolean;
  enableRowSelection?: boolean;
  enableSorting?: boolean;
  getRowId?: (row: TData) => string;
  manualFiltering?: boolean;
  manualPagination?: boolean;
  manualSorting?: boolean;
  onRowSelectionChange?: (selection: Record<string, boolean>) => void;
  pageCount?: number;
  rowSelection?: Record<string, boolean>;
  tableId: string;
}

/**
 * Hook for creating and managing a TanStack Table instance using URL parameters
 * @param options - Configuration options for the table instance
 * @returns TanStack Table instance
 */
export function useTableInstance<TData>({
  columns,
  data,
  enableColumnFilters = true,
  enableColumnPinning = true,
  enableGrouping = false,
  enableMultiRowSelection = true,
  enablePagination = true,
  enableRowSelection = true,
  enableSorting = true,
  getRowId,
  manualFiltering = false,
  manualPagination = false,
  manualSorting = false,
  onRowSelectionChange,
  pageCount = 0,
  rowSelection: externalRowSelection,
  tableId,
}: UseTableInstanceOptions<TData>) {
  // Memoize expensive computations
  const memoizedColumns = useMemo(() => columns, [columns]);
  const memoizedData = useMemo(() => data, [data]);

  // Cache the table options to prevent unnecessary re-renders
  const tableOptionsRef = useRef({
    enableColumnFilters,
    enableColumnPinning,
    enableGrouping,
    enableMultiRowSelection,
    enablePagination,
    enableRowSelection,
    enableSorting,
    manualFiltering,
    manualPagination,
    manualSorting,
  });

  // Update ref if options change
  useEffect(() => {
    tableOptionsRef.current = {
      enableColumnFilters,
      enableColumnPinning,
      enableGrouping,
      enableMultiRowSelection,
      enablePagination,
      enableRowSelection,
      enableSorting,
      manualFiltering,
      manualPagination,
      manualSorting,
    };
  }, [
    enableColumnFilters,
    enableColumnPinning,
    enableGrouping,
    enableMultiRowSelection,
    enablePagination,
    enableRowSelection,
    enableSorting,
    manualFiltering,
    manualPagination,
    manualSorting,
  ]);

  // Get table state from URL parameters
  const {
    expandedParam,
    filtersParam,
    groupingParam,
    orderParam,
    pagination,
    pinningParam,
    setColumnFiltersFromUI,
    setExpandedFromUI,
    setGroupingFromUI,
    setOrderFromUI,
    setPaginationFromUI,
    setPinningFromUI,
    setSorting,
    setVisibilityFromUI,
    sortParam,
    visibilityParam,
  } = useTableUrlState({ tableId });

  // Use React state for row selection (doesn't need to be in URL)
  const [internalRowSelection, setInternalRowSelection] =
    useState<RowSelectionState>({});

  // Create wrapper functions to adapt our URL state setters to TanStack's OnChangeFn pattern
  const handleColumnFiltersChange = useCallback<OnChangeFn<ColumnFiltersState>>(
    (updaterOrValue) => {
      const newValue =
        typeof updaterOrValue === 'function'
          ? updaterOrValue((filtersParam as ColumnFiltersState) || [])
          : updaterOrValue;

      setColumnFiltersFromUI(newValue);
    },
    [filtersParam, setColumnFiltersFromUI]
  );

  const handleColumnOrderChange = useCallback<OnChangeFn<ColumnOrderState>>(
    (updaterOrValue) => {
      const newValue =
        typeof updaterOrValue === 'function'
          ? updaterOrValue((orderParam as string[]) || [])
          : updaterOrValue;
      setOrderFromUI(newValue);
    },
    [orderParam, setOrderFromUI]
  );

  // Handler for column pinning changes
  const handleColumnPinningChange = useCallback<OnChangeFn<ColumnPinningState>>(
    (updaterOrValue) => {
      const newValue =
        typeof updaterOrValue === 'function'
          ? updaterOrValue(pinningParam || { left: [], right: [] })
          : updaterOrValue;

      // Ensure we have the correct structure for pinning state
      const normalizedPinning = {
        left: newValue.left || [],
        right: newValue.right || [],
      };

      setPinningFromUI(normalizedPinning);
    },
    [pinningParam, setPinningFromUI]
  );

  const handleColumnVisibilityChange = useCallback<OnChangeFn<VisibilityState>>(
    (updaterOrValue) => {
      const newValue =
        typeof updaterOrValue === 'function'
          ? updaterOrValue((visibilityParam as VisibilityState) || {})
          : updaterOrValue;

      setVisibilityFromUI(newValue);
    },
    [visibilityParam, setVisibilityFromUI]
  );

  const handleExpandedChange = useCallback<OnChangeFn<ExpandedState>>(
    (updaterOrValue) => {
      const newValue =
        typeof updaterOrValue === 'function'
          ? updaterOrValue(expandedParam || {})
          : updaterOrValue;
      setExpandedFromUI(newValue as Record<string, boolean>);
    },
    [expandedParam, setExpandedFromUI]
  );

  const handleGroupingChange = useCallback<OnChangeFn<GroupingState>>(
    (updaterOrValue) => {
      const newValue =
        typeof updaterOrValue === 'function'
          ? updaterOrValue((groupingParam as string[]) || [])
          : updaterOrValue;
      setGroupingFromUI(newValue);
    },
    [groupingParam, setGroupingFromUI]
  );

  const handlePaginationChange = useCallback<OnChangeFn<PaginationState>>(
    (updaterOrValue) => {
      const newValue =
        typeof updaterOrValue === 'function'
          ? updaterOrValue(pagination)
          : updaterOrValue;
      setPaginationFromUI(newValue);
    },
    [pagination, setPaginationFromUI]
  );

  const handleSortingChange = useCallback<OnChangeFn<SortingState>>(
    (updaterOrValue) => {
      const newValue =
        typeof updaterOrValue === 'function'
          ? updaterOrValue((sortParam as SortingState) || [])
          : updaterOrValue;

      const normalizedSort = Array.isArray(newValue)
        ? newValue.map((item) => ({
            desc: item.desc,
            id: item.id,
          }))
        : newValue;

      setSorting(normalizedSort);
    },
    [sortParam, setSorting]
  );

  // Create a wrapper for the row selection change handler
  const handleRowSelectionChange = useCallback<OnChangeFn<RowSelectionState>>(
    (updaterOrValue) => {
      // First update the internal state using React's state setter
      setInternalRowSelection((prev) =>
        typeof updaterOrValue === 'function'
          ? updaterOrValue(prev)
          : updaterOrValue
      );

      // Then if we have an external handler, call it with the new value
      if (onRowSelectionChange) {
        // Convert the updater to a value if needed
        const newValue =
          typeof updaterOrValue === 'function'
            ? updaterOrValue(internalRowSelection)
            : updaterOrValue;

        onRowSelectionChange(newValue as Record<string, boolean>);
      }
    },
    [onRowSelectionChange, internalRowSelection]
  );

  // Helper function to collect all valid column IDs
  const getColumnIds = useCallback((cols: ColumnDef<TData>[]) => {
    const columnIds = new Set<string>();

    for (const col of cols) {
      if (col.id) {
        columnIds.add(col.id);
      }

      if ('accessorKey' in col && col.accessorKey) {
        columnIds.add(String(col.accessorKey));
      }

      if (col.header && typeof col.header === 'string') {
        columnIds.add(col.header.toLowerCase());
      }
    }

    return columnIds;
  }, []);

  // Helper function to check if a sort ID is valid
  const isValidSortId = useCallback(
    (sortId: string, columnIds: Set<string>) => {
      const normalizedId = sortId.toLowerCase();

      return (
        columnIds.has(sortId) ||
        Array.from(columnIds).some((id) => id.toLowerCase() === normalizedId) ||
        sortId === 'key' ||
        sortId === 'id' ||
        sortId === 'name' ||
        sortId === 'createdAt' ||
        sortId === 'updatedAt'
      );
    },
    []
  );

  // Validate sorting to ensure all referenced columns exist
  const validatedSorting = useMemo(() => {
    if (!(sortParam && Array.isArray(sortParam))) {
      return [];
    }

    const columnIds = getColumnIds(columns);

    const validSorting = (sortParam as Array<{ desc: boolean; id: string }>)
      .filter((sort) => isValidSortId(sort.id, columnIds))
      .map((sort) => ({
        desc: sort.desc,
        id: sort.id,
      }));

    return validSorting.length ? validSorting : [];
  }, [columns, sortParam, getColumnIds, isValidSortId]);

  // Helper function to get a stable ID for a column
  const getColumnId = useCallback(
    (column: ColumnDef<TData>, index: number): string => {
      // Case 1: Column has an explicit ID
      if (typeof column.id === 'string') {
        return column.id;
      }
      // Case 2: Column has an accessorKey
      if ('accessorKey' in column && column.accessorKey !== undefined) {
        return String(column.accessorKey);
      }
      // Case 3: Generate a fallback ID
      return `col-${index}`;
    },
    []
  );

  // Helper function to determine if a column should be visible by default
  const getDefaultColumnVisibility = useCallback(
    (column: ColumnDef<TData>, id: string): boolean => {
      // Special cases for selection and actions columns - always visible
      if (
        id === 'select' ||
        (column.meta as Record<string, unknown>)?.isSelectionColumn ||
        id === 'actions' ||
        (column.meta as Record<string, unknown>)?.isActionsColumn
      ) {
        return true;
      }
      return column.enableHiding !== false;
    },
    []
  );

  // Initialize column visibility from columns
  const initialColumnVisibility = useMemo(() => {
    // If we have visibility in URL params, use those
    if (visibilityParam && Object.keys(visibilityParam).length > 0) {
      return visibilityParam;
    }

    // Otherwise, use the column definitions
    const visibility: VisibilityState = {};
    for (const [index, column] of columns.entries()) {
      const id = getColumnId(column, index);
      if (id) {
        visibility[id] = getDefaultColumnVisibility(column, id);
      }
    }
    return visibility;
  }, [columns, visibilityParam, getColumnId, getDefaultColumnVisibility]);

  // Initialize column order from columns when URL order is empty
  const initialColumnOrder = useMemo(() => {
    // Get all column IDs using the same logic as the visibility function
    return columns.map((column, index) => getColumnId(column, index));
  }, [columns, getColumnId]);

  // Create the table instance with memoized values
  const tableInstance = useReactTable({
    columns: memoizedColumns,
    data: memoizedData,
    ...tableOptionsRef.current,
    // Keep grouped columns and move them to the start so group headers render in their own column
    groupedColumnMode: 'reorder',
    getCoreRowModel: useMemo(() => getCoreRowModel(), []),
    getFilteredRowModel: useMemo(() => getFilteredRowModel(), []),
    getGroupedRowModel: useMemo(
      () => (enableGrouping ? getGroupedRowModel() : undefined),
      [enableGrouping]
    ),
    getPaginationRowModel: useMemo(
      () => (enablePagination ? getPaginationRowModel() : undefined),
      [enablePagination]
    ),
    getRowId,
    // Explicitly allow expanding on rows that can expand (group headers)
    getRowCanExpand: (row) => {
      try {
        // TanStack groups create subRows, use that as the signal
        return (
          Array.isArray((row as unknown as { subRows?: unknown[] }).subRows) &&
          ((row as unknown as { subRows?: unknown[] }).subRows as unknown[])
            .length > 0
        );
      } catch {
        return false;
      }
    },
    getSortedRowModel: useMemo(() => getSortedRowModel(), []),
    // Needed so grouped rows can expand/collapse
    getExpandedRowModel: useMemo(() => getExpandedRowModel(), []),
    getSubRows: (row: TData) =>
      (row as unknown as { subRows?: TData[] }).subRows,
    manualFiltering,
    manualPagination,
    manualSorting,
    onColumnFiltersChange: handleColumnFiltersChange,
    onColumnOrderChange: handleColumnOrderChange,
    onColumnPinningChange: handleColumnPinningChange,
    onColumnVisibilityChange: handleColumnVisibilityChange,
    onExpandedChange: handleExpandedChange,
    onGroupingChange: handleGroupingChange,
    onPaginationChange: handlePaginationChange,
    onRowSelectionChange: handleRowSelectionChange,
    onSortingChange: handleSortingChange,
    pageCount: pageCount || Math.ceil(data.length / pagination.pageSize),
    state: {
      columnFilters: Array.isArray(filtersParam)
        ? (filtersParam as ColumnFiltersState)
        : [],
      columnOrder: initialColumnOrder,
      columnPinning: pinningParam || {
        left: ['select'],
        right: ['actions'],
      },
      columnVisibility: initialColumnVisibility as VisibilityState,
      expanded: expandedParam || {},
      grouping: Array.isArray(groupingParam) ? (groupingParam as string[]) : [],
      pagination,
      rowSelection:
        externalRowSelection || (internalRowSelection as RowSelectionState),
      sorting: Array.isArray(validatedSorting)
        ? (validatedSorting as SortingState)
        : [],
    },
  });

  // Helper function to check if column order should be updated
  const shouldUpdateColumnOrder = useCallback(
    (tableInst: Table<TData> | null, orderParamValue: unknown): boolean => {
      return !!(
        tableInst &&
        orderParamValue &&
        Array.isArray(orderParamValue) &&
        orderParamValue.length > 0
      );
    },
    []
  );

  // Helper function to perform column order update
  const updateColumnOrder = useCallback(
    (tableInst: Table<TData>, urlOrder: string[]) => {
      const currentOrder = tableInst.getState().columnOrder;

      if (DEBUG) {
        console.log('Current order:', currentOrder, 'URL order:', urlOrder);
      }

      // Only update if the order actually changed
      if (JSON.stringify(currentOrder) !== JSON.stringify(urlOrder)) {
        if (DEBUG) {
          console.log('Updating column order to:', urlOrder);
        }
        tableInst.setColumnOrder(urlOrder);

        if (DEBUG) {
          console.log('Column order update completed');
        }
      }
    },
    []
  );

  // Sync table column order when URL state changes
  useEffect(() => {
    if (DEBUG) {
      console.log('Column order sync effect triggered');
    }

    if (shouldUpdateColumnOrder(tableInstance, orderParam) && tableInstance) {
      const urlOrder = orderParam as string[];
      updateColumnOrder(tableInstance, urlOrder);
    }
  }, [tableInstance, orderParam, shouldUpdateColumnOrder, updateColumnOrder]);

  return tableInstance;
}
