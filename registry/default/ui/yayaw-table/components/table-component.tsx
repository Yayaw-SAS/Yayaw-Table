/**
 * Modern implementation of the DataTable component
 * A cleaner approach using modular components and hooks
 */
"use client";

import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import type { Cell, ColumnDef, Header, Row } from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  type CSSProperties,
  memo,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { footerVisibleAtom } from "../atoms/footer-atoms";
import { activeRowDragAtom, tableIdAtom } from "../atoms/table-atoms";
import type {
  TableEmptyStateConfig,
  TableRowClickMode,
} from "../config/helpers";
import {
  type BulkActionCustomHandlerResult,
  type BulkDeleteCustomHandlerResult,
  useBulkActions,
} from "../hooks/use-bulk-actions";
import { useDataTable } from "../hooks/use-data-table";
import type {
  InlineEditColumnRuntimeConfig,
  InlineEditCommitResult,
} from "../hooks/use-inline-edit-runtime";
import { useTableConfig } from "../hooks/use-table-config";
import { useTableInstance } from "../hooks/use-table-instance";
import { useTableUrlState } from "../hooks/use-table-url-state";
import {
  useFormConfig,
  useTableActions as useProviderTableActions,
  useTranslations,
} from "../providers/table-provider";
import type { DataTableProps } from "../types";
import type { TableDisplayMode } from "../types/display-types";
import { Loader } from "../ui-custom/loader";
import { ColumnIcon } from "../utils/column-icons";
import { buildCsvExportColumns } from "../utils/csv-export";
import { getPrimaryGrouping } from "../utils/table-view-state";
import {
  BulkActionsMenu,
  type CustomBulkActionsInput,
  getBulkActionsMenuPositionMode,
} from "./bulk-actions/bulk-actions-menu";
import { CatalogueInlineCell } from "./cells/catalogue-inline-cell";
import { ColumnDragOverlay } from "./columns/header/column-drag-overlay";
import { DataTableColumnHeader } from "./columns/header/column-header";
import { SortableHeader } from "./columns/header/sortable-header";
import { useColumnDnd } from "./columns/hooks/use-column-dnd";
import { useColumnDragOverlay } from "./columns/hooks/use-column-drag-overlay";
import { GroupRowSelectionCell } from "./columns/selection-column";
import { FooterRow } from "./footer/footer-row";
import {
  type CatalogueFormState,
  catalogueFormAtom,
  openUpdateForm,
} from "./forms/atoms/catalogue-form-atoms";
import { CatalogueBulkEditor } from "./forms/catalogue-bulk-editor";
import type { FormConfigContext } from "./forms/types";
import {
  DataTableGalleryView,
  resolveGalleryLinkColumnId,
  resolveGalleryLinkUrl,
} from "./gallery-view";
import { DataTableKanbanView } from "./kanban-view";
import { SafePagination } from "./safe-pagination";
import { useOnScreen } from "./utils/use-on-screen";

const _DEBUG = false;

const EMPTY_COLUMNS: never[] = [];
const EMPTY_DATA: never[] = [];

const EMPTY_EXPANDED: Record<string, boolean> = {};
const ROW_CLICK_INTERACTIVE_SELECTOR =
  "button, a, [role=checkbox], input, select, textarea";
const ROW_CLICK_SYSTEM_COLUMN_SELECTOR =
  '[data-column-id="select"], [data-column-id="actions"]';
const BULK_ACTIONS_ANCHOR_VIEWPORT_OPTIONS = {
  threshold: 0,
} as const;
const PAGINATION_VIEWPORT_OPTIONS = {
  threshold: 0,
} as const;
const BULK_ACTIONS_FIXED_VIEWPORT_MARGIN = 24;

export const shouldShowCalculationsFooter = ({
  enableCalculations,
  isFooterVisible,
}: {
  enableCalculations?: boolean;
  isFooterVisible: boolean;
}): boolean => {
  return enableCalculations === true && isFooterVisible;
};

export const shouldRenderBulkActionsInFooter = ({
  enablePagination,
  isTableBottomVisible,
}: {
  enablePagination: boolean;
  isTableBottomVisible: boolean;
}): boolean => {
  return enablePagination && isTableBottomVisible;
};

export const shouldRenderPaginationControls = ({
  enablePagination,
  pageCount,
  pageSize,
  rowCount,
}: {
  enablePagination: boolean;
  pageCount?: number;
  pageSize: number;
  rowCount?: number;
}): boolean => {
  if (!(enablePagination && Number.isFinite(pageSize)) || pageSize <= 0) {
    return false;
  }

  if (
    typeof pageCount === "number" &&
    Number.isFinite(pageCount) &&
    pageCount > 1
  ) {
    return true;
  }

  if (typeof rowCount === "number" && Number.isFinite(rowCount)) {
    return rowCount > pageSize;
  }

  return false;
};

export const getBulkActionsViewportBottomOffset = ({
  isPaginationVisible,
  paginationHeight,
  viewportMargin = BULK_ACTIONS_FIXED_VIEWPORT_MARGIN,
}: {
  isPaginationVisible: boolean;
  paginationHeight: number;
  viewportMargin?: number;
}): number => {
  return viewportMargin + (isPaginationVisible ? paginationHeight : 0);
};

export const shouldRenderTableEmptyState = ({
  isError,
  isLoading,
  rowCount,
  dataLength,
  showEmptyState = true,
}: {
  isError: boolean;
  isLoading: boolean;
  rowCount?: number;
  dataLength: number;
  showEmptyState?: boolean;
}): boolean => {
  if (isError || isLoading || !showEmptyState) {
    return false;
  }

  if (typeof rowCount === "number" && Number.isFinite(rowCount)) {
    return rowCount === 0;
  }

  return dataLength === 0;
};

export const isRowIdActive = ({
  activeRowId,
  rowId,
  rowOriginal,
}: {
  activeRowId?: string;
  rowId: string;
  rowOriginal?: Record<string, unknown>;
}): boolean => {
  if (!activeRowId) {
    return false;
  }

  if (rowId === activeRowId) {
    return true;
  }

  const originalId = rowOriginal?.id;
  return (
    (typeof originalId === "number" || typeof originalId === "string") &&
    String(originalId) === activeRowId
  );
};

export const resolveEffectiveRowClickMode = ({
  configuredMode,
  hasRowLink,
  isRowClickEditEnabled,
}: {
  configuredMode?: TableRowClickMode;
  hasRowLink: boolean;
  isRowClickEditEnabled: boolean;
}): Exclude<TableRowClickMode, "default"> => {
  if (configuredMode && configuredMode !== "default") {
    return configuredMode;
  }

  if (isRowClickEditEnabled) {
    return "edit";
  }

  if (hasRowLink) {
    return "link";
  }

  return "none";
};

export const shouldIgnoreRowClickTarget = (target: EventTarget | null) => {
  if (typeof HTMLElement === "undefined" || !(target instanceof HTMLElement)) {
    return false;
  }

  return shouldIgnoreRowClickElement(target);
};

export const shouldIgnoreRowClickElement = (
  target: Pick<HTMLElement, "closest"> | null
) => {
  if (!target) {
    return false;
  }

  return Boolean(
    target.closest(ROW_CLICK_INTERACTIVE_SELECTOR) ||
      target.closest(ROW_CLICK_SYSTEM_COLUMN_SELECTOR)
  );
};

export function canEditRowWithTablePermissions({
  allowEdit,
  canEditRow,
  row,
}: {
  allowEdit?: boolean;
  canEditRow?: (row: Record<string, unknown>) => boolean;
  row: Record<string, unknown>;
}): boolean {
  return allowEdit !== false && canEditRow?.(row) !== false;
}

const handleDataTableRowClick = <TData,>({
  canEditRow,
  event,
  ignoreInteractiveTarget,
  onRowActivate,
  onRowEdit,
  onRowLink,
  row,
  rowClickMode,
}: {
  canEditRow: boolean;
  event: React.MouseEvent;
  ignoreInteractiveTarget?: boolean;
  onRowActivate?: (row: TData, event: React.MouseEvent) => void;
  onRowEdit: (row: Row<TData>) => void;
  onRowLink?: (row: Row<TData>, event: React.MouseEvent) => void;
  row: Row<TData>;
  rowClickMode: Exclude<TableRowClickMode, "default">;
}) => {
  if (
    ignoreInteractiveTarget !== false &&
    shouldIgnoreRowClickTarget(event.target)
  ) {
    return;
  }

  if (rowClickMode === "activate") {
    onRowActivate?.(row.original, event);
    return;
  }

  if (rowClickMode === "edit" && canEditRow) {
    onRowEdit(row);
    return;
  }

  if (rowClickMode === "link") {
    onRowLink?.(row, event);
  }
};

function resolveActiveDisplayMode({
  defaultDisplayMode,
  displayModeParam,
  displayModes,
}: {
  defaultDisplayMode?: TableDisplayMode;
  displayModeParam: TableDisplayMode;
  displayModes: TableDisplayMode[];
}): TableDisplayMode {
  if (displayModes.includes(displayModeParam)) {
    return displayModeParam;
  }

  return defaultDisplayMode ?? "table";
}

function shouldUseKanbanDisplayMode({
  activeDisplayMode,
  displayModes,
  groupBy,
}: {
  activeDisplayMode: TableDisplayMode;
  displayModes: TableDisplayMode[];
  groupBy: string;
}): boolean {
  return (
    activeDisplayMode === "kanban" &&
    displayModes.includes("kanban") &&
    groupBy.length > 0
  );
}

function shouldUseGalleryDisplayMode({
  activeDisplayMode,
  displayModes,
}: {
  activeDisplayMode: TableDisplayMode;
  displayModes: TableDisplayMode[];
}): boolean {
  return activeDisplayMode === "gallery" && displayModes.includes("gallery");
}

function resolvePrimaryGroupingDisplay({
  columnDefinitions,
  grouping,
}: {
  columnDefinitions: { header: string; id: string }[];
  grouping: unknown;
}) {
  const groupBy = getPrimaryGrouping(grouping);
  return {
    groupBy,
    groupLabel:
      columnDefinitions.find((definition) => definition.id === groupBy)
        ?.header ?? groupBy,
  };
}

function canUpdateKanbanRows({
  allowDragUpdate,
  allowEdit,
  hasUpdateAction,
  isKanbanMode,
}: {
  allowDragUpdate?: boolean;
  allowEdit?: boolean;
  hasUpdateAction: boolean;
  isKanbanMode: boolean;
}): boolean {
  return Boolean(
    isKanbanMode &&
      allowDragUpdate === true &&
      allowEdit !== false &&
      hasUpdateAction
  );
}

interface ColumnSizingDefinition {
  maxSize?: number;
  minSize?: number;
  size?: number;
}

/** Detect number column from def.type or def.meta.columnType (set by createNumberColumn) */
function isNumberColumn(def: {
  type?: string;
  meta?: { columnType?: string };
}): boolean {
  return def.type === "number" || def.meta?.columnType === "number";
}

function getColumnSizingStyle(
  columnDef: ColumnSizingDefinition,
  columnSize: number,
  isFixedColumn: boolean
): CSSProperties | undefined {
  const hasExplicitSizing =
    typeof columnDef.size === "number" ||
    typeof columnDef.minSize === "number" ||
    typeof columnDef.maxSize === "number";

  if (!(isFixedColumn || hasExplicitSizing)) {
    return undefined;
  }

  const style: CSSProperties = {};

  if (isFixedColumn || typeof columnDef.size === "number") {
    style.width = columnSize;
  }

  if (isFixedColumn) {
    style.minWidth = columnSize;
  } else if (typeof columnDef.minSize === "number") {
    style.minWidth = columnDef.minSize;
  }

  if (typeof columnDef.maxSize === "number") {
    style.maxWidth = columnDef.maxSize;
  }

  return style;
}

function getHeaderSizeStyle<TData>(
  header: Header<TData, unknown>
): CSSProperties | undefined {
  const isFixedColumn = header.id === "select" || header.id === "actions";
  const headerDef = header.column.columnDef as ColumnSizingDefinition;
  return getColumnSizingStyle(
    headerDef,
    header.column.getSize(),
    isFixedColumn
  );
}

function getHeaderCellClassName<TData>(
  header: Header<TData, unknown>,
  densityMode: "small" | "medium" | "large"
): string {
  const isSmallDensity = densityMode === "small";
  const isLargeDensity = densityMode === "large";
  const fixedColumnPaddingClass = getFixedColumnPaddingClass(densityMode);

  return cn(
    "relative whitespace-nowrap",
    isSmallDensity && "!h-8 !px-1.5",
    isLargeDensity && "!h-12 !px-3",
    header.id === "select" &&
      cn(
        "select-column text-center [&:has([role=checkbox])]:pr-2!",
        fixedColumnPaddingClass
      ),
    header.id === "actions" &&
      cn(
        "actions-column sticky right-0 z-20 text-center shadow-[-1px_0_0_0_hsl(var(--border))]",
        fixedColumnPaddingClass
      ),
    isNumberColumn(header.column.columnDef) && "text-right"
  );
}

function getFixedColumnPaddingClass(
  densityMode: "small" | "medium" | "large"
): string {
  if (densityMode === "small") {
    return "!px-1.5";
  }

  if (densityMode === "large") {
    return "!px-3";
  }

  return "px-2";
}

export function getRegularCellClassName<TData>({
  cell,
  densityMode,
}: {
  cell: ReturnType<Row<TData>["getVisibleCells"]>[number];
  densityMode: "small" | "medium" | "large";
}): string {
  const fixedColumnPaddingClass = getFixedColumnPaddingClass(densityMode);
  const isSmallDensity = densityMode === "small";
  const isLargeDensity = densityMode === "large";
  const isSelectColumn = cell.column.id === "select";
  const isActionsColumn = cell.column.id === "actions";

  return cn(
    isSelectColumn &&
      cn("text-center [&:has([role=checkbox])]:pr-2!", fixedColumnPaddingClass),
    isActionsColumn &&
      cn(
        "sticky right-0 z-10 flex justify-center bg-card shadow-[-1px_0_0_0_hsl(var(--border))] group-hover:bg-muted/50 group-data-[state=selected]:bg-muted/50",
        fixedColumnPaddingClass
      ),
    !(isSmallDensity || isLargeDensity) && "p-2",
    isSmallDensity && "!p-1.5",
    isLargeDensity && "!p-3",
    isNumberColumn(cell.column.columnDef) && "text-right"
  );
}

function getHeaderAriaLabel(headerId: string): string | undefined {
  return headerId === "actions" ? "Actions" : undefined;
}

function renderHeaderContent<TData>(
  header: Header<TData, unknown>,
  table: { getAllColumns: () => unknown[] },
  tableId: string
): ReactNode {
  if (header.isPlaceholder) {
    return null;
  }
  if (header.id === "select") {
    return flexRender(header.column.columnDef.header, header.getContext());
  }
  return (
    <DataTableColumnHeader
      column={header.column}
      table={table as never}
      tableId={tableId}
      title={header.column.columnDef.header as string}
    />
  );
}

interface TableDataQueryPayload<TData> {
  data: TData[];
  pageCount?: number;
  rowCount?: number;
  [key: string]: unknown;
}

function getInlineEditConfigFromCell<TData>(
  cell: Cell<TData, unknown>
): InlineEditColumnRuntimeConfig | undefined {
  const columnMeta = cell.column.columnDef.meta as
    | {
        inlineEdit?: InlineEditColumnRuntimeConfig;
      }
    | undefined;

  return columnMeta?.inlineEdit;
}

function isCellInlineEditable<TData>(
  cell: Cell<TData, unknown>,
  inlineConfig: InlineEditColumnRuntimeConfig | undefined
): inlineConfig is InlineEditColumnRuntimeConfig {
  if (!inlineConfig) {
    return false;
  }

  if (!inlineConfig.enabled || inlineConfig.readonly) {
    return false;
  }

  if (cell.column.id === "actions" || cell.column.id === "select") {
    return false;
  }

  return !(
    cell.getIsAggregated() ||
    cell.getIsGrouped() ||
    cell.getIsPlaceholder()
  );
}

function resolveRowEntityId<TData extends Record<string, unknown>>(
  row: Row<TData>
): string {
  const rowRecord = row.original as Record<string, unknown>;
  const candidateId = rowRecord.id ?? rowRecord._id;
  if (candidateId != null) {
    return String(candidateId);
  }

  return row.id;
}

function patchInlineEditInQueryPayload<TData extends Record<string, unknown>>(
  payload: TableDataQueryPayload<TData> | undefined,
  rowId: string,
  fieldName: string,
  value: unknown
): TableDataQueryPayload<TData> | undefined {
  if (!(payload && Array.isArray(payload.data))) {
    return payload;
  }

  let hasChanged = false;
  const nextData = payload.data.map((item) => {
    const rowRecord = item as Record<string, unknown>;
    const itemId = rowRecord.id ?? rowRecord._id;
    if (itemId == null || String(itemId) !== rowId) {
      return item;
    }

    hasChanged = true;
    return {
      ...item,
      [fieldName]: value,
    };
  });

  if (!hasChanged) {
    return payload;
  }

  return {
    ...payload,
    data: nextData,
  };
}

type TableDataSnapshot<TData extends Record<string, unknown>> = [
  readonly unknown[],
  TableDataQueryPayload<TData> | undefined,
][];

function getTableDataSnapshots<TData extends Record<string, unknown>>(
  queryClient: QueryClient,
  tableId: string
): TableDataSnapshot<TData> {
  return queryClient.getQueriesData<TableDataQueryPayload<TData>>({
    queryKey: ["tableData", tableId],
  });
}

function applyInlineOptimisticPatch<TData extends Record<string, unknown>>({
  formField,
  optimisticValue,
  queryClient,
  rowId,
  snapshots,
}: {
  snapshots: TableDataSnapshot<TData>;
  queryClient: QueryClient;
  rowId: string;
  formField: string;
  optimisticValue: unknown;
}) {
  for (const [queryKey, queryData] of snapshots) {
    queryClient.setQueryData<TableDataQueryPayload<TData>>(
      queryKey,
      patchInlineEditInQueryPayload(
        queryData,
        rowId,
        formField,
        optimisticValue
      )
    );
  }
}

function restoreInlineSnapshots<TData extends Record<string, unknown>>(
  queryClient: QueryClient,
  snapshots: TableDataSnapshot<TData>
) {
  for (const [queryKey, queryData] of snapshots) {
    queryClient.setQueryData(queryKey, queryData);
  }
}

function failInlineEditCommit(errorMessage: string): InlineEditCommitResult {
  toast.error(errorMessage);
  return {
    success: false,
    errorMessage,
  };
}

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
  enableColumnPinning?: boolean;
  enableMultiRowSelection?: boolean;
  enablePagination?: boolean;
  enableRowDragDrop?: boolean;
  enableRowSelection?: boolean;
  enableSorting?: boolean;
  enableGrouping?: boolean;
  getRowId?: (row: TData) => string;
  /** Optional custom overlay to render when loading */
  loadingOverlay?: ReactNode;
  onRowSelectionChange?: (rows: Row<TData>[]) => void;
  onRowSelectionStateChange?: (selection: Record<string, boolean>) => void;
  onBulkEdit?: (
    rows: Row<TData>[]
  ) => Promise<BulkActionCustomHandlerResult> | BulkActionCustomHandlerResult;
  onBulkDelete?: (
    rows: Row<TData>[]
  ) => Promise<BulkDeleteCustomHandlerResult> | BulkDeleteCustomHandlerResult;
  onBulkCopy?: (
    rows: Row<TData>[]
  ) => Promise<BulkActionCustomHandlerResult> | BulkActionCustomHandlerResult;
  onBulkExport?: (
    rows: Row<TData>[]
  ) => Promise<BulkActionCustomHandlerResult> | BulkActionCustomHandlerResult;
  customBulkActions?: CustomBulkActionsInput<TData>;
  closeOnError?: boolean;
  /**
   * Called when a row is clicked in row-link mode (url column with displayMode "row-link").
   * Receives the URL string. When omitted, defaults to `window.location.href = url`.
   */
  onRowClick?: (url: string, row: TData, event: React.MouseEvent) => void;
  showDefaultToastsForCustomHandlers?: boolean;
  queryFn?: (
    params: Record<string, unknown>
  ) => Promise<{ data: TData[]; pageCount: number; rowCount: number }>;
  rowSelection?: Record<string, boolean>;
  tableType?: string;
  formType?: string;
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

function TableEmptyStateContent({
  description,
  title,
}: {
  description?: string;
  title: string;
}) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center px-4 py-10 text-center text-muted-foreground">
      <p className="font-semibold text-foreground text-sm">{title}</p>
      {description ? <p className="mt-1 text-sm">{description}</p> : null}
    </div>
  );
}

/**
 * Modern implementation of DataTable using the new hooks and components
 */
function ModernDataTable<
  TData extends Record<string, unknown>,
  TValue = unknown,
>({
  className,
  columns = EMPTY_COLUMNS,
  data: _initialData = EMPTY_DATA,
  enableColumnDragDropByDefault = false,
  enableColumnFilters = true,
  enableColumnPinning = true,
  enableMultiRowSelection = true,
  enablePagination = true,
  enableRowDragDrop: _enableRowDragDrop = false,
  enableRowSelection = true,
  enableSorting = true,
  enableGrouping = true,
  getRowId,
  loadingOverlay: loadingOverlayProp,
  onRowSelectionChange,
  onRowSelectionStateChange,
  onBulkEdit,
  onBulkDelete,
  onBulkCopy,
  onBulkExport,
  customBulkActions,
  closeOnError,
  activeRowId,
  emptyState,
  onRowClick,
  onRowActivate,
  showDefaultToastsForCustomHandlers,
  queryFn: _queryFn,
  rowSelection,
  tableId,
  tableType,
  formType,
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
  const { isVisible: isBulkActionsAnchorVisible, ref: bulkActionsAnchorRef } =
    useOnScreen(BULK_ACTIONS_ANCHOR_VIEWPORT_OPTIONS);
  const { isVisible: isPaginationVisible, ref: paginationVisibilityRef } =
    useOnScreen(PAGINATION_VIEWPORT_OPTIONS);
  const [paginationControlsElement, setPaginationControlsElement] =
    useState<HTMLDivElement | null>(null);
  const [paginationHeight, setPaginationHeight] = useState(0);
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    const paginationElement = paginationControlsElement;
    if (!paginationElement) {
      setPaginationHeight(0);
      return;
    }

    const updatePaginationHeight = () => {
      setPaginationHeight(paginationElement.getBoundingClientRect().height);
    };

    updatePaginationHeight();

    const observer = new ResizeObserver(() => {
      updatePaginationHeight();
    });

    observer.observe(paginationElement);

    return () => {
      observer.disconnect();
    };
  }, [paginationControlsElement]);

  const handlePaginationContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      paginationVisibilityRef.current = node;
    },
    [paginationVisibilityRef]
  );
  const handlePaginationControlsRef = useCallback(
    (node: HTMLDivElement | null) => {
      setPaginationControlsElement(node);
    },
    []
  );

  // Use stable references for callbacks
  const stableOnRowSelectionChange = useRef(onRowSelectionChange);
  useEffect(() => {
    stableOnRowSelectionChange.current = onRowSelectionChange;
  }, [onRowSelectionChange]);
  const queryClient = useQueryClient();
  const setFormState = useSetAtom(catalogueFormAtom);
  const { t } = useTranslations();
  const getFormConfig = useFormConfig();
  const resolvedTableType = tableType || tableId;
  const defaultFormType = formType || resolvedTableType;
  const getProviderTableActions = useProviderTableActions();
  const providerTableActions = useMemo(
    () => getProviderTableActions?.(resolvedTableType),
    [getProviderTableActions, resolvedTableType]
  );

  // Use proper data table hook like in production
  const dataTableResult = useDataTable({
    enabled: true,
    formType: defaultFormType,
    tableId,
    tableType: resolvedTableType,
  });

  const {
    data: fetchedData,
    error,
    isError,
    isLoading,
    pageCount,
    refetch,
    rowCount,
    state,
  } = dataTableResult;

  // Get table config to access column types
  const { config: tableConfig } = useTableConfig(resolvedTableType);
  const isFooterVisible = useAtomValue(footerVisibleAtom(tableId));
  const showCalculationsFooter = shouldShowCalculationsFooter({
    enableCalculations: tableConfig.table.enableCalculations,
    isFooterVisible,
  });
  const densityMode = tableConfig.table.density ?? "medium";
  const isSmallDensity = densityMode === "small";
  const isLargeDensity = densityMode === "large";

  const rowLinkAccessorKey = useMemo(() => {
    const rowLinkCol = tableConfig.columns.definitions.find(
      (def) => def.type === "url" && def.urlDisplayMode === "row-link"
    );
    return rowLinkCol?.id;
  }, [tableConfig.columns.definitions]);
  const galleryLinkColumnId = useMemo(
    () =>
      resolveGalleryLinkColumnId({
        columnDefinitions: tableConfig.columns.definitions,
      }),
    [tableConfig.columns.definitions]
  );
  const isRowClickEditEnabled =
    tableConfig.table.enableRowClickEdit === true &&
    tableConfig.table.allowEdit !== false;
  const hasInlineEditConfiguration = useMemo(() => {
    if (tableConfig.table.allowInlineEdit === false) {
      return false;
    }

    if (tableConfig.table.inlineEdit?.enabled === true) {
      return true;
    }

    for (const columnDef of tableConfig.columns.definitions) {
      if (columnDef.id === "actions" || columnDef.id === "select") {
        continue;
      }

      if (typeof columnDef.inlineEdit === "boolean") {
        if (columnDef.inlineEdit) {
          return true;
        }
        continue;
      }

      if (columnDef.inlineEdit?.enabled === true) {
        return true;
      }
    }

    return false;
  }, [
    tableConfig.columns.definitions,
    tableConfig.table.allowInlineEdit,
    tableConfig.table.inlineEdit?.enabled,
  ]);

  if (isRowClickEditEnabled && rowLinkAccessorKey) {
    throw new Error(
      'YaYaw Table configuration error: `table.enableRowClickEdit` is incompatible with `urlDisplayMode: "row-link"`.'
    );
  }
  if (isRowClickEditEnabled && hasInlineEditConfiguration) {
    throw new Error(
      "YaYaw Table configuration error: `table.enableRowClickEdit` is incompatible with inline edit. Disable row click edit or inline edit (`table.inlineEdit` / column `inlineEdit`)."
    );
  }

  const resolveInlineForm = useCallback(
    (row: TData) => {
      const formType =
        tableConfig.form?.resolveEditFormType?.(row) ??
        tableConfig.form?.editFormType ??
        defaultFormType;
      const context: FormConfigContext = {
        formType,
        mode: "edit",
        tableId,
        tableType: resolvedTableType,
        row,
        initialData: row,
        values: row,
      };
      return { context, config: getFormConfig?.(formType, context) };
    },
    [
      defaultFormType,
      getFormConfig,
      resolvedTableType,
      tableConfig.form,
      tableId,
    ]
  );
  const handleRowEditClick = useCallback(
    (row: Row<TData>) => {
      const handleSuccess = () => {
        queryClient
          .invalidateQueries({
            queryKey: ["tableData", tableId],
          })
          .catch(() => undefined);

        if (typeof refetch === "function") {
          refetch().catch(() => undefined);
        }
      };

      const rowData = row.original as Record<string, unknown>;
      const editFormType =
        tableConfig.form?.resolveEditFormType?.(rowData) ||
        tableConfig.form?.editFormType ||
        defaultFormType;

      const formState = openUpdateForm(
        editFormType,
        tableId,
        rowData,
        handleSuccess,
        resolvedTableType
      );

      setFormState(formState as CatalogueFormState<Record<string, unknown>>);
    },
    [
      defaultFormType,
      queryClient,
      refetch,
      resolvedTableType,
      setFormState,
      tableConfig.form,
      tableId,
    ]
  );

  const commitInlineEdit = useCallback(
    async ({
      formField,
      optimistic,
      row,
      value,
    }: {
      row: Row<TData>;
      formField: string;
      value: unknown;
      optimistic: boolean;
    }) => {
      const editAction = dataTableResult.actions.edit;
      if (typeof editAction !== "function") {
        return failInlineEditCommit(t("inline.missing_update_action"));
      }
      const rowId = resolveRowEntityId(row);
      if (!rowId) {
        return failInlineEditCommit(t("inline.missing_row_id"));
      }

      const cacheSnapshots = getTableDataSnapshots<TData>(queryClient, tableId);
      if (optimistic) {
        applyInlineOptimisticPatch({
          snapshots: cacheSnapshots,
          queryClient,
          rowId,
          formField,
          optimisticValue: value,
        });
      }

      try {
        const rowWithId = {
          ...(row.original as Record<string, unknown>),
          id: rowId,
        } as TData & { id: string };

        const success = await editAction(rowWithId, {
          [formField]: value,
        } as Partial<TData>);

        if (!success) {
          throw new Error(t("inline.save_error"));
        }

        await queryClient.invalidateQueries({
          queryKey: ["tableData", tableId],
        });

        return {
          success: true,
          committedValue: value,
        };
      } catch (error) {
        if (optimistic) {
          restoreInlineSnapshots(queryClient, cacheSnapshots);
        }

        const errorMessage =
          error instanceof Error ? error.message : t("inline.save_error");
        return failInlineEditCommit(errorMessage);
      }
    },
    [dataTableResult.actions.edit, queryClient, t, tableId]
  );

  const csvExportColumns = useMemo(() => {
    return buildCsvExportColumns({
      columnDefinitions: tableConfig.columns.definitions.map((definition) => ({
        header: definition.header,
        id: definition.id,
      })),
      columnOrder: state.columnOrder,
      defaultVisibleColumns: tableConfig.columns.visible,
      visibility: state.columnVisibility,
    });
  }, [
    tableConfig.columns.definitions,
    tableConfig.columns.visible,
    state.columnOrder,
    state.columnVisibility,
  ]);

  // Use fetched data from API like in production
  const data = fetchedData || [];

  // Create a table instance with the actual data to be used (filtered or not)
  // Memoize table instance configuration to prevent recreating table on every render
  const tableInstanceConfig = useMemo(
    () => ({
      columns: columns as ColumnDef<TData>[],
      data: data as TData[],
      defaultPageSize: tableConfig.table.defaultPageSize,
      defaultVisibleColumns: tableConfig.columns.visible,
      enableColumnFilters,
      enableColumnPinning,
      enableMultiRowSelection,
      enablePagination,
      enableRowSelection,
      enableGrouping,
      enableSorting,
      getRowId,
      canSelectRow: tableConfig.table.canSelectRow as
        | ((row: TData) => boolean)
        | undefined,
      pageCount,
      onRowSelectionChange: onRowSelectionStateChange,
      rowSelection,
      tableId: tableId || "",
    }),
    [
      columns,
      data,
      tableConfig.table.defaultPageSize,
      tableConfig.columns.visible,
      enableColumnFilters,
      enableColumnPinning,
      enableMultiRowSelection,
      enablePagination,
      enableRowSelection,
      enableGrouping,
      enableSorting,
      getRowId,
      tableConfig.table.canSelectRow,
      pageCount,
      onRowSelectionStateChange,
      rowSelection,
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
  const headerStateKey = JSON.stringify({
    columnPinning: table.getState().columnPinning,
    columnVisibility: table.getState().columnVisibility,
    grouping: table.getState().grouping,
    sorting: table.getState().sorting,
  });

  // Get leaf column IDs in display order (so headers and SortableContext stay in sync with body)
  const leafColumnIds = useMemo(() => {
    const leafColumns = table.getAllLeafColumns();
    const ids = leafColumns.map((column) => column.id);
    if (!columnOrder?.length) {
      return ids;
    }
    const orderIndex = (id: string) => columnOrder.indexOf(id);
    return [...ids].sort((a, b) => orderIndex(a) - orderIndex(b));
  }, [table, columnOrder]);

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
    enableColumnDragDropByDefault,
    tableConfig.table.enableColumnDnd !== false
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

  // Cursor during drag (column or row)
  const activeRowDragId = useAtomValue(activeRowDragAtom(tableId));
  useEffect(() => {
    const isDragging = !!activeColumn || activeRowDragId !== null;
    if (!isDragging) {
      return;
    }
    const previousCursor = document.body.style.cursor;
    document.body.style.cursor = "grabbing";
    return () => {
      document.body.style.cursor = previousCursor;
    };
  }, [activeColumn, activeRowDragId]);

  // Setup bulk actions: pass only app-provided callbacks; hook uses provider (update/delete) and clipboard copy when undefined
  const bulkActions = useBulkActions({
    bulkDeleteEnabled: tableConfig.table.allowBulkDelete !== false,
    bulkEditEnabled: tableConfig.table.allowBulkEdit !== false,
    bulkExportEnabled: tableConfig.table.bulkExport !== false,
    closeOnError,
    csvExportColumns,
    onBulkExport,
    table,
    tableId,
    tableType: resolvedTableType,
    onBulkEdit,
    onBulkDelete,
    onBulkCopy,
    rowCount,
    showDefaultToastsForCustomHandlers,
    preserveSelectionOnQuery:
      tableConfig.table.preserveSelectionOnQuery === true,
  });

  useEffect(() => {
    onRowSelectionChange?.(bulkActions.selectedRows);
  }, [bulkActions.selectedRows, onRowSelectionChange]);

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
  const {
    advancedFiltersParam,
    displayModeParam,
    expandedParam,
    filtersParam,
    galleryParam,
    globalSearchParam,
    groupingParam,
    kanbanParam,
    setExpandedFromUI,
  } = useTableUrlState({
    defaultDisplayMode: tableConfig.table.defaultDisplayMode,
    tableId: tableId || "",
  });
  const resolvedEmptyState = useMemo<TableEmptyStateConfig>(
    () => ({
      ...tableConfig.table.emptyState,
      ...emptyState,
    }),
    [emptyState, tableConfig.table.emptyState]
  );
  const hasActiveSearchOrFilters = useMemo(() => {
    return (
      globalSearchParam.trim().length > 0 ||
      filtersParam.length > 0 ||
      advancedFiltersParam.length > 0
    );
  }, [advancedFiltersParam, filtersParam, globalSearchParam]);
  const emptyStateTitle =
    resolvedEmptyState.title ??
    (hasActiveSearchOrFilters ? t("table.no_results") : t("state.noData"));
  const emptyStateDescription =
    resolvedEmptyState.description ??
    (hasActiveSearchOrFilters ? t("table.no_results_description") : undefined);
  const configuredDisplayModes = tableConfig.table.displayModes ?? ["table"];
  const activeDisplayMode = resolveActiveDisplayMode({
    defaultDisplayMode: tableConfig.table.defaultDisplayMode,
    displayModeParam,
    displayModes: configuredDisplayModes,
  });
  const kanbanConfig = useMemo(
    () => ({
      ...tableConfig.table.kanban,
      ...kanbanParam,
    }),
    [kanbanParam, tableConfig.table.kanban]
  );
  const { groupBy: primaryGrouping, groupLabel: primaryGroupingLabel } =
    resolvePrimaryGroupingDisplay({
      columnDefinitions: tableConfig.columns.definitions,
      grouping: groupingParam,
    });
  const kanbanGroupBy = primaryGrouping || kanbanConfig.groupBy || "";
  const isKanbanMode = shouldUseKanbanDisplayMode({
    activeDisplayMode,
    displayModes: configuredDisplayModes,
    groupBy: kanbanGroupBy,
  });
  const isGalleryMode = shouldUseGalleryDisplayMode({
    activeDisplayMode,
    displayModes: configuredDisplayModes,
  });
  const galleryConfig = useMemo(
    () => ({
      ...tableConfig.table.gallery,
      ...galleryParam,
    }),
    [galleryParam, tableConfig.table.gallery]
  );
  const canDragKanbanRows = canUpdateKanbanRows({
    allowDragUpdate: tableConfig.table.kanban?.allowDragUpdate,
    allowEdit: tableConfig.table.allowEdit,
    hasUpdateAction: typeof providerTableActions?.update === "function",
    isKanbanMode,
  });

  const handleRowLinkClick = useCallback(
    (row: Row<TData>, event: React.MouseEvent) => {
      if (!rowLinkAccessorKey) {
        return;
      }

      const url = String(
        (row.original as Record<string, unknown>)[rowLinkAccessorKey] ?? ""
      );
      if (!url) {
        return;
      }
      if (onRowClick) {
        onRowClick(url, row.original, event);
        return;
      }
      if (event.metaKey || event.ctrlKey) {
        window.open(url, "_blank", "noopener");
        return;
      }
      window.location.href = url;
    },
    [onRowClick, rowLinkAccessorKey]
  );

  const getGalleryRowLinkUrl = useCallback(
    (row: Row<TData>) => {
      if (!galleryLinkColumnId) {
        return;
      }

      return resolveGalleryLinkUrl(
        (row.original as Record<string, unknown>)[galleryLinkColumnId]
      );
    },
    [galleryLinkColumnId]
  );

  const canEditGalleryRow = useCallback(
    (row: Row<TData>) => {
      if (tableConfig.table.allowEdit === false) {
        return false;
      }

      return (
        tableConfig.table.canEditRow?.(
          row.original as Record<string, unknown>
        ) !== false
      );
    },
    [tableConfig.table.allowEdit, tableConfig.table.canEditRow]
  );

  const handleGalleryRowLinkClick = useCallback(
    (row: Row<TData>, event: React.MouseEvent<HTMLButtonElement>) => {
      const url = getGalleryRowLinkUrl(row);
      if (!url) {
        return;
      }

      if (onRowClick) {
        onRowClick(url, row.original, event);
        return;
      }

      window.open(url, "_blank", "noopener");
    },
    [getGalleryRowLinkUrl, onRowClick]
  );

  const getRowClickMode = useCallback(
    (row: Row<TData>) => {
      const canEditRow = canEditRowWithTablePermissions({
        allowEdit: tableConfig.table.allowEdit,
        canEditRow: tableConfig.table.canEditRow,
        row: row.original as Record<string, unknown>,
      });
      const rowClickMode = resolveEffectiveRowClickMode({
        configuredMode: tableConfig.table.rowClickMode,
        hasRowLink: Boolean(rowLinkAccessorKey),
        isRowClickEditEnabled,
      });
      const canClickRow =
        (rowClickMode === "activate" && Boolean(onRowActivate)) ||
        (rowClickMode === "edit" && canEditRow) ||
        (rowClickMode === "link" && Boolean(rowLinkAccessorKey));

      return { canClickRow, canEditRow, rowClickMode };
    },
    [
      isRowClickEditEnabled,
      onRowActivate,
      rowLinkAccessorKey,
      tableConfig.table.allowEdit,
      tableConfig.table.canEditRow,
      tableConfig.table.rowClickMode,
    ]
  );

  const handleInteractiveRowClick = useCallback(
    (
      row: Row<TData>,
      event: React.MouseEvent,
      options?: { ignoreInteractiveTarget?: boolean }
    ) => {
      const { canEditRow, rowClickMode } = getRowClickMode(row);
      handleDataTableRowClick({
        canEditRow,
        event,
        ignoreInteractiveTarget: options?.ignoreInteractiveTarget,
        onRowActivate,
        onRowEdit: handleRowEditClick,
        onRowLink: rowLinkAccessorKey
          ? (clickedRow, clickEvent) => {
              handleRowLinkClick(clickedRow, clickEvent);
            }
          : undefined,
        row,
        rowClickMode,
      });
    },
    [
      getRowClickMode,
      handleRowEditClick,
      handleRowLinkClick,
      onRowActivate,
      rowLinkAccessorKey,
    ]
  );

  const handleKanbanMoveRow = useCallback(
    async (row: Row<TData>, nextValue: string) => {
      if (!(canDragKanbanRows && kanbanGroupBy)) {
        return;
      }

      const rowId = resolveRowEntityId(row);
      const success = await dataTableResult.actions.edit(
        {
          ...(row.original as Record<string, unknown>),
          id: rowId,
        } as TData & { id: string },
        { [kanbanGroupBy]: nextValue } as Partial<TData>
      );

      if (!success) {
        toast.error(t("common.error"));
        return;
      }

      await refetch();
    },
    [canDragKanbanRows, dataTableResult.actions.edit, kanbanGroupBy, refetch, t]
  );

  // Local state to track expanded groups (bypass TanStack issues)
  const [localExpanded, setLocalExpanded] = useState<Record<string, boolean>>(
    {}
  );

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
    const showEmptyState = shouldRenderTableEmptyState({
      dataLength: data.length,
      isError,
      isLoading,
      rowCount,
      showEmptyState: resolvedEmptyState.show !== false,
    });
    if (showEmptyState) {
      return (
        <TableBody>
          <TableRow>
            <TableCell
              colSpan={Math.max(table.getVisibleLeafColumns().length, 1)}
            >
              <TableEmptyStateContent
                description={emptyStateDescription}
                title={emptyStateTitle}
              />
            </TableCell>
          </TableRow>
        </TableBody>
      );
    }

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

      return <ColumnIcon columnId={columnId} columnType={columnType} />;
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
          <TableCell
            className={cn(
              "flex justify-center align-middle [&:has([role=checkbox])]:pr-2!",
              isSmallDensity ? "!px-1.5 !py-1.5" : "px-2",
              isLargeDensity && "!px-3 !py-3"
            )}
            style={{
              ...(typeof (
                visibleCells[0].column.columnDef as { maxSize?: number }
              ).maxSize === "number"
                ? {
                    maxWidth: (
                      visibleCells[0].column.columnDef as {
                        maxSize: number;
                      }
                    ).maxSize,
                  }
                : {}),
              minWidth: visibleCells[0].column.getSize(),
              width: visibleCells[0].column.getSize(),
            }}
          >
            <GroupRowSelectionCell row={row} table={table} />
          </TableCell>
          <TableCell
            className="p-0 align-middle"
            colSpan={visibleCells.length - 1}
          >
            <Button
              className={cn(
                "flex h-auto w-full cursor-pointer items-center justify-start gap-2",
                isSmallDensity ? "p-1.5" : "p-2",
                isLargeDensity && "p-3"
              )}
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

    const renderRegularCellContent = (
      row: Row<TData>,
      cell: ReturnType<Row<TData>["getVisibleCells"]>[number]
    ) => {
      const defaultCellContent = flexRender(
        cell.column.columnDef.cell,
        cell.getContext()
      );
      const inlineConfig = getInlineEditConfigFromCell(cell);
      const canInlineEdit = isCellInlineEditable(cell, inlineConfig);
      if (!(canInlineEdit && canEditGalleryRow(row))) {
        return defaultCellContent;
      }

      const { config, context } = resolveInlineForm(row.original);

      return (
        <CatalogueInlineCell
          cell={cell}
          config={config}
          context={context}
          displayValue={defaultCellContent}
          inlineConfig={inlineConfig}
          onCommit={async (value) => {
            return await commitInlineEdit({
              row,
              formField: inlineConfig.formField,
              optimistic: inlineConfig.optimistic,
              value,
            });
          }}
        />
      );
    };

    const renderRegularCell = (
      row: Row<TData>,
      cell: ReturnType<Row<TData>["getVisibleCells"]>[number]
    ) => {
      const isFixedColumn =
        cell.column.id === "select" || cell.column.id === "actions";
      const def = cell.column.columnDef as ColumnSizingDefinition;
      const sizeStyle = getColumnSizingStyle(
        def,
        cell.column.getSize(),
        isFixedColumn
      );

      return (
        <TableCell
          className={getRegularCellClassName({ cell, densityMode })}
          data-column-id={cell.column.id}
          key={cell.id}
          style={sizeStyle}
        >
          {renderRegularCellContent(row, cell)}
        </TableCell>
      );
    };

    const renderRegularRow = (
      row: Row<TData>,
      visibleCells: ReturnType<Row<TData>["getVisibleCells"]>
    ) => {
      const { canClickRow } = getRowClickMode(row);
      const isActiveRow = isRowIdActive({
        activeRowId,
        rowId: row.id,
        rowOriginal: row.original as Record<string, unknown>,
      });

      return (
        <TableRow
          className={cn(
            "group",
            "data-[state=selected]:bg-muted/50",
            row.getIsSelected() && "bg-muted/50",
            isActiveRow &&
              "bg-primary/5 shadow-[inset_2px_0_0_hsl(var(--primary))]",
            canClickRow && "cursor-pointer hover:bg-muted/40"
          )}
          data-active={isActiveRow ? "true" : undefined}
          data-state={row.getIsSelected() ? "selected" : ""}
          key={row.id}
          onClick={
            canClickRow
              ? (event) => {
                  handleInteractiveRowClick(row, event);
                }
              : undefined
          }
        >
          {visibleCells.map((cell) => renderRegularCell(row, cell))}
        </TableRow>
      );
    };

    const rowElements: ReactNode[] = [];

    const pushSelectionGroupButtonRow = (
      groupId: string,
      colSpan: number,
      level: number,
      icon: ReactNode,
      label: string,
      count: number,
      badgeClassName: string
    ) => (
      <TableRow className="border-t bg-muted/20" key={groupId}>
        <TableCell
          className={cn(isSmallDensity && "!p-1.5", isLargeDensity && "!p-3")}
          colSpan={colSpan}
        >
          <Button
            className={cn(
              "flex h-auto w-full cursor-pointer items-center justify-start gap-2",
              isSmallDensity ? "p-1.5" : "p-2",
              isLargeDensity && "p-3"
            )}
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
            <ColumnIcon
              className="text-green-600 dark:text-green-400"
              columnType="select"
            />,
            "☑️ Selected",
            selectedRows.length,
            "rounded-full bg-green-500/10 px-2 py-0.5 text-green-700 text-xs dark:bg-green-500/20 dark:text-green-300"
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
            "rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs"
          )
        );
        if (localExpanded[unselectedGroupId]) {
          pushExpandedSubRows(unselectedRows);
        }
      }
    };

    const renderRowWithChildren = (row: Row<TData>, level = 0) => {
      const visibleCells = row.getVisibleCells();
      const isGroupedRow = visibleCells.some((cell) => cell.getIsGrouped());

      if (!isGroupedRow) {
        rowElements.push(renderRegularRow(row, visibleCells));
        return;
      }

      const groupingColumn = (state.grouping as string[])?.[level] ?? "";
      if (groupingColumn === "select") {
        pushSelectionGroupRows(row, level);
        return;
      }

      rowElements.push(renderGroupedRow(row, visibleCells, level));
      if (!localExpanded[row.id]) {
        return;
      }

      for (const subRow of row.subRows ?? []) {
        renderRowWithChildren(subRow, level + 1);
      }
    };

    for (const row of rows) {
      renderRowWithChildren(row);
    }

    return <TableBody>{rowElements}</TableBody>;
  }, [
    commitInlineEdit,
    isLoading,
    data,
    table,
    hasMounted,
    isError,
    rowCount,
    resolvedEmptyState.show,
    emptyStateDescription,
    emptyStateTitle,
    resolveInlineForm,
    canEditGalleryRow,
    localExpanded,
    state.grouping,
    tableConfig.columns.definitions,
    densityMode,
    isSmallDensity,
    isLargeDensity,
    getRowClickMode,
    handleInteractiveRowClick,
    activeRowId,
  ]);

  // Optimize table header with better memoization (columnOrder in deps so header re-renders when order changes)
  const tableHeader = useMemo(() => {
    const orderKey = columnOrder?.join(",") ?? "";
    return (
      <TableHeader
        className={cn(
          "[&_th]:relative [&_th]:bg-muted/20 [&_th]:font-medium [&_th]:text-sm",
          isSmallDensity && "[&_th]:!h-8 [&_th]:!px-1.5",
          isLargeDensity && "[&_th]:!h-12 [&_th]:!px-3"
        )}
        key={`${orderKey}:${headerStateKey}`}
      >
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            <ColumnSortableContext
              items={leafColumnIds}
              strategy={horizontalListSortingStrategy}
            >
              {headerGroup.headers.map((header) => (
                <SortableHeader
                  aria-label={getHeaderAriaLabel(header.id)}
                  className={getHeaderCellClassName(header, densityMode)}
                  column={header.column as never}
                  id={header.id}
                  key={header.id}
                  style={getHeaderSizeStyle(header)}
                >
                  {renderHeaderContent(header, table, tableId)}
                </SortableHeader>
              ))}
            </ColumnSortableContext>
          </TableRow>
        ))}
      </TableHeader>
    );
  }, [
    table,
    leafColumnIds,
    tableId,
    horizontalListSortingStrategy,
    columnOrder,
    isSmallDensity,
    isLargeDensity,
    densityMode,
    headerStateKey,
  ]);

  const renderDisplayContent = () => {
    if (isKanbanMode) {
      return (
        <div className="relative">
          {isLoading && data && data.length > 0 && loadingOverlay}
          <DataTableKanbanView
            canDragUpdate={canDragKanbanRows}
            cardColumnIds={kanbanConfig.cardColumnIds}
            className={className}
            columnDefinitions={tableConfig.columns.definitions}
            config={kanbanConfig}
            emptyState={
              <TableEmptyStateContent
                description={emptyStateDescription}
                title={emptyStateTitle}
              />
            }
            groupBy={kanbanGroupBy}
            isRowActive={(row) =>
              isRowIdActive({
                activeRowId,
                rowId: row.id,
                rowOriginal: row.original as Record<string, unknown>,
              })
            }
            isRowClickable={(row) => getRowClickMode(row).canClickRow}
            onMoveRow={handleKanbanMoveRow}
            onRowClick={(row, event) => {
              handleInteractiveRowClick(row, event);
            }}
            table={table}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
            ref={bulkActionsAnchorRef}
          />
        </div>
      );
    }

    if (isGalleryMode) {
      return (
        <div className="relative">
          {isLoading && data && data.length > 0 && loadingOverlay}
          <DataTableGalleryView
            canEditRow={canEditGalleryRow}
            className={className}
            columnDefinitions={tableConfig.columns.definitions}
            config={galleryConfig}
            editRowLabel={t("actions.edit")}
            emptyState={
              <TableEmptyStateContent
                description={emptyStateDescription}
                title={emptyStateTitle}
              />
            }
            getRowLinkUrl={getGalleryRowLinkUrl}
            groupBy={primaryGrouping}
            groupLabel={primaryGroupingLabel}
            isRowActive={(row) =>
              isRowIdActive({
                activeRowId,
                rowId: row.id,
                rowOriginal: row.original as Record<string, unknown>,
              })
            }
            isRowClickable={(row) => getRowClickMode(row).canClickRow}
            linkRowLabel={t("actions.view")}
            onEditRow={(row) => {
              handleRowEditClick(row);
            }}
            onOpenRowLink={handleGalleryRowLinkClick}
            onRowClick={(row, event) => {
              handleInteractiveRowClick(row, event);
            }}
            table={table}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
            ref={bulkActionsAnchorRef}
          />
        </div>
      );
    }

    return (
      <div className="relative overflow-hidden rounded-md border">
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
            {showCalculationsFooter && (
              <TableFooter className="sticky bottom-0 z-10 overflow-hidden rounded-b-md bg-card">
                <FooterRow
                  densityMode={densityMode}
                  table={table}
                  tableId={tableId}
                  tableType={resolvedTableType}
                />
              </TableFooter>
            )}
          </Table>
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
          ref={bulkActionsAnchorRef}
        />
      </div>
    );
  };

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

    // Otherwise render the full table
    const renderBulkActionsInFooter =
      bulkActions.showBulkActions &&
      shouldRenderBulkActionsInFooter({
        enablePagination,
        isTableBottomVisible: isBulkActionsAnchorVisible,
      });
    const showPaginationControls = shouldRenderPaginationControls({
      enablePagination,
      pageCount: table.getPageCount(),
      pageSize: table.getState().pagination.pageSize,
      rowCount,
    });
    const showPaginationArea =
      enablePagination && (showPaginationControls || renderBulkActionsInFooter);
    const fixedBulkActionsViewportOffset = getBulkActionsViewportBottomOffset({
      isPaginationVisible,
      paginationHeight,
    });

    return (
      <ColumnDndContext
        collisionDetection={columnClosestCenter}
        modifiers={modifiers}
        onDragEnd={handleDragEndWithOverlay}
        onDragStart={handleDragStartWithOverlay}
        sensors={columnSensors}
      >
        <div className="relative">
          <div className="space-y-4">
            {renderDisplayContent()}

            {/* Pagination is outside the table container to avoid focus issues */}
            {showPaginationArea && (
              <SafePagination
                containerRef={handlePaginationContainerRef}
                controlsRef={handlePaginationControlsRef}
                footerSlot={
                  renderBulkActionsInFooter ? (
                    <BulkActionsMenu
                      canSelectAll={bulkActions.canSelectAll}
                      customBulkActions={customBulkActions}
                      isSelectingAll={bulkActions.isSelectingAll}
                      onBulkCopy={bulkActions.handleBulkCopy}
                      onBulkDelete={bulkActions.handleBulkDelete}
                      onBulkEdit={bulkActions.handleBulkEdit}
                      onBulkExport={bulkActions.handleBulkExport}
                      onClearSelection={bulkActions.clearSelection}
                      onClose={bulkActions.closeBulkActions}
                      onSelectAll={bulkActions.handleSelectAll}
                      positionMode="anchored"
                      selectAllCount={rowCount}
                      selectedRows={bulkActions.selectedRows}
                      showBulkDelete={bulkActions.isBulkDeleteEnabled}
                      showBulkEdit={bulkActions.isBulkEditEnabled}
                      showBulkExport={bulkActions.isBulkExportEnabled}
                    />
                  ) : undefined
                }
                pageSizeOptions={
                  tableConfig.table.pageSizeOptions || [
                    10, 20, 50, 100, 200, 500,
                  ]
                }
                rowCount={rowCount}
                showControls={showPaginationControls}
                table={table}
              />
            )}
          </div>

          {bulkActions.showBulkActions && !renderBulkActionsInFooter && (
            <BulkActionsMenu
              canSelectAll={bulkActions.canSelectAll}
              customBulkActions={customBulkActions}
              isSelectingAll={bulkActions.isSelectingAll}
              onBulkCopy={bulkActions.handleBulkCopy}
              onBulkDelete={bulkActions.handleBulkDelete}
              onBulkEdit={bulkActions.handleBulkEdit}
              onBulkExport={bulkActions.handleBulkExport}
              onClearSelection={bulkActions.clearSelection}
              onClose={bulkActions.closeBulkActions}
              onSelectAll={bulkActions.handleSelectAll}
              positionMode={getBulkActionsMenuPositionMode(
                isBulkActionsAnchorVisible
              )}
              selectAllCount={rowCount}
              selectedRows={bulkActions.selectedRows}
              showBulkDelete={bulkActions.isBulkDeleteEnabled}
              showBulkEdit={bulkActions.isBulkEditEnabled}
              showBulkExport={bulkActions.isBulkExportEnabled}
              viewportBottomOffset={fixedBulkActionsViewportOffset}
            />
          )}
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
    <div className="space-y-4" suppressHydrationWarning>
      {renderContent()}
      <CatalogueBulkEditor
        onClose={bulkActions.closeBulkEdit}
        onCompleted={bulkActions.completeBulkEdit}
        tableId={tableId}
        tableType={resolvedTableType}
        targets={bulkActions.bulkEditTargets}
      />
    </div>
  );
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
