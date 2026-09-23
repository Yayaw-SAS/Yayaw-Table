"use client";

/**
 * Advanced toolbar component for DataTable
 * Provides advanced filtering, view management, and other table controls
 */

import { useQueryClient } from "@tanstack/react-query";
import { useAtomValue, useSetAtom } from "jotai";
import {
  Download,
  FunnelX,
  Link2,
  Loader2,
  Plug,
  PlusIcon,
  Send,
  Share2,
} from "lucide-react";
import {
  type ComponentProps,
  type ReactNode,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
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
import { useTableConfig } from "../../hooks/use-table-config";
import { useTableInstance } from "../../hooks/use-table-instance";
import { useTableUrlState } from "../../hooks/use-table-url-state";
import { useToolbarLayout } from "../../hooks/use-toolbar-layout";
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
import type { TableDisplayMode } from "../../types/display-types";
import { StackMenuContent, StackMenuItem } from "../../ui-custom/stack-menu";
import { buildCsvExportColumns } from "../../utils/csv-export";
import {
  type DataDestination,
  dataDestinationQuery,
  groupDataDestinations,
  runDataDestination,
} from "../../utils/data-destinations";
import {
  availableExportFormats,
  defaultExportFileName,
  downloadExportFile,
  type ExportColumn,
  type ExportSettings,
  printExportPage,
  runExport,
} from "../../utils/export-model";
import {
  fetchAllFilteredRows,
  type TableListAction,
  toAdvancedFiltersParam,
  toFiltersParam,
  toOrderByParam,
  toPageSize,
} from "../../utils/filtered-rows";
import { TableTooltip } from "../../utils/table-tooltip";
import { sharePageUrl } from "../../utils/view-menu";
import { TableFilterBar } from "../filters/table-filter-bar";
import {
  catalogueFormAtom,
  openCreateForm,
} from "../forms/atoms/catalogue-form-atoms";
import { ExportPanel } from "./export-panel";
import { useMobileSettingsScreens } from "./mobile-settings-screens";
import { SearchBar } from "./sections/search-bar";
import { TableDataMenu } from "./table-data-menu";
import { TableDensityMenu } from "./table-density-menu";
import { TableMenu } from "./table-menu";
import { DataTableViewManager } from "./table-view-manager";
import {
  partitionToolbarActions,
  resolveToolbarActionState,
  resolveToolbarActions,
  shouldRenderToolbarAction,
} from "./toolbar-actions";

// Debug flag to help track issues - activated for debugging

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
  viewManagerProps?: Partial<
    Pick<
      ComponentProps<typeof DataTableViewManager>,
      | "enabled"
      | "allowViewSave"
      | "allowViewSharing"
      | "defaultDensity"
      | "defaultDisplayMode"
      | "initialViews"
      | "initialActiveViewId"
      | "displayModes"
      | "tabs"
    >
  >;
  quickFiltersVisible?: boolean;
  modeSettings?: ReactNode;
  cardSettings?: Partial<Record<TableDisplayMode, ReactNode>>;
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

  const { state } = useDataTable({
    tableId,
    tableType,
  });

  const { config: tableConfig } = useTableConfig(tableType);

  return { t, state, tableConfig };
}

// Extracted: setup advanced filters related memoized values
function useAdvancedFiltersSetup(
  tableType: string,
  tableId: string,
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
    tableId,
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
              <PlusIcon className="size-4" />
            </Button>
          }
        />
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Button
      className="h-8 font-normal text-xs leading-4"
      onClick={onClick}
      size="sm"
      variant="default"
    >
      <PlusIcon className="mr-2 size-4" />
      <span>{label}</span>
    </Button>
  );
}

function createPageShareHandler(
  nativeMobile: boolean,
  t: ReturnType<typeof useTranslations>["t"]
) {
  return async () => {
    try {
      const result = await sharePageUrl(window.location.href, nativeMobile);
      if (result === "copied") {
        toast.success(t("url_state.link_copied"));
      }
    } catch {
      toast.error(t("actions.shareError"));
    }
  };
}

/** Search, application actions (wide screens), settings and create, on the right. */
function ToolbarEnd({
  applicationActions,
  createButton,
  dataMenu,
  isMobile,
  renderToolbarAction,
  search,
  settingsMenu,
}: {
  applicationActions: {
    beforeCreate: ToolbarAction[];
    betweenCreateAndExport: ToolbarAction[];
    afterExport: ToolbarAction[];
  };
  createButton: ReactNode;
  isMobile: boolean;
  renderToolbarAction: (action: ToolbarAction) => ReactNode;
  dataMenu: ReactNode;
  search: {
    enabled: boolean;
    hidden?: boolean;
    debounceMs?: number;
    placeholder: string;
    resetVersion: number;
    tableId: string;
  };
  settingsMenu: ReactNode;
}) {
  return (
    <div
      className={cn(
        "ml-auto flex shrink-0 items-center gap-2",
        isMobile && "flex-1 justify-end [&>button]:size-11"
      )}
    >
      {search.enabled && !search.hidden ? (
        <SearchBar
          alwaysExpanded={!isMobile}
          debounceMs={search.debounceMs}
          key={search.resetVersion}
          placeholder={search.placeholder}
          tableId={search.tableId}
        />
      ) : null}
      {isMobile
        ? null
        : [
            ...applicationActions.beforeCreate,
            ...applicationActions.betweenCreateAndExport,
            ...applicationActions.afterExport,
          ].map(renderToolbarAction)}
      {settingsMenu}
      {dataMenu}
      {createButton}
    </div>
  );
}

type TableDataDestination = DataDestination<ReactNode>;

/** The built-in "copy the link to this view" entry. */
function renderShareLinkItem(
  enabled: boolean,
  onShare: () => Promise<void>,
  label: string
) {
  if (!enabled) {
    return null;
  }
  return (
    <StackMenuItem
      icon={<Link2 className="size-4" />}
      onClick={() => {
        onShare().catch(() => {
          /* share errors are reported by the handler */
        });
      }}
    >
      {label}
    </StackMenuItem>
  );
}

/** Sync and Share screens: the host destinations, after the share link. */
function destinationScreens({
  destinations,
  isShareEnabled,
  onDestination,
  onShare,
  pendingDestination,
  t,
}: {
  destinations: Record<"connect" | "share", TableDataDestination[]>;
  isShareEnabled: boolean;
  onDestination: (destination: TableDataDestination) => Promise<void>;
  onShare: () => Promise<void>;
  pendingDestination?: string;
  t: ReturnType<typeof useTranslations>["t"];
}) {
  const item = (destination: TableDataDestination) =>
    renderDestinationItem(destination, pendingDestination, onDestination);
  const screens: { name: string; title: string; content: ReactNode }[] = [];
  if (destinations.connect.length > 0) {
    screens.push({
      name: "connect",
      title: t("destinations.connect"),
      content: (
        <StackMenuContent>{destinations.connect.map(item)}</StackMenuContent>
      ),
    });
  }
  if (destinations.share.length > 0) {
    screens.push({
      name: "share",
      title: t("url_state.share"),
      content: (
        <StackMenuContent>
          {renderShareLinkItem(
            isShareEnabled,
            onShare,
            t("destinations.copyLink")
          )}
          {destinations.share.map(item)}
        </StackMenuContent>
      ),
    });
  }
  return screens;
}

/** A host destination; one runs at a time and shows its progress. */
function renderDestinationItem(
  destination: TableDataDestination,
  pendingDestination: string | undefined,
  onDestination: (destination: TableDataDestination) => Promise<void>
) {
  const running = pendingDestination === destination.id;
  return (
    <StackMenuItem
      aria-busy={running}
      disabled={Boolean(pendingDestination)}
      icon={
        running ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          (destination.icon ?? <Send className="size-4" />)
        )
      }
      key={destination.id}
      onClick={() => {
        onDestination(destination).catch(() => {
          /* failures are reported by the runner */
        });
      }}
    >
      {destination.label}
    </StackMenuItem>
  );
}

/** Export, share and, on touch layouts, application actions as settings entries. */
function renderMenuDataActions({
  t,
  isMobile,
  toolbarActions,
  toolbarActionContext,
  pendingToolbarActionIds,
  onToolbarAction,
  isExportEnabled,
  isExporting,
  exportLabel,
  exportScreen,
  onShare,
  isShareEnabled,
  destinations,
  pendingDestination,
}: {
  isShareEnabled: boolean;
  destinations: Record<"connect" | "share", TableDataDestination[]>;
  pendingDestination?: string;
  t: ReturnType<typeof useTranslations>["t"];
  isMobile: boolean;
  toolbarActions: ToolbarAction[];
  toolbarActionContext: Parameters<
    typeof resolveToolbarActionState
  >[0]["context"];
  pendingToolbarActionIds: Parameters<
    typeof resolveToolbarActionState
  >[0]["pendingActionIds"];
  onToolbarAction: (action: ToolbarAction) => Promise<void>;
  isExportEnabled: boolean;
  isExporting: boolean;
  exportLabel: string;
  /** The export options screen the Export entry opens. */
  exportScreen: string;
  onShare: () => Promise<void>;
}) {
  const applicationActions = isMobile
    ? toolbarActions.flatMap((action) => {
        const state = resolveToolbarActionState({
          action,
          context: toolbarActionContext,
          pendingActionIds: pendingToolbarActionIds,
        });
        if (!shouldRenderToolbarAction({ actionsAsIcons: false, state })) {
          return [];
        }
        return [
          <StackMenuItem
            disabled={state.disabled || state.loading}
            icon={
              state.loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                action.icon
              )
            }
            key={action.id}
            onClick={() => {
              onToolbarAction(action).catch(() => {
                /* ignore custom action errors */
              });
            }}
          >
            {action.label}
          </StackMenuItem>,
        ];
      })
    : [];
  return (
    <>
      {applicationActions}
      {isExportEnabled ? (
        <StackMenuItem
          aria-busy={isExporting}
          icon={
            isExporting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )
          }
          navigateTitle={exportLabel}
          navigateTo={exportScreen}
        >
          {exportLabel}
        </StackMenuItem>
      ) : null}
      {destinations.connect.length > 0 ? (
        <StackMenuItem
          aria-busy={Boolean(pendingDestination)}
          icon={<Plug className="size-4" />}
          navigateTitle={t("destinations.connect")}
          navigateTo="connect"
        >
          {t("destinations.connect")}
        </StackMenuItem>
      ) : null}
      {destinations.share.length > 0 ? (
        <StackMenuItem
          icon={<Share2 className="size-4" />}
          navigateTitle={t("url_state.share")}
          navigateTo="share"
        >
          {t("url_state.share")}
        </StackMenuItem>
      ) : (
        renderShareLinkItem(isShareEnabled, onShare, t("url_state.share"))
      )}
    </>
  );
}

export function DataTableAdvancedToolbar<TData>({
  viewManagerProps,
  quickFiltersVisible,
  modeSettings,
  cardSettings,
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
    displayModeParam,
    filtersParam,
    globalSearchParam,
    orderParam,
    pageSizeParam,
    resetFilters,
    sortParam,
    viewParam,
    visibilityParam,
  } = useTableUrlState({
    defaultGantt: tableConfig.table.gantt,
    defaultDisplayMode: tableConfig.table.defaultDisplayMode,
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
    useAdvancedFiltersSetup(
      tableType,
      tableId,
      data,
      columnOptions,
      columnTypeMapping
    );

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
    publishSelection: false,
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
  const {
    compact: isMobile,
    root: toolbarRoot,
    mobile: nativeMobile,
  } = useToolbarLayout(tableId);
  const actionsAsIcons = tableConfig.table.actionsAsIcons === true && !isMobile;
  // A create button needs somewhere to save, as in Vue.
  const isCreateEnabled =
    tableConfig.table.allowCreate !== false &&
    typeof tableActions?.create === "function";
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

  const [pendingDestination, setPendingDestination] = useState<string>();
  // Every record matching the view's query, for destinations that need rows.
  const loadMatchingRows = useCallback(async () => {
    if (!hasListAction) {
      return data ?? [];
    }
    return await fetchAllFilteredRows({
      advancedFilters: toAdvancedFiltersParam(advancedFiltersParam),
      filters: toFiltersParam(filtersParam),
      listAction: tableActions?.list as TableListAction,
      orderBy: toOrderByParam(sortParam),
      pageSize: toPageSize(pageSizeParam || "100"),
      search: globalSearchParam?.trim() || "",
    });
  }, [
    advancedFiltersParam,
    data,
    filtersParam,
    globalSearchParam,
    hasListAction,
    pageSizeParam,
    sortParam,
    tableActions?.list,
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
        <Loader2 className="size-4 animate-spin" />
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
        <TableTooltip key={action.id} label={action.tooltip ?? action.label}>
          <Button
            className="h-8 gap-2 px-3 font-normal text-xs leading-4"
            disabled={resolvedState.disabled || resolvedState.loading}
            onClick={() => {
              handleToolbarActionClick(action).catch(() => {
                /* ignore custom action errors */
              });
            }}
            size="sm"
            type="button"
            variant={resolvedState.variant}
          >
            {iconContent}
            <span>{action.label}</span>
          </Button>
        </TableTooltip>
      );
    },
    [
      actionsAsIcons,
      handleToolbarActionClick,
      pendingToolbarActionIds,
      toolbarActionContext,
    ]
  );

  const runDestination = useCallback(
    async (destination: TableDataDestination) => {
      if (pendingDestination) {
        return;
      }
      setPendingDestination(destination.id);
      const result = await runDataDestination(destination, {
        tableId,
        tableType,
        viewId: viewParam ?? null,
        query: dataDestinationQuery({
          search: globalSearchParam,
          filters: toFiltersParam(filtersParam),
          advancedFilters: advancedFiltersParam,
          sorting: sortParam as { id: string; desc?: boolean }[],
        }),
        columns: csvExportColumns.map((column) => ({
          id: column.id,
          header: column.label,
        })),
        selectedRowIds: toolbarActionContext.selectedRowIds,
        url: window.location.href,
        loadRows: loadMatchingRows,
      });
      setPendingDestination(undefined);
      if (result.ok) {
        toast.success(result.message ?? t("destinations.done"));
      } else {
        toast.error(result.error);
      }
    },
    [
      advancedFiltersParam,
      csvExportColumns,
      filtersParam,
      globalSearchParam,
      loadMatchingRows,
      pendingDestination,
      sortParam,
      t,
      tableId,
      tableType,
      toolbarActionContext.selectedRowIds,
      viewParam,
    ]
  );
  const { locale } = useTranslations();
  const tableTitle = tableConfig.translations?.keys?.title ?? tableType;
  const exportColumnsFor = useCallback(
    (ids?: string[]): ExportColumn[] => {
      const byId = new Map(
        tableConfig.columns.definitions.map((column) => [column.id, column])
      );
      const pick = ids ?? tableConfig.columns.definitions.map((c) => c.id);
      return pick.flatMap((columnId) => {
        const column = byId.get(columnId);
        if (!column || columnId === "select" || columnId === "actions") {
          return [];
        }
        return [
          {
            id: column.id,
            header: column.header,
            type: column.type,
            options: (column as { options?: unknown }).options,
            numberFormat: column.numberFormat,
            dateDisplayPreset: column.dateDisplayPreset,
            dateFormat: column.dateFormat,
            timeZone: (column as { timeZone?: string }).timeZone,
          },
        ];
      });
    },
    [tableConfig.columns.definitions]
  );
  // Server first through `actions.exportFile`; otherwise CSV or print here.
  const handleExport = useCallback(
    async (settings: ExportSettings) => {
      if (isExporting) {
        return;
      }
      setIsExporting(true);
      try {
        await runExport({
          settings,
          viewId: viewParam ?? null,
          query: dataDestinationQuery({
            search: globalSearchParam,
            filters: toFiltersParam(filtersParam),
            advancedFilters: advancedFiltersParam,
            sorting: sortParam as { id: string; desc?: boolean }[],
          }),
          allColumns: exportColumnsFor(),
          visibleColumns: exportColumnsFor(
            csvExportColumns.map((column) => column.id)
          ),
          selectedRowIds: toolbarActionContext.selectedRowIds,
          selectedRows: toolbarActionContext.selectedOriginalRows,
          loadRows: loadMatchingRows,
          locale,
          title: tableTitle,
          exportFile: tableActions?.exportFile,
          onRows: onExport,
          download: downloadExportFile,
          print: printExportPage,
        });
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to export rows."
        );
      } finally {
        setIsExporting(false);
      }
    },
    [
      advancedFiltersParam,
      csvExportColumns,
      exportColumnsFor,
      filtersParam,
      globalSearchParam,
      isExporting,
      loadMatchingRows,
      locale,
      onExport,
      sortParam,
      tableActions?.exportFile,
      tableTitle,
      toolbarActionContext.selectedOriginalRows,
      toolbarActionContext.selectedRowIds,
      viewParam,
    ]
  );
  const shareLink = createPageShareHandler(nativeMobile, t);
  const destinationGroups = groupDataDestinations(
    tableActions?.destinations,
    toolbarActionContext.selectedRowIds.length
  );
  const menuDataActions = renderMenuDataActions({
    t,
    isMobile,
    toolbarActions: [
      ...toolbarActionsByPlacement.beforeCreate,
      ...toolbarActionsByPlacement.betweenCreateAndExport,
      ...toolbarActionsByPlacement.afterExport,
    ],
    toolbarActionContext,
    pendingToolbarActionIds,
    onToolbarAction: handleToolbarActionClick,
    isExportEnabled,
    isExporting,
    exportLabel,
    exportScreen: "export",
    onShare: shareLink,
    isShareEnabled: tableConfig.table.share !== false,
    destinations: destinationGroups,
    pendingDestination,
  });
  const createButton = isCreateEnabled ? (
    <ToolbarCreateButton
      actionsAsIcons={isMobile || actionsAsIcons}
      label={addItemLabel}
      onClick={handleOpenCreateForm}
    />
  ) : null;
  const mobileScreens = useMobileSettingsScreens({
    enabled: isMobile,
    defaultDensity: tableConfig.table.density,
    defaultDisplayMode: tableConfig.table.defaultDisplayMode,
    displayModes: viewManagerProps?.displayModes,
    tableId,
  });
  const dataScreens = [
    ...destinationScreens({
      destinations: destinationGroups,
      isShareEnabled: tableConfig.table.share !== false,
      onDestination: runDestination,
      onShare: shareLink,
      pendingDestination,
      t,
    }),
    ...(isExportEnabled
      ? [
          {
            name: "export",
            title: exportLabel,
            content: (
              <ExportPanel
                busy={isExporting}
                defaultFileName={defaultExportFileName(tableTitle)}
                formats={availableExportFormats(
                  tableConfig.table.exportFormats,
                  Boolean(tableActions?.exportFile)
                )}
                label={(key, fallback) => {
                  const translated = t(`exportScreen.${key}`);
                  return translated === `exportScreen.${key}`
                    ? fallback
                    : translated;
                }}
                onExport={handleExport}
                selectedCount={toolbarActionContext.selectedRowIds.length}
              />
            ),
          },
        ]
      : []),
  ];
  // A render function keeps the menu's option conditions out of the toolbar body.
  const renderSettingsMenu = () => (
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
      cardSettings={
        cardSettings?.[displayModeParam as keyof typeof cardSettings]
      }
      columns={tableMenuColumns}
      compact={isMobile}
      defaultDisplayMode={tableConfig.table.defaultDisplayMode}
      enableCalculations={tableConfig.table.enableCalculations === true}
      enableColumnFilters={isColumnFiltersEnabled}
      enableGrouping={isGroupingEnabled}
      enableSorting={isSortingEnabled}
      filterExtras={
        <div className="space-y-2 p-2">
          {isMobile ? (
            <TableFilterBar
              inMenu
              tableId={tableId}
              tableType={tableType}
              visible={
                quickFiltersVisible ?? tableConfig.table.showFilterBar === true
              }
            />
          ) : null}
          {[
            tableConfig.table.showResetFilters,
            tableConfig.table.showClearFilters,
          ].includes(true) ? (
            <Button onClick={resetFilters} type="button" variant="ghost">
              <FunnelX className="size-4" />
              {t("filters.clear")}
            </Button>
          ) : null}
        </div>
      }
      invalidateTable={async () => {
        await queryClient.invalidateQueries({
          queryKey: ["tableData", tableId],
        });
      }}
      modeSettings={
        mobileScreens ? undefined : (
          <div className="space-y-2 px-2 py-2">
            {modeSettings}
            <TableDensityMenu
              defaultDensity={tableConfig.table.density}
              defaultDisplayMode={tableConfig.table.defaultDisplayMode}
              inline
              tableId={tableId}
            />
          </div>
        )
      }
      screens={mobileScreens}
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
  );
  const defaultViewConfig = {
    // An inactive Kanban lane default must not group the initial table view.
    grouping: [],
    density: tableConfig.table.density,
    displayMode: tableConfig.table.defaultDisplayMode ?? ("table" as const),
    footerCalculationsVisible: true,
    pageSize: tableConfig.table.defaultPageSize,
    sorting: tableConfig.columns.sort,
    columnOrder: tableConfig.columns.order,
    columnVisibility: Object.fromEntries(
      tableConfig.columns.definitions.map((column) => [
        column.id,
        tableConfig.columns.visible?.includes(column.id) ?? true,
      ])
    ),
    kanban: tableConfig.table.kanban,
    gallery: tableConfig.table.gallery,
    list: tableConfig.table.list,
    gantt: tableConfig.table.gantt,
  };
  return (
    <TooltipProvider>
      <div
        className={
          isMobile
            ? "flex w-full min-w-0 items-center gap-2 [&>button]:size-11"
            : "flex w-full min-w-0 items-center gap-2"
        }
        data-compact={isMobile}
        data-table-toolbar
        ref={toolbarRoot}
      >
        <DataTableViewManager
          allowViewSave={tableConfig.table.allowViewSave}
          allowViewSharing={tableConfig.table.allowViewSharing}
          defaultDensity={tableConfig.table.density}
          defaultDisplayMode={tableConfig.table.defaultDisplayMode}
          enabled={tableConfig.table.enableViews !== false}
          tabs={tableConfig.table.viewTabs}
          {...viewManagerProps}
          compact={isMobile}
          defaultViewConfig={defaultViewConfig}
          tableId={tableId}
          tableType={tableType}
        />
        <ToolbarEnd
          applicationActions={toolbarActionsByPlacement}
          createButton={createButton}
          dataMenu={
            <TableDataMenu
              compact={isMobile}
              label={t("menu.data")}
              rows={menuDataActions}
              screens={dataScreens}
              tableId={tableId}
            />
          }
          isMobile={isMobile}
          renderToolbarAction={renderToolbarAction}
          search={{
            enabled: isColumnFiltersEnabled,
            hidden: _hideGlobalFilter,
            debounceMs: searchDebounceMs,
            placeholder: t("search.placeholder"),
            resetVersion: filterResetVersion,
            tableId,
          }}
          settingsMenu={renderSettingsMenu()}
        />
      </div>
    </TooltipProvider>
  );
}
