/**
 * Advanced toolbar component for DataTable
 * Provides advanced filtering, view management, and other table controls
 */
"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useAtomValue, useSetAtom } from "jotai";
import { Download, Loader2, PlusIcon, RotateCcw } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  filterResetVersionAtom,
  selectedRowsAtom,
} from "../../atoms/table-atoms";
import { useDataTable } from "../../hooks/use-data-table";
import {
  useColumnsFilterConfig,
  useDataTableAdvancedFilters,
  useTableAccessors,
} from "../../hooks/use-data-table-advanced-filters";
import { useIsMobile } from "../../hooks/use-mobile";
import { useTableConfig } from "../../hooks/use-table-config";
import { useTableInstance } from "../../hooks/use-table-instance";
import { useTableUrlState } from "../../hooks/use-table-url-state";
import {
  useTableActions as useProviderTableActions,
  useTranslations,
} from "../../providers/table-provider";
import type {
  ColumnDef,
  ColumnFiltersState,
  ColumnSizingState,
  GroupingState,
  Row,
  SortingState,
  Table,
  VisibilityState,
} from "../../tanstack";
import type {
  ColumnDataType,
  ToolbarAction,
  ToolbarActionContext,
  ToolbarActionsInput,
  ToolbarActionsPlacement,
} from "../../types";
import type { DateDisplayPreset } from "../../types/date-types";
import { DATE_DISPLAY_PRESETS } from "../../types/date-types";
import { buildCsvExportColumns, exportRowsAsCsv } from "../../utils/csv-export";
import {
  fetchAllFilteredRows,
  type TableListAction,
  toAdvancedFiltersParam,
  toFiltersParam,
  toOrderByParam,
  toPageSize,
} from "../../utils/filtered-rows";
import {
  catalogueFormAtom,
  openCreateForm,
} from "../forms/atoms/catalogue-form-atoms";
import { SearchBar } from "./sections/search-bar";
import { TableMenu } from "./table-menu";
import {
  partitionToolbarActions,
  resolveToolbarActionState,
  resolveToolbarActions,
  shouldRenderToolbarAction,
} from "./toolbar-actions";

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
   * Table configuration type. Defaults to tableId for backwards compatibility.
   */
  tableType?: string;

  /**
   * Default form type for create/edit forms. Defaults to tableType.
   */
  formType?: string;

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
    "text" | "number" | "date" | "select" | "multiSelect"
  >;

  /**
   * Callback to override default toolbar export behavior
   */
  onExport?: (rows: Record<string, unknown>[]) => void | Promise<void>;

  /**
   * Custom actions rendered in toolbar
   */
  toolbarActions?: ToolbarActionsInput;

  /**
   * Placement for custom toolbar actions
   */
  toolbarActionsPlacement?: ToolbarActionsPlacement;

  /** Delay before applying global search, in milliseconds. */
  searchDebounceMs?: number;
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
  _columnTypeMapping: Record<string, string>,
  t?: (key: string, params?: Record<string, string | number>) => string
) {
  const isDateDisplayPreset = (value: unknown): value is DateDisplayPreset => {
    return (
      typeof value === "string" &&
      DATE_DISPLAY_PRESETS.includes(value as DateDisplayPreset)
    );
  };

  // Get column definitions from table configuration
  const columns = tableConfig.columns as Record<string, unknown> | undefined;
  const table = tableConfig.table as Record<string, unknown> | undefined;
  const tableDateDisplayPreset = isDateDisplayPreset(table?.dateDisplayPreset)
    ? table.dateDisplayPreset
    : undefined;
  const columnDefinitions =
    (columns?.definitions as Record<string, unknown>[]) || [];

  // Create column options from configuration instead of table instance
  const options = columnDefinitions
    .filter((colDef) => colDef.id !== "select" && colDef.id !== "actions") // Skip system columns
    .map((colDef) => {
      const columnDateDisplayPreset = (
        colDef as { dateDisplayPreset?: unknown }
      ).dateDisplayPreset;
      const rawDateFormat =
        (colDef as { dateFormat?: unknown }).dateFormat ??
        (colDef as { meta?: { dateFormat?: unknown } }).meta?.dateFormat;
      const resolvedDateDisplayPreset = isDateDisplayPreset(
        columnDateDisplayPreset
      )
        ? columnDateDisplayPreset
        : tableDateDisplayPreset;
      const resolvedDateFormat =
        typeof rawDateFormat === "string" ? rawDateFormat : undefined;
      const option = {
        canFilter: colDef.enableColumnFilter !== false,
        // Grouping: enable by default for non-system columns unless explicitly disabled via config
        // If a future config flag like enableGrouping exists on colDef, respect it; otherwise default to true
        canGroup:
          (colDef as { enableGrouping?: boolean }).enableGrouping !== false,
        canHide: true, // Most columns can be hidden
        canSort: colDef.enableSorting !== false,
        id: String(colDef.id),
        label: String(colDef.header || colDef.id),
        // Enhanced properties from column definition
        placeholder: t
          ? t("filters.search", {
              filter: String(colDef.header || colDef.id),
            })
          : `Filter by ${colDef.header || colDef.id}...`,
        options: (colDef as { options?: unknown }).options,
        dateDisplayPreset: resolvedDateDisplayPreset,
        dateFormat: resolvedDateFormat,
        type: colDef.type,
      };
      return option;
    });
  return options;
}

/**
 * Helper function to setup table configuration and state
 */
function useToolbarSetup(tableId: string, tableType: string) {
  const { t } = useTranslations();

  const state = useDataTable({
    tableId,
    tableType,
  }) as unknown as DataTableState;

  const { config: tableConfig } = useTableConfig(tableType);

  return { t, state, tableConfig };
}

// Extracted: setup advanced filters related memoized values
function useAdvancedFiltersSetup(
  tableType: string,
  data: unknown[],
  columnOptions: {
    [key: string]: unknown;
    id: string;
    label: string;
    canFilter?: boolean;
    dateDisplayPreset?: DateDisplayPreset;
    dateFormat?: string;
  }[],
  columnTypeMapping: Record<
    string,
    "text" | "number" | "date" | "select" | "multiSelect"
  >
) {
  const advancedColumnsConfig = useColumnsFilterConfig(
    columnOptions,
    columnTypeMapping
  );

  const accessors = useTableAccessors(
    data,
    columnOptions.map((col: unknown) =>
      String((col as Record<string, unknown>).id || "")
    )
  );

  const advancedFiltersResult = useDataTableAdvancedFilters({
    tableType,
    strategy: "client",
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
      table.store.state.columnVisibility) as VisibilityState;
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
      } catch {
        // ignore
      }
    },
    [propSetter, dataTableSetter]
  );
}

const EMPTY_DATA: never[] = [];
const EMPTY_COLUMN_TYPE_MAPPING: Record<string, never> = {};

function ToolbarCreateButton({
  actionsAsIcons,
  label,
  onClick,
}: {
  actionsAsIcons: boolean;
  label: string;
  onClick: () => void;
}) {
  if (actionsAsIcons) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-label={label}
              className="h-8 w-8"
              onClick={onClick}
              size="icon-sm"
              variant="default"
            >
              <PlusIcon className="h-4 w-4" />
            </Button>
          }
        />
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Button className="h-8" onClick={onClick} size="sm" variant="default">
      <PlusIcon className="mr-2 h-4 w-4" />
      <span>{label}</span>
    </Button>
  );
}

function ToolbarExportButton({
  actionsAsIcons,
  disabled,
  label,
  onClick,
}: {
  actionsAsIcons: boolean;
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  if (actionsAsIcons) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-label={label}
              className="h-8 w-8"
              disabled={disabled}
              onClick={onClick}
              size="icon-sm"
              type="button"
              variant="outline"
            >
              <Download className="h-4 w-4" />
            </Button>
          }
        />
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Button
      className="h-8 gap-2 px-3"
      disabled={disabled}
      onClick={onClick}
      size="sm"
      type="button"
      variant="outline"
    >
      <Download className="h-4 w-4" />
      <span>{label}</span>
    </Button>
  );
}

export function DataTableAdvancedToolbar<TData>({
  className: _className,
  hideGlobalFilter: _hideGlobalFilter,
  hideMenu: _hideMenu,
  hideViewOptions: _hideViewOptions,
  menuButtonProps: _menuButtonProps,
  table,
  viewOptions: _viewOptions,
  enableAdvancedFilters = false,
  data = EMPTY_DATA,
  columnTypeMapping = EMPTY_COLUMN_TYPE_MAPPING,
  onExport,
  toolbarActions,
  toolbarActionsPlacement = "between-create-export",
  searchDebounceMs = 300,
  ...props
}: DataTableAdvancedToolbarProps<TData>) {
  // Ensure tableId is available
  const tableId = props.tableId ?? "default";
  const tableType = props.tableType ?? tableId;
  const formType = props.formType ?? tableType;
  const filterResetVersion = useAtomValue(filterResetVersionAtom(tableId));

  // Setup configuration and state
  const { t, state, tableConfig } = useToolbarSetup(tableId, tableType);
  const [isExporting, setIsExporting] = useState(false);
  const [pendingToolbarActionIds, setPendingToolbarActionIds] = useState<
    Set<string>
  >(() => new Set());
  const pendingToolbarActionIdsRef = useRef<Set<string>>(new Set());
  const getTableActions = useProviderTableActions();
  const tableActions = useMemo(
    () => getTableActions?.(tableType),
    [getTableActions, tableType]
  );
  const selectedRows = useAtomValue(selectedRowsAtom(tableId)) as Row<
    Record<string, unknown>
  >[];
  const {
    advancedFiltersParam,
    filtersParam,
    globalSearchParam,
    orderParam,
    pageSizeParam,
    resetFilters,
    sortParam,
    visibilityParam,
  } = useTableUrlState({
    tableId,
  });

  // Advanced filters setup - create column options and configs
  const columnOptions = useMemo(
    () =>
      createColumnOptions(
        tableConfig as unknown as Record<string, unknown>,
        columnTypeMapping,
        t
      ),
    [tableConfig, columnTypeMapping, t]
  );

  const { advancedColumnsConfig, advancedFiltersResult } =
    useAdvancedFiltersSetup(tableType, data, columnOptions, columnTypeMapping);

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
    tableId,
    tableType,
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
  const getColumnIdAndLabel = (raw: Record<string, unknown>) => {
    const id =
      (raw.id as string) ||
      (raw.accessorKey as string) ||
      (typeof raw.header === "string" ? (raw.header as string) : "") ||
      "";
    const label =
      (raw.label as string) ||
      (typeof raw.header === "string" ? (raw.header as string) : "") ||
      id ||
      "Column";
    return { id, label };
  };

  const getBooleanFlag = (
    raw: Record<string, unknown>,
    key: "canFilter" | "canGroup" | "canHide" | "canSort",
    defaultValue: boolean
  ) => {
    // Special handling for sorting capability
    if (key === "canSort") {
      const id = (raw.id as string) || "";
      const meta = (raw.meta || {}) as Record<string, unknown>;
      const isSelectionColumn =
        id === "select" ||
        (meta.isSelectionColumn as boolean | undefined) === true;
      const isActionsColumn =
        id === "actions" ||
        (meta.isActionsColumn as boolean | undefined) === true;

      // Never allow sorting on selection or actions columns
      if (isSelectionColumn || isActionsColumn) {
        return false;
      }

      // Prefer explicit flags if present
      const explicitCanSort = raw.canSort as boolean | undefined;
      if (explicitCanSort !== undefined) {
        return explicitCanSort;
      }

      const enableSorting = raw.enableSorting as boolean | undefined;
      if (enableSorting !== undefined) {
        return enableSorting;
      }

      return defaultValue;
    }
    if (key === "canHide") {
      return (raw.canHide as boolean | undefined) !== false;
    }
    const value = raw[key] as boolean | undefined;
    return value === undefined ? defaultValue : value;
  };

  const getSelectionColumnLabel = () => {
    const translated = t("menu.selection_column");
    return translated === "menu.selection_column" ? "Selection" : translated;
  };

  const convertColumnForTableMenu = (col: unknown) => {
    const raw = (col || {}) as Record<string, unknown>;
    const { id, label } = getColumnIdAndLabel(raw);

    const canFilter = getBooleanFlag(raw, "canFilter", true);
    const canGroup = getBooleanFlag(raw, "canGroup", true);
    const canHide = getBooleanFlag(raw, "canHide", true);
    const canSort = getBooleanFlag(raw, "canSort", true);
    const resolvedLabel = id === "select" ? getSelectionColumnLabel() : label;

    return {
      canFilter,
      canGroup,
      canHide,
      canSort,
      id,
      label: resolvedLabel,
    };
  };

  // Convert finalColumns to the format expected by TableMenu
  const tableMenuColumns = Array.isArray(finalColumns)
    ? finalColumns.map(convertColumnForTableMenu)
    : [];

  const normalizedColumnOrder = useMemo(() => {
    return Array.isArray(orderParam) && orderParam.length > 0
      ? (orderParam as string[])
      : tableConfig.columns.order || [];
  }, [orderParam, tableConfig.columns.order]);

  const normalizedVisibility = useMemo(() => {
    const visibilityFromUrl =
      visibilityParam && typeof visibilityParam === "object"
        ? (visibilityParam as Record<string, boolean>)
        : {};

    if (Object.keys(visibilityFromUrl).length > 0) {
      return visibilityFromUrl;
    }

    return (
      (state?.columnVisibility as Record<string, boolean> | undefined) || {}
    );
  }, [visibilityParam, state?.columnVisibility]);

  const csvExportColumns = useMemo(() => {
    return buildCsvExportColumns({
      columnDefinitions: tableConfig.columns.definitions.map((definition) => ({
        header: definition.header,
        id: definition.id,
      })),
      columnOrder: normalizedColumnOrder,
      defaultVisibleColumns: tableConfig.columns.visible || [],
      visibility: normalizedVisibility,
    });
  }, [
    tableConfig.columns.definitions,
    tableConfig.columns.visible,
    normalizedColumnOrder,
    normalizedVisibility,
  ]);

  const exportLabel = useMemo(() => {
    const translated = t("actions.export");
    return translated === "actions.export" ? "Export" : translated;
  }, [t]);
  const addItemLabel = useMemo(() => {
    const translated = t("add_an_item");
    return translated === "add_an_item" ? "Add item" : translated;
  }, [t]);
  const isMobile = useIsMobile();
  const actionsAsIcons = tableConfig.table.actionsAsIcons === true || isMobile;
  const isCreateEnabled = tableConfig.table.allowCreate !== false;
  const isExportEnabled = tableConfig.table.export !== false;
  const isColumnFiltersEnabled =
    tableConfig.table.enableColumnFilters !== false;
  const isSortingEnabled = tableConfig.table.enableSorting !== false;
  const isGroupingEnabled = tableConfig.table.enableGrouping !== false;
  const createFormType = tableConfig.form?.createFormType ?? formType;
  const handleOpenCreateForm = useCallback(() => {
    if (!isCreateEnabled) {
      return;
    }

    setFormState(
      openCreateForm(
        createFormType,
        tableId,
        (_data) => {
          queryClient.invalidateQueries({
            queryKey: ["tableData", tableId],
          });
        },
        tableType
      )
    );
  }, [
    createFormType,
    isCreateEnabled,
    queryClient,
    setFormState,
    tableId,
    tableType,
  ]);

  const hasListAction = typeof tableActions?.list === "function";

  const handleExportAll = useCallback(async () => {
    if (!hasListAction || isExporting) {
      return;
    }

    const listAction = tableActions.list as TableListAction;
    const orderBy = toOrderByParam(sortParam);
    const filters = toFiltersParam(filtersParam);
    const advancedFilters = toAdvancedFiltersParam(advancedFiltersParam);
    const pageSize = toPageSize(pageSizeParam || "100");
    const normalizedSearch = globalSearchParam?.trim() || "";

    setIsExporting(true);
    try {
      const collectedRows = await fetchAllFilteredRows({
        advancedFilters,
        filters,
        listAction,
        orderBy,
        pageSize,
        search: normalizedSearch,
      });

      if (onExport) {
        await onExport(collectedRows);
        return;
      }

      const fallbackColumns =
        collectedRows.length > 0
          ? Object.keys(collectedRows[0]).map((id) => ({ id, label: id }))
          : [];

      exportRowsAsCsv({
        columns:
          csvExportColumns.length > 0 ? csvExportColumns : fallbackColumns,
        rows: collectedRows,
        tableId,
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to export rows."
      );
    } finally {
      setIsExporting(false);
    }
  }, [
    hasListAction,
    isExporting,
    tableActions,
    sortParam,
    filtersParam,
    advancedFiltersParam,
    pageSizeParam,
    globalSearchParam,
    onExport,
    csvExportColumns,
    tableId,
  ]);

  const toolbarActionContext = useMemo<ToolbarActionContext>(
    () => ({
      actionsAsIcons,
      hasListAction,
      isCreateEnabled,
      isExportEnabled,
      isExporting,
      isFooterCalculationsEnabled:
        tableConfig.table.enableCalculations === true,
      isMobile,
      selectedCount: selectedRows.length,
      selectedOriginalRows: selectedRows.map((row) => row.original),
      selectedRowIds: selectedRows.map((row) => row.id),
      selectedRows,
      tableActions,
      tableId,
      tableType,
    }),
    [
      actionsAsIcons,
      hasListAction,
      isCreateEnabled,
      isExportEnabled,
      isExporting,
      isMobile,
      selectedRows,
      tableActions,
      tableId,
      tableType,
      tableConfig.table.enableCalculations,
    ]
  );

  const resolvedToolbarActions = useMemo(
    () =>
      resolveToolbarActions({
        context: toolbarActionContext,
        toolbarActions,
      }),
    [toolbarActionContext, toolbarActions]
  );

  const toolbarActionsByPlacement = useMemo(
    () =>
      partitionToolbarActions({
        actions: resolvedToolbarActions,
        placement: toolbarActionsPlacement,
      }),
    [resolvedToolbarActions, toolbarActionsPlacement]
  );

  const setToolbarActionPending = useCallback(
    (actionId: string, isPending: boolean): boolean => {
      if (isPending) {
        if (pendingToolbarActionIdsRef.current.has(actionId)) {
          return false;
        }

        const nextPendingIds = new Set(pendingToolbarActionIdsRef.current);
        nextPendingIds.add(actionId);
        pendingToolbarActionIdsRef.current = nextPendingIds;
        setPendingToolbarActionIds(nextPendingIds);
        return true;
      }

      if (!pendingToolbarActionIdsRef.current.has(actionId)) {
        return false;
      }

      const nextPendingIds = new Set(pendingToolbarActionIdsRef.current);
      nextPendingIds.delete(actionId);
      pendingToolbarActionIdsRef.current = nextPendingIds;
      setPendingToolbarActionIds(nextPendingIds);
      return true;
    },
    []
  );

  const handleToolbarActionClick = useCallback(
    async (action: ToolbarAction) => {
      const hasStarted = setToolbarActionPending(action.id, true);
      if (!hasStarted) {
        return;
      }

      try {
        await Promise.resolve(action.onClick(toolbarActionContext));
      } finally {
        setToolbarActionPending(action.id, false);
      }
    },
    [setToolbarActionPending, toolbarActionContext]
  );

  const renderToolbarAction = useCallback(
    (action: ToolbarAction) => {
      const resolvedState = resolveToolbarActionState({
        action,
        context: toolbarActionContext,
        pendingActionIds: pendingToolbarActionIds,
      });

      if (
        !shouldRenderToolbarAction({
          actionsAsIcons,
          state: resolvedState,
        })
      ) {
        return null;
      }

      const iconContent = resolvedState.loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        action.icon
      );

      if (actionsAsIcons) {
        const iconOnlyFallback = action.label.charAt(0).toUpperCase();

        return (
          <Tooltip key={action.id}>
            <TooltipTrigger
              render={
                <Button
                  aria-label={action.label}
                  className="h-8 w-8"
                  disabled={resolvedState.disabled || resolvedState.loading}
                  onClick={() => {
                    handleToolbarActionClick(action).catch(() => {
                      /* ignore custom action errors */
                    });
                  }}
                  size="icon-sm"
                  type="button"
                  variant={resolvedState.variant}
                >
                  {iconContent || (
                    <span className="font-medium text-xs">
                      {iconOnlyFallback}
                    </span>
                  )}
                </Button>
              }
            />
            <TooltipContent>{resolvedState.tooltip}</TooltipContent>
          </Tooltip>
        );
      }

      return (
        <Button
          className="h-8 gap-2 px-3"
          disabled={resolvedState.disabled || resolvedState.loading}
          key={action.id}
          onClick={() => {
            handleToolbarActionClick(action).catch(() => {
              /* ignore custom action errors */
            });
          }}
          size="sm"
          title={action.tooltip}
          type="button"
          variant={resolvedState.variant}
        >
          {iconContent}
          <span>{action.label}</span>
        </Button>
      );
    },
    [
      actionsAsIcons,
      handleToolbarActionClick,
      pendingToolbarActionIds,
      toolbarActionContext,
    ]
  );

  if (DEBUG) {
    // Debug log for table menu columns
  }

  return (
    <TooltipProvider>
      <div
        className={
          isMobile
            ? "ml-auto flex w-full items-center justify-end gap-2"
            : "flex items-center gap-2"
        }
      >
        {isColumnFiltersEnabled && (
          <SearchBar
            debounceMs={searchDebounceMs}
            key={filterResetVersion}
            placeholder={t("search.placeholder")}
            tableId={tableId}
          />
        )}

        {toolbarActionsByPlacement.beforeCreate.map(renderToolbarAction)}

        {/* Create button */}
        {isCreateEnabled && (
          <ToolbarCreateButton
            actionsAsIcons={actionsAsIcons}
            label={addItemLabel}
            onClick={handleOpenCreateForm}
          />
        )}

        {toolbarActionsByPlacement.betweenCreateAndExport.map(
          renderToolbarAction
        )}

        {isExportEnabled && (
          <ToolbarExportButton
            actionsAsIcons={actionsAsIcons}
            disabled={!hasListAction || isExporting}
            label={exportLabel}
            onClick={() => {
              handleExportAll().catch(() => {
                /* ignore export errors */
              });
            }}
          />
        )}

        {toolbarActionsByPlacement.afterExport.map(renderToolbarAction)}

        {/* Options menu */}
        <TableMenu
          actionsAsIcons={actionsAsIcons}
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
          defaultDisplayMode={tableConfig.table.defaultDisplayMode}
          enableCalculations={tableConfig.table.enableCalculations === true}
          enableColumnFilters={isColumnFiltersEnabled}
          enableGrouping={isGroupingEnabled}
          enableSorting={isSortingEnabled}
          invalidateTable={async () => {
            await queryClient.invalidateQueries({
              queryKey: ["tableData", tableId],
            });
          }}
          setColumnFilters={finalSetColumnFilters}
          setColumnVisibility={finalSetColumnVisibility}
          setGrouping={finalSetGrouping}
          setSorting={finalSetSorting}
          state={{
            columnFilters: finalColumnFilters as ColumnFiltersState,
            columnOrder: [],
            columnPinning: { end: [], start: [] },
            columnSizing: {} as ColumnSizingState,
            columnResizing: {
              columnSizingStart: [],
              deltaOffset: null,
              deltaPercentage: null,
              isResizingColumn: false,
              startOffset: null,
              startSize: null,
            },
            columnVisibility: finalColumnVisibility as VisibilityState,
            expanded: {},
            globalFilter: "",
            grouping: finalGrouping as GroupingState,
            pagination: { pageIndex: 0, pageSize: 10 },
            rowSelection: {},
            sorting: finalSorting as SortingState,
          }}
          tableId={tableId}
          tableType={tableType}
          useAdvancedFilters={enableAdvancedFilters}
        />
        {[
          tableConfig.table.showResetFilters,
          tableConfig.table.showClearFilters,
        ].includes(true) && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  aria-label={t("filters.clear")}
                  className="h-8 w-8 shrink-0"
                  onClick={resetFilters}
                  size="icon-sm"
                  type="button"
                  variant="outline"
                >
                  <RotateCcw aria-hidden="true" className="h-4 w-4" />
                </Button>
              }
            />
            <TooltipContent>{t("filters.clear")}</TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
