/**
 * Hook for creating and managing a TanStack Table instance
 * Uses URL parameters as the source of truth
 */
"use client";

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
  type Row,
  type RowSelectionState,
  type SortingState,
  type Table,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import { useAtom } from "jotai";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { rowSelectionAtom, selectedRowsAtom } from "../atoms/table-atoms";
import { useTableUrlState } from "./use-table-url-state";

const _DEBUG = false;
/**
 * Options for the useTableInstance hook
 */
export interface UseTableInstanceOptions<TData> {
  columns: ColumnDef<TData>[];
  data: TData[];
  /**
   * Column IDs that should be visible by default when no URL visibility state exists.
   * Columns present in column definitions but absent from this list will be hidden.
   * When empty or undefined, all columns default to visible (original behaviour).
   */
  defaultVisibleColumns?: string[];
  defaultPageSize?: number;
  enableColumnFilters?: boolean;
  enableColumnPinning?: boolean;
  enableGrouping?: boolean;
  enableMultiRowSelection?: boolean;
  enablePagination?: boolean;
  enableRowSelection?: boolean;
  enableSorting?: boolean;
  getRowId?: (row: TData) => string;
  canSelectRow?: (row: TData) => boolean;
  onRowSelectionChange?: (selection: Record<string, boolean>) => void;
  pageCount?: number;
  rowSelection?: Record<string, boolean>;
  tableId: string;
}

export function resolveTablePageCount({
  dataLength,
  pageCount,
  pageSize,
}: {
  dataLength: number;
  pageCount?: number;
  pageSize: number;
}): number {
  if (typeof pageCount === "number" && Number.isFinite(pageCount)) {
    return Math.max(pageCount, 0);
  }

  if (!Number.isFinite(pageSize) || pageSize <= 0) {
    return 0;
  }

  return Math.ceil(dataLength / pageSize);
}

/**
 * Hook for creating and managing a TanStack Table instance using URL parameters
 * @param options - Configuration options for the table instance
 * @returns TanStack Table instance
 */
export function useTableInstance<TData>({
  columns,
  data,
  defaultPageSize,
  defaultVisibleColumns,
  enableColumnFilters = true,
  enableColumnPinning = true,
  enableGrouping = false,
  enableMultiRowSelection = true,
  enablePagination = true,
  enableRowSelection = true,
  enableSorting = true,
  getRowId,
  canSelectRow,
  onRowSelectionChange,
  pageCount,
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
    };
  }, [
    enableColumnFilters,
    enableColumnPinning,
    enableGrouping,
    enableMultiRowSelection,
    enablePagination,
    enableRowSelection,
    enableSorting,
  ]);

  // Get table state from URL parameters
  const {
    filtersParam,
    globalSearchParam,
    groupingParam,
    orderParam,
    pagination,
    pinningParam,
    setColumnFiltersFromUI,
    setGroupingFromUI,
    setOrderFromUI,
    setPaginationFromUI,
    setPinningFromUI,
    setSorting,
    setVisibilityFromUI,
    sortParam,
    visibilityParam,
  } = useTableUrlState({ defaultPageSize, tableId });

  const [internalRowSelection, setInternalRowSelection] = useAtom(
    rowSelectionAtom(tableId)
  );
  const effectiveRowSelection =
    externalRowSelection ?? (internalRowSelection as RowSelectionState);
  const [, setSelectedRows] = useAtom(selectedRowsAtom(tableId));
  const selectedRowsSelectionKeyRef = useRef("");

  // Create wrapper functions to adapt our URL state setters to TanStack's OnChangeFn pattern
  const handleColumnFiltersChange = useCallback<OnChangeFn<ColumnFiltersState>>(
    (updaterOrValue) => {
      const newValue =
        typeof updaterOrValue === "function"
          ? updaterOrValue((filtersParam as ColumnFiltersState) || [])
          : updaterOrValue;

      setColumnFiltersFromUI(newValue);
    },
    [filtersParam, setColumnFiltersFromUI]
  );

  const handleColumnOrderChange = useCallback<OnChangeFn<ColumnOrderState>>(
    (updaterOrValue) => {
      const newValue =
        typeof updaterOrValue === "function"
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
        typeof updaterOrValue === "function"
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
        typeof updaterOrValue === "function"
          ? updaterOrValue((visibilityParam as VisibilityState) || {})
          : updaterOrValue;

      setVisibilityFromUI(newValue);
    },
    [visibilityParam, setVisibilityFromUI]
  );

  // Expanded: disable handler to avoid loops
  const handleExpandedChange = useCallback<OnChangeFn<ExpandedState>>(
    (_updaterOrValue) => {
      // No-op to avoid infinite loops
    },
    []
  );

  const handleGroupingChange = useCallback<OnChangeFn<GroupingState>>(
    (updaterOrValue) => {
      const newValue =
        typeof updaterOrValue === "function"
          ? updaterOrValue((groupingParam as string[]) || [])
          : updaterOrValue;
      setGroupingFromUI(newValue);
    },
    [groupingParam, setGroupingFromUI]
  );

  const handlePaginationChange = useCallback<OnChangeFn<PaginationState>>(
    (updaterOrValue) => {
      const newValue =
        typeof updaterOrValue === "function"
          ? updaterOrValue(pagination)
          : updaterOrValue;

      if (
        newValue.pageIndex === pagination.pageIndex &&
        newValue.pageSize === pagination.pageSize
      ) {
        return;
      }

      setPaginationFromUI(newValue);
    },
    [pagination, setPaginationFromUI]
  );

  const handleSortingChange = useCallback<OnChangeFn<SortingState>>(
    (updaterOrValue) => {
      const newValue =
        typeof updaterOrValue === "function"
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
        typeof updaterOrValue === "function"
          ? updaterOrValue(prev)
          : updaterOrValue
      );

      // Then if we have an external handler, call it with the new value
      if (onRowSelectionChange) {
        // Convert the updater to a value if needed
        const newValue =
          typeof updaterOrValue === "function"
            ? updaterOrValue(internalRowSelection)
            : updaterOrValue;

        onRowSelectionChange(newValue as Record<string, boolean>);
      }
    },
    [onRowSelectionChange, internalRowSelection, setInternalRowSelection]
  );

  const enableRowSelectionOption = useMemo(() => {
    if (enableRowSelection === false) {
      return false;
    }

    if (!canSelectRow) {
      return true;
    }

    return (row: Row<TData>) => {
      if (row.getIsGrouped?.()) {
        return true;
      }

      return canSelectRow(row.original);
    };
  }, [canSelectRow, enableRowSelection]);

  // Helper function to collect all valid column IDs
  const getColumnIds = useCallback((cols: ColumnDef<TData>[]) => {
    const columnIds = new Set<string>();

    for (const col of cols) {
      if (col.id) {
        columnIds.add(col.id);
      }

      if ("accessorKey" in col && col.accessorKey) {
        columnIds.add(String(col.accessorKey));
      }

      if (col.header && typeof col.header === "string") {
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
        sortId === "key" ||
        sortId === "id" ||
        sortId === "name" ||
        sortId === "createdAt" ||
        sortId === "updatedAt"
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
      if (typeof column.id === "string") {
        return column.id;
      }
      // Case 2: Column has an accessorKey
      if ("accessorKey" in column && column.accessorKey !== undefined) {
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
      // When a defaultVisibleColumns list is provided, only show listed columns
      if (defaultVisibleColumns && defaultVisibleColumns.length > 0) {
        return defaultVisibleColumns.includes(id);
      }

      return column.enableHiding !== false;
    },
    [defaultVisibleColumns]
  );

  // Initialize column visibility from columns
  const initialColumnVisibility = useMemo(() => {
    // If we have visibility in URL params, use those
    if (visibilityParam && Object.keys(visibilityParam).length > 0) {
      return visibilityParam;
    }

    // Otherwise, use the column definitions (+ defaultVisibleColumns if provided)
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

  // Resolve the effective column order from URL params with a safe fallback
  const resolvedColumnOrder = useMemo(() => {
    const urlOrder = Array.isArray(orderParam) ? (orderParam as string[]) : [];

    // When no URL order, use initial order derived from current columns
    if (urlOrder.length === 0) {
      return initialColumnOrder;
    }

    // Filter URL order to only include current columns
    const currentIds = new Set(initialColumnOrder);
    const filtered = urlOrder.filter((id) => currentIds.has(id));

    // Append any new/missing columns at the end in their initial order
    const missing = initialColumnOrder.filter((id) => !filtered.includes(id));
    let combined = [...filtered, ...missing];

    // Enforce fixed positions for special columns if present
    const hasSelect = combined.includes("select");
    const hasActions = combined.includes("actions");
    combined = combined.filter((id) => id !== "select" && id !== "actions");
    if (hasSelect) {
      combined = ["select", ...combined];
    }
    if (hasActions) {
      combined = [...combined, "actions"];
    }

    return combined;
  }, [orderParam, initialColumnOrder]);

  // Create the table instance with memoized values
  const tableInstance = useReactTable({
    columns: memoizedColumns,
    data: memoizedData,
    ...tableOptionsRef.current,
    enableRowSelection: enableRowSelectionOption,
    // Keep grouped columns and move them to the start so group headers render in their own column
    groupedColumnMode: "reorder",
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
    manualFiltering: true,
    manualPagination: true,
    manualSorting: true,
    autoResetPageIndex: false,
    onColumnFiltersChange: handleColumnFiltersChange,
    onColumnOrderChange: handleColumnOrderChange,
    onColumnPinningChange: handleColumnPinningChange,
    onColumnVisibilityChange: handleColumnVisibilityChange,
    onExpandedChange: handleExpandedChange,
    onGroupingChange: handleGroupingChange,
    onPaginationChange: handlePaginationChange,
    onRowSelectionChange: handleRowSelectionChange,
    onSortingChange: handleSortingChange,
    pageCount: resolveTablePageCount({
      dataLength: data.length,
      pageCount,
      pageSize: pagination.pageSize,
    }),
    state: {
      columnFilters: Array.isArray(filtersParam)
        ? (filtersParam as ColumnFiltersState)
        : [],
      columnOrder: resolvedColumnOrder,
      columnPinning: pinningParam || {
        left: ["select"],
        right: ["actions"],
      },
      columnVisibility: initialColumnVisibility as VisibilityState,
      expanded: {},
      globalFilter: globalSearchParam || "",
      grouping: Array.isArray(groupingParam) ? (groupingParam as string[]) : [],
      pagination,
      rowSelection: effectiveRowSelection,
      sorting: Array.isArray(validatedSorting)
        ? (validatedSorting as SortingState)
        : [],
    },
  });

  useEffect(() => {
    const selectionKey = JSON.stringify(effectiveRowSelection);
    const selectedRows = tableInstance.getSelectedRowModel()
      .rows as Row<Record<string, unknown>>[];

    setSelectedRows((previousRows) => {
      const hasSameSelection =
        selectedRowsSelectionKeyRef.current === selectionKey;
      const hasSameRows =
        previousRows.length === selectedRows.length &&
        previousRows.every((row, index) => row === selectedRows[index]);

      selectedRowsSelectionKeyRef.current = selectionKey;

      return hasSameSelection && hasSameRows ? previousRows : selectedRows;
    });
  }, [effectiveRowSelection, setSelectedRows, tableInstance]);

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
      // Only update if the order actually changed
      if (JSON.stringify(currentOrder) !== JSON.stringify(urlOrder)) {
        tableInst.setColumnOrder(urlOrder);
      }
    },
    []
  );

  // Sync table column order when URL state changes
  useEffect(() => {
    if (shouldUpdateColumnOrder(tableInstance, orderParam) && tableInstance) {
      const urlOrder = orderParam as string[];
      updateColumnOrder(tableInstance, urlOrder);
    }
  }, [tableInstance, orderParam, shouldUpdateColumnOrder, updateColumnOrder]);

  return tableInstance;
}
