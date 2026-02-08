/**
 * Modern implementation of the DataTable component
 * A cleaner approach using modular components and hooks
 */
"use client";

import type { Cell, ColumnDef, Row } from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";
import { useAtom } from "jotai";
// CheckSquare import removed - using ColumnIcon helper
import type React from "react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Loader } from "../ui-custom/loader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { tableIdAtom } from "../atoms/table-atoms";
import { defaultBulkActions, useBulkActions } from "../hooks/use-bulk-actions";
import { useDataTable } from "../hooks/use-data-table";
import { useTableConfig } from "../hooks/use-table-config";
import { useTableInstance } from "../hooks/use-table-instance";
import { useTableUrlState } from "../hooks/use-table-url-state";
import type { DataTableProps } from "../types";
import { ColumnIcon } from "../utils/column-icons";
import { BulkActionsMenu } from "./bulk-actions/bulk-actions-menu";
import { ColumnDragOverlay } from "./columns";
import { DataTableColumnHeader } from "./columns/header/column-header";
import { useColumnDnd } from "./columns/hooks/use-column-dnd";
import { useColumnDragOverlay } from "./columns/hooks/use-column-drag-overlay";
import { SortableHeader } from "./index";
import { SafePagination } from "./safe-pagination";

// Debug flag for logging
const _DEBUG = false;

/** Stable empty object for "collapse all" to avoid setState loops when effect re-runs */
const EMPTY_EXPANDED: Record<string, boolean> = {};

type ModernDataTableProps<
  TData extends Record<string, unknown>,
  TValue = unknown,
> = Omit<
  DataTableProps<TData, TValue>,
  "children" | "initialActiveViewId" | "initialViews"
> & {
  className?: string;
  enableColumnDragDropByDefault?: boolean;
  enableColumnFilters?: boolean;
  enableMultiRowSelection?: boolean;
  enablePagination?: boolean;
  enableRowDragDrop?: boolean;
  enableRowSelection?: boolean;
  enableSorting?: boolean;
  enableGrouping?: boolean;
  getRowId?: (row: TData) => string;
  manualFiltering?: boolean;
  manualPagination?: boolean;
  manualSorting?: boolean;
  /** Optional custom overlay to render when loading */
  loadingOverlay?: React.ReactNode;
  onRowSelectionChange?: (rows: Row<TData>[]) => void;
  onBulkEdit?: (rows: Row<TData>[]) => void;
  onBulkDelete?: (rows: Row<TData>[]) => void;
  onBulkCopy?: (rows: Row<TData>[]) => void;
  queryFn?: (
    params: Record<string, unknown>
  ) => Promise<{ data: TData[]; pageCount: number; rowCount: number }>;
  rowSelection?: Record<string, boolean>;
  tableType?: string;
};

// Separate cell rendering into its own memoized component
const MemoizedTableCell = memo<{
  cell: Cell<Record<string, unknown>, unknown>;
}>(({ cell }) => (
  <TableCell>
    {flexRender(cell.column.columnDef.cell, cell.getContext())}
  </TableCell>
));

MemoizedTableCell.displayName = "MemoizedTableCell";

// Optimize table row with better memoization
const MemoizedTableRow = memo<{
  isSelected: boolean;
  row: Row<Record<string, unknown>>;
}>(
  ({ isSelected, row }) => {
    // Memoize visible cells to prevent unnecessary recalculation
    const visibleCells = useMemo(() => row.getVisibleCells(), [row]);

    return (
      <TableRow
        className={cn(
          isSelected && "bg-muted/50",
          // Add CSS containment to reduce layout recalculation scope
          "contain-paint"
        )}
        key={row.id}
      >
        {visibleCells.map((cell) => (
          <MemoizedTableCell cell={cell} key={cell.id} />
        ))}
      </TableRow>
    );
  },
  (prevProps, nextProps) => {
    // Custom equality check for better memoization
    if (prevProps.isSelected !== nextProps.isSelected) {
      return false;
    }
    if (prevProps.row.id !== nextProps.row.id) {
      return false;
    }

    // Check if any cell values have changed
    const prevCells = prevProps.row.getVisibleCells();
    const nextCells = nextProps.row.getVisibleCells();

    if (prevCells.length !== nextCells.length) {
      return false;
    }

    for (let i = 0; i < prevCells.length; i++) {
      if (prevCells[i].getValue() !== nextCells[i].getValue()) {
        return false;
      }
    }

    return true;
  }
);

MemoizedTableRow.displayName = "MemoizedTableRow";

// Optimize skeleton row with better memoization
const MemoizedSkeletonRow = memo<{
  columns: ColumnDef<Record<string, unknown>, unknown>[];
  rowIndex: number;
}>(({ columns: _columns, rowIndex }) => (
  <TableRow key={`skeleton-row-${rowIndex}`}>
    <TableCell key={`skeleton-cell-${rowIndex}-1`}>
      <Skeleton className="h-8 w-full" />
    </TableCell>
    <TableCell key={`skeleton-cell-${rowIndex}-2`}>
      <Skeleton className="h-8 w-full" />
    </TableCell>
    <TableCell key={`skeleton-cell-${rowIndex}-3`}>
      <Skeleton className="h-8 w-full" />
    </TableCell>
    <TableCell key={`skeleton-cell-${rowIndex}-4`}>
      <Skeleton className="h-8 w-full" />
    </TableCell>
  </TableRow>
));

MemoizedSkeletonRow.displayName = "MemoizedSkeletonRow";

/**
 * Modern implementation of DataTable using the new hooks and components
 */
function ModernDataTable<
  TData extends Record<string, unknown>,
  TValue = unknown,
>({
  className,
  columns = [],
  data: _initialData = [],
  enableColumnDragDropByDefault = true,
  enableColumnFilters = true,
  enableMultiRowSelection = true,
  enablePagination = true,
  enableRowDragDrop: _enableRowDragDrop = false,
  enableRowSelection = true,
  enableSorting = true,
  enableGrouping = true,
  getRowId,
  manualFiltering = false,
  manualPagination = false,
  manualSorting = false,
  loadingOverlay: loadingOverlayProp,
  onRowSelectionChange,
  onBulkEdit,
  onBulkDelete,
  onBulkCopy,
  queryFn: _queryFn,
  rowSelection: _rowSelection,
  tableId,
  tableType,
}: ModernDataTableProps<TData, TValue>) {
  // Set global table ID - only once when component mounts or tableId changes
  const [, setGlobalTableId] = useAtom(tableIdAtom);
  useEffect(() => {
    setGlobalTableId(tableId);
    return () => setGlobalTableId("");
  }, [tableId, setGlobalTableId]);

  // State for optimization - use refs instead of state where possible
  const isTableUpdatingRef = useRef(false);
  const _isVisibleRef = useRef(true);
  const tableRef = useRef<HTMLDivElement>(null);
  const _previousRowsRef = useRef<Row<TData>[]>([]);
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Use stable references for callbacks
  const stableOnRowSelectionChange = useRef(onRowSelectionChange);
  useEffect(() => {
    stableOnRowSelectionChange.current = onRowSelectionChange;
  }, [onRowSelectionChange]);

  // Use proper data table hook like in production
  const dataTableResult = useDataTable({
    enabled: true,
    tableId,
    tableType: tableType || tableId,
  });

  const {
    data: fetchedData,
    error,
    isError,
    isLoading,
    refetch,
    state,
  } = dataTableResult;

  // Get table config to access column types
  const { config: tableConfig } = useTableConfig(tableType || tableId);
  // Debug removed to stop spam

  // Use fetched data from API like in production
  const data = fetchedData || [];

  // Create a table instance with the actual data to be used (filtered or not)
  // Memoize table instance configuration to prevent recreating table on every render
  const tableInstanceConfig = useMemo(
    () => ({
      columns: columns as ColumnDef<TData>[],
      data: data as TData[],
      defaultVisibleColumns: tableConfig.columns.visible,
      enableColumnFilters,
      enableMultiRowSelection,
      enablePagination,
      enableRowSelection,
      enableGrouping,
      enableSorting,
      getRowId,
      manualFiltering,
      manualPagination,
      manualSorting,
      tableId: tableId || "",
    }),
    [
      columns,
      data,
      tableConfig.columns.visible,
      enableColumnFilters,
      enableMultiRowSelection,
      enablePagination,
      enableRowSelection,
      enableGrouping,
      enableSorting,
      getRowId,
      manualFiltering,
      manualPagination,
      manualSorting,
      tableId,
    ]
  );

  const table = useTableInstance(tableInstanceConfig);
  const tableInstanceRef = useRef(table);
  tableInstanceRef.current = table;

  // Refetch data when grouping changes so server/client data adapts
  const prevGroupingRef = useRef<string>(JSON.stringify(state.grouping || []));
  useEffect(() => {
    const current = JSON.stringify(state.grouping || []);
    if (current === prevGroupingRef.current) {
      return;
    }
    prevGroupingRef.current = current;
    if (typeof refetch === "function") {
      refetch();
    }
  }, [state.grouping, refetch]);

  // Handle row selection changes
  useEffect(() => {
    if (onRowSelectionChange && table) {
      const currentSelection = table.getState().rowSelection;
      const selectedRows = table
        .getRowModel()
        .rows.filter((row) => currentSelection[row.id]) as Row<TData>[];

      onRowSelectionChange(selectedRows);
    }
  }, [table, onRowSelectionChange]);

  // Auto-expand all groups when a grouping is active so leaf rows are visible by default
  useEffect(() => {
    if (!table) {
      return;
    }
    const hasGrouping =
      Array.isArray(state.grouping) && state.grouping.length > 0;
    if (hasGrouping) {
      // Force expand all groups after a small delay to ensure table is ready
      setTimeout(() => {
        table.toggleAllRowsExpanded(true);
      }, 100);
    } else {
      table.toggleAllRowsExpanded(false);
    }
  }, [table, state.grouping]);

  // Extract important state from the table - memoize derived values
  const { columnOrder, pagination: _pagination } = state;

  // Get leaf column IDs for column ordering - memoized with column count for stability
  const leafColumnIds = useMemo(() => {
    const leafColumns = table.getAllLeafColumns();
    return leafColumns.map((column) => column.id);
  }, [table]);

  // Function to set column order - stable reference
  const setColumnOrder = useCallback(
    (newOrder: string[]) => {
      if (!isTableUpdatingRef.current) {
        table.setColumnOrder(newOrder);
      }
    },
    [table]
  );

  // Update column order effect - simplified
  useEffect(() => {
    if (
      leafColumnIds.length > 0 &&
      (!columnOrder || columnOrder.length === 0)
    ) {
      setColumnOrder(leafColumnIds);
    }
  }, [leafColumnIds, columnOrder, setColumnOrder]);

  // Update loading state - use ref instead of state
  useEffect(() => {
    isTableUpdatingRef.current = isLoading;
  }, [isLoading]);

  // Set up column drag and drop - stable reference
  const handleColumnOrderChange = useCallback(
    (newOrder: string[]) => {
      setColumnOrder(newOrder);
    },
    [setColumnOrder]
  );

  const {
    activeDragId: _activeColumnDragId,
    closestCenter: columnClosestCenter,
    DndContext: ColumnDndContext,
    handleDragEnd: handleColumnDragEnd,
    handleDragStart: handleColumnDragStart,
    horizontalListSortingStrategy,
    isDragEnabled: _isDragEnabled,
    modifiers,
    sensors: columnSensors,
    SortableContext: ColumnSortableContext,
  } = useColumnDnd(
    tableId,
    handleColumnOrderChange,
    enableColumnDragDropByDefault
  );

  // Use hook to manage overlay during drag and drop
  const {
    activeColumn,
    handleDragEnd: handleDragEndWithOverlay,
    handleDragStart: handleDragStartWithOverlay,
  } = useColumnDragOverlay({
    onDragEnd: handleColumnDragEnd,
    onDragStart: handleColumnDragStart,
    table,
  });

  // Setup bulk actions functionality
  const bulkActions = useBulkActions({
    table,
    onBulkEdit: onBulkEdit || defaultBulkActions.onBulkEdit,
    onBulkDelete: onBulkDelete || defaultBulkActions.onBulkDelete,
    onBulkCopy: onBulkCopy || defaultBulkActions.onBulkCopy,
  });

  // Debug bulk actions state
  // Default loading overlay component
  const defaultLoadingOverlay = (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80">
      <div className="flex flex-col items-center">
        <Loader size="xl" />
        <div className="mt-4 text-muted-foreground text-sm">Loading...</div>
      </div>
    </div>
  );
  const loadingOverlay = loadingOverlayProp ?? defaultLoadingOverlay;

  // Local state to track expanded groups (bypass TanStack issues)
  const [localExpanded, setLocalExpanded] = useState<Record<string, boolean>>(
    {}
  );

  // Bridge URL-driven expand/collapse controls with local expansion state
  const { expandedParam, setExpandedFromUI } = useTableUrlState({
    tableId: tableId || "",
  });

  // When grouping changes, expand all by default. Only update URL when desired value differs to avoid loops.
  const groupingKey = Array.isArray(state.grouping)
    ? state.grouping.join(",")
    : "";
  useEffect(() => {
    const hasGrouping = groupingKey.length > 0;
    const wantAll = hasGrouping;
    const current = expandedParam as Record<string, unknown> | undefined;
    const hasAll = Boolean(current?._all);
    if (wantAll && !hasAll) {
      setExpandedFromUI({ _all: true } as unknown as Record<string, boolean>);
      return;
    }
    if (!wantAll && current != null && Object.keys(current).length > 0) {
      setExpandedFromUI(EMPTY_EXPANDED as unknown as Record<string, boolean>);
    }
  }, [groupingKey, expandedParam, setExpandedFromUI]);

  // Sync URL "expand all / collapse all" with local expanded mapping.
  // Only depend on expandedParam to avoid loops from unstable `table` reference.
  useEffect(() => {
    const currentTable = tableInstanceRef.current;
    if (!currentTable) {
      return;
    }
    const rows = currentTable.getRowModel().rows as Row<TData>[];

    // Expand all
    if (expandedParam && (expandedParam as Record<string, unknown>)._all) {
      const next: Record<string, boolean> = {};
      const collect = (r: Row<TData>[]) => {
        for (const row of r) {
          const hasChildren = (row.subRows?.length || 0) > 0;
          if (hasChildren) {
            next[row.id] = true;
            collect(row.subRows as Row<TData>[]);
          }
        }
      };
      collect(rows);
      setLocalExpanded(next);
      return;
    }

    // Collapse all (or unsupported structure). Use stable ref to avoid re-render loops.
    setLocalExpanded(EMPTY_EXPANDED);
  }, [expandedParam]);

  // Auto-expand all groups when grouping is active - DISABLED to prevent infinite loops
  // TODO: Implement stable group expansion logic
  // useEffect(() => {
  //   const hasGrouping = Array.isArray(state.grouping) && state.grouping.length > 0;
  //   if (!hasGrouping) {
  //     setLocalExpanded({});
  //     return;
  //   }
  //   // Expansion logic disabled to prevent loops
  // }, [state.grouping]);

  // Optimize table body content with better memoization
  const tableBodyContent = useMemo(() => {
    // Avoid hydration mismatch: only show skeletons after mount
    const showSkeleton =
      hasMounted &&
      (isTableUpdatingRef.current ||
        (isLoading && (!data || data.length === 0)));
    if (showSkeleton) {
      const skeletonRows = [
        <MemoizedSkeletonRow
          columns={table.getAllColumns()}
          key="skeleton-row-1"
          rowIndex={1}
        />,
        <MemoizedSkeletonRow
          columns={table.getAllColumns()}
          key="skeleton-row-2"
          rowIndex={2}
        />,
        <MemoizedSkeletonRow
          columns={table.getAllColumns()}
          key="skeleton-row-3"
          rowIndex={3}
        />,
        <MemoizedSkeletonRow
          columns={table.getAllColumns()}
          key="skeleton-row-4"
          rowIndex={4}
        />,
        <MemoizedSkeletonRow
          columns={table.getAllColumns()}
          key="skeleton-row-5"
          rowIndex={5}
        />,
      ];
      return <TableBody>{skeletonRows}</TableBody>;
    }

    const rows = table.getRowModel().rows as Row<TData>[];

    // Helper to get selection counts
    const getSelectionCounts = (row: Row<TData>) => {
      const selectedCount =
        row.subRows?.filter((subRow) => {
          const selection = table.getState().rowSelection;
          return selection[subRow.id];
        }).length ?? 0;
      const totalCount = row.subRows?.length ?? 0;
      return { selectedCount, totalCount };
    };

    // Helper to get column icon from table config (single source of truth)
    const getColumnIcon = (columnId: string) => {
      const configColumn = tableConfig.columns.definitions.find(
        (def) => def.id === columnId
      );
      const columnType = configColumn?.type || "text";

      // Debug removed

      return <ColumnIcon columnType={columnType} />;
    };

    // Helper to get group display info
    const getGroupDisplayInfo = (row: Row<TData>, level: number) => {
      const groupingColumn = (state.grouping as string[])?.[level] || "";

      if (groupingColumn === "select") {
        const { selectedCount, totalCount } = getSelectionCounts(row);
        let groupValue = "Not Selected";

        if (selectedCount === totalCount && totalCount > 0) {
          groupValue = "All Selected";
        } else if (selectedCount > 0) {
          groupValue = "Partially Selected";
        }

        return {
          groupValue,
          columnLabel: "Selection",
          groupingColumn,
          icon: <ColumnIcon columnType="select" />,
        };
      }

      const groupValue = String(
        (row.original as Record<string, unknown>)[groupingColumn] || ""
      );
      return {
        groupValue,
        columnLabel: groupingColumn,
        groupingColumn,
        icon: getColumnIcon(groupingColumn),
      };
    };

    const renderGroupedRow = (
      row: Row<TData>,
      visibleCells: ReturnType<Row<TData>["getVisibleCells"]>,
      level = 0
    ) => {
      // Calculate indentation based on nesting level
      const indentPx = level * 24;

      // Get group display info
      const { groupValue, columnLabel, icon } = getGroupDisplayInfo(row, level);

      return (
        <TableRow
          className={cn(
            "data-[state=selected]:bg-muted/50",
            row.getIsSelected() && "bg-muted/50",
            "border-border border-t bg-muted/20 first:border-t-0"
          )}
          data-state={row.getIsSelected() ? "selected" : ""}
          key={row.id}
        >
          <TableCell colSpan={visibleCells.length}>
            <Button
              className="flex h-auto w-full cursor-pointer items-center justify-start gap-2 p-2"
              onClick={() => {
                const isCurrentlyExpanded = localExpanded[row.id] ?? false;
                setLocalExpanded((prev) => ({
                  ...prev,
                  [row.id]: !isCurrentlyExpanded,
                }));
              }}
              style={{ paddingLeft: indentPx + 8 }}
              variant="ghost"
            >
              <span aria-hidden className="text-muted-foreground">
                {localExpanded[row.id] ? "▾" : "▸"}
              </span>
              {icon}
              <span className="text-muted-foreground text-sm">
                {columnLabel}:
              </span>
              <span className="font-medium">{groupValue}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
                {row.subRows?.length || 0}
              </span>
            </Button>
          </TableCell>
        </TableRow>
      );
    };

    const renderRegularRow = (
      row: Row<TData>,
      visibleCells: ReturnType<Row<TData>["getVisibleCells"]>
    ) => (
      <TableRow
        className={cn(
          "data-[state=selected]:bg-muted/50",
          row.getIsSelected() && "bg-muted/50"
        )}
        data-state={row.getIsSelected() ? "selected" : ""}
        key={row.id}
      >
        {visibleCells.map((cell) => (
          <TableCell key={cell.id}>
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </TableCell>
        ))}
      </TableRow>
    );

    const rowElements: React.ReactNode[] = [];

    const pushSelectionGroupButtonRow = (
      groupId: string,
      colSpan: number,
      level: number,
      icon: React.ReactNode,
      label: string,
      count: number,
      badgeClassName: string
    ) => (
      <TableRow className="border-t bg-muted/20" key={groupId}>
        <TableCell colSpan={colSpan}>
          <Button
            className="flex h-auto w-full cursor-pointer items-center justify-start gap-2 p-2"
            onClick={() => {
              const isExpanded = localExpanded[groupId] ?? false;
              setLocalExpanded((prev) => ({
                ...prev,
                [groupId]: !isExpanded,
              }));
            }}
            style={{ paddingLeft: level * 24 + 8 }}
            variant="ghost"
          >
            <span aria-hidden className="text-muted-foreground">
              {localExpanded[groupId] ? "▾" : "▸"}
            </span>
            {icon}
            <span className="text-muted-foreground text-sm">Selection:</span>
            <span className="font-medium">{label}</span>
            <span className={badgeClassName}>{count}</span>
          </Button>
        </TableCell>
      </TableRow>
    );

    const pushExpandedSubRows = (subRows: Row<TData>[]) => {
      for (const subRow of subRows) {
        rowElements.push(renderRegularRow(subRow, subRow.getVisibleCells()));
      }
    };

    const pushSelectionGroupRows = (row: Row<TData>, level: number) => {
      const visibleCells = row.getVisibleCells();
      const selection = table.getState().rowSelection;
      const selectedRows: Row<TData>[] = [];
      const unselectedRows: Row<TData>[] = [];
      for (const subRow of row.subRows || []) {
        if (selection[subRow.id]) {
          selectedRows.push(subRow);
        } else {
          unselectedRows.push(subRow);
        }
      }

      if (selectedRows.length > 0) {
        const selectedGroupId = `${row.id}-selected`;
        rowElements.push(
          pushSelectionGroupButtonRow(
            selectedGroupId,
            visibleCells.length,
            level,
            <ColumnIcon className="text-green-600" columnType="select" />,
            "☑️ Selected",
            selectedRows.length,
            "rounded-full bg-green-100 px-2 py-0.5 text-green-700 text-xs"
          )
        );
        if (localExpanded[selectedGroupId]) {
          pushExpandedSubRows(selectedRows);
        }
      }

      if (unselectedRows.length > 0) {
        const unselectedGroupId = `${row.id}-unselected`;
        rowElements.push(
          pushSelectionGroupButtonRow(
            unselectedGroupId,
            visibleCells.length,
            level,
            null,
            "☐ Unselected",
            unselectedRows.length,
            "rounded-full bg-gray-100 px-2 py-0.5 text-gray-700 text-xs"
          )
        );
        if (localExpanded[unselectedGroupId]) {
          pushExpandedSubRows(unselectedRows);
        }
      }
    };

    const renderRowWithChildren = (row: Row<TData>, level = 0) => {
      const visibleCells = row.getVisibleCells();
      const isGroupHeaderRow = visibleCells.some((cell) => cell.getIsGrouped());

      if (isGroupHeaderRow) {
        const groupingColumn = (state.grouping as string[])?.[level] || "";

        if (groupingColumn === "select") {
          pushSelectionGroupRows(row, level);
        } else {
          // Normal grouping (non-selection)
          rowElements.push(renderGroupedRow(row, visibleCells, level));

          if (localExpanded[row.id]) {
            for (const subRow of row.subRows || []) {
              renderRowWithChildren(subRow, level + 1);
            }
          }
        }
      } else {
        rowElements.push(renderRegularRow(row, visibleCells));
      }
    };

    for (const row of rows) {
      renderRowWithChildren(row);
    }

    return <TableBody>{rowElements}</TableBody>;
  }, [
    isLoading,
    data,
    table,
    hasMounted,
    localExpanded,
    state.grouping,
    tableConfig.columns.definitions,
  ]);

  // Optimize table header with better memoization
  const tableHeader = useMemo(() => {
    return (
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            <ColumnSortableContext
              items={leafColumnIds}
              strategy={horizontalListSortingStrategy}
            >
              {headerGroup.headers.map((header) => {
                const _isFixedPosition =
                  header.id === "select" || header.id === "actions";
                return (
                  <SortableHeader
                    className={cn(
                      "relative whitespace-nowrap px-0",
                      header.id === "select" && "select-column",
                      header.id === "actions" && "sticky right-0 z-10 shadow-md"
                    )}
                    column={header.column as never}
                    id={header.id}
                    key={header.id}
                  >
                    {!header.isPlaceholder &&
                      (header.id === "select" ? (
                        // For selection columns, use the column's header directly
                        flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )
                      ) : (
                        // For other columns, use our custom header component
                        <DataTableColumnHeader
                          column={header.column}
                          table={table}
                          tableId={tableId}
                          title={header.column.columnDef.header as string}
                        />
                      ))}
                  </SortableHeader>
                );
              })}
            </ColumnSortableContext>
          </TableRow>
        ))}
      </TableHeader>
    );
  }, [table, leafColumnIds, tableId, horizontalListSortingStrategy]);

  // Only show empty state if we have no data AND we shouldn't show table UI
  // This ensures we always show the table UI when using server-side operations
  const shouldShowTableUI =
    manualFiltering || manualPagination || manualSorting;
  const showEmptyState = (!data || data.length === 0) && !shouldShowTableUI;

  // Create empty state content
  const emptyStateContent = useMemo(
    () => (
      <div className="flex h-64 flex-col items-center justify-center text-muted-foreground">
        <p className="font-semibold text-lg">No results found</p>
        <p className="text-sm">Try adjusting your search or filters</p>
      </div>
    ),
    []
  );

  // Render the content based on state
  const renderContent = () => {
    // Render error state
    if (isError) {
      return (
        <div className="flex h-64 items-center justify-center">
          <div className="space-y-2 text-center" role="alert">
            <p className="font-semibold text-lg">Error loading data</p>
            <p className="text-muted-foreground text-sm">
              {error?.message || "There was an error loading the data."}
            </p>
            {typeof refetch === "function" && (
              <Button onClick={refetch} variant="outline">
                Retry
              </Button>
            )}
          </div>
        </div>
      );
    }

    // Show empty state if applicable
    if (showEmptyState) {
      return emptyStateContent;
    }

    // Otherwise render the full table
    return (
      <ColumnDndContext
        collisionDetection={columnClosestCenter}
        modifiers={modifiers}
        onDragEnd={handleDragEndWithOverlay}
        onDragStart={handleDragStartWithOverlay}
        sensors={columnSensors}
      >
        <div className="space-y-4">
          <div className="relative rounded-md border">
            {/* Show loading overlay during data fetches when we already have data */}
            {isLoading && data && data.length > 0 && loadingOverlay}

            {/* Container for the table */}
            <div
              className={cn("relative w-full overflow-auto", "contain-paint")}
              ref={tableRef}
            >
              <Table className={cn("w-full", className)}>
                {tableHeader}
                {tableBodyContent}
              </Table>
            </div>
          </div>

          {/* Pagination is outside the table container to avoid focus issues */}
          {enablePagination && <SafePagination table={table} />}
        </div>

        {/* Column drag overlay is rendered at the context level */}
        <ColumnDragOverlay
          id={activeColumn?.id}
          isDragging={!!activeColumn}
          title={activeColumn?.title}
        />
      </ColumnDndContext>
    );
  };

  // Render the component
  return (
    <div className="space-y-4">
      {renderContent()}

      {/* Bulk Actions Menu - rendered as overlay when rows are selected */}
      {bulkActions.showBulkActions && (
        <BulkActionsMenu
          onBulkCopy={bulkActions.handleBulkCopy}
          onBulkDelete={bulkActions.handleBulkDelete}
          onBulkEdit={onBulkEdit ? bulkActions.handleBulkEdit : undefined}
          onClose={bulkActions.closeBulkActions}
          selectedRows={bulkActions.selectedRows}
        />
      )}
    </div>
  );
}

/**
 * Helper function to batch DOM updates and minimize layout thrashing
 */
function _useDebouncedLayoutEffect(
  callback: () => void,
  dependencies: React.DependencyList
) {
  useEffect(() => {
    // Use requestAnimationFrame to batch multiple DOM updates
    // This prevents layout thrashing by ensuring all measurements
    // are done before any DOM updates
    let rafId: number;
    const update = () => {
      // Cancel any pending update
      if (rafId) {
        cancelAnimationFrame(rafId);
      }

      // Schedule the update for the next animation frame
      rafId = requestAnimationFrame(() => {
        callback();
      });
    };

    update();

    // Cleanup on unmount or dependency change
    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [callback, ...dependencies]);
}

// Memoize the component to avoid unnecessary rerenders
const MemoizedModernDataTable = memo(ModernDataTable) as typeof ModernDataTable;

// Export the component with proper typing
export function TableComponent<
  TData extends Record<string, unknown>,
  TValue = unknown,
>(props: ModernDataTableProps<TData, TValue>) {
  return <MemoizedModernDataTable {...props} />;
}
