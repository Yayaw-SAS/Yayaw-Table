"use client";
import {
  type GenericModeViewConfigs,
  modeDefaultsOf,
  pickGenericModeConfigs,
  withoutDisabledModeRenderers,
} from "../utils/display-modes";
import { planningLabelOverrides } from "../planning/labels";
import { PlanningSurface, usePlanningState } from "../planning/react";
/**
 * New DataTable component using the declarative architecture
 * This component replaces the old DataTable with a more streamlined API
 */

import { createStore, Provider as JotaiProvider, useAtomValue } from "jotai";
import type React from "react";
import type { ReactNode } from "react";
// Import advanced filters hook directly
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import type { Row } from "@/components/ui/yayaw-table/tanstack";
import type { TableEmptyStateConfig } from "../config/helpers";
import { useAutoPageSizeLifetime } from "../hooks/use-auto-page-size";
import type {
  BulkActionCustomHandlerResult,
  BulkDeleteCustomHandlerResult,
} from "../hooks/use-bulk-actions";
import { useDataTable } from "../hooks/use-data-table";
import type {
  TableCatalogueColumnConfig,
  TableCatalogueConfig,
} from "../hooks/use-table-config";
import { DataTableUIProvider } from "../providers/data-table-ui-provider";
import {
  defaultTranslations,
  TableProvider,
  useTableActions,
  useTableComponents,
  useTranslations,
} from "../providers/table-provider";
import {
  TableInstanceProvider,
  TableStateSyncProvider,
} from "../providers/table-state-sync-provider";
import { seedTableViewState } from "../hooks/use-table-url-state";
import { withFeedRenderer } from "../feed/feed-renderer";
import { withFormRenderer } from "../form/form-renderer";
import { isFormModeEnabled } from "../utils/form-view";
import { resolveTranslationsToUiStrings } from "../providers/translation-cache";
import type { TableGanttViewConfig } from "../planning/types";
import type {
  TableDisplayMode,
  TableGalleryConfig,
  TableListConfig,
  TableKanbanConfig,
} from "../types/display-types";
import type {
  ToolbarActionsInput,
  ToolbarActionsPlacement,
} from "../types/toolbar-types";
import type { DataTableTranslations } from "../types/translations";
import type { DisplayModeRenderers } from "../types/display-mode-renderer";
import type { TableView, TableViewConfig } from "../types/view-types";
import type {
  DetailRevertHandler,
  RecordDetailsConfig,
} from "../utils/record-details";
import { availableDisplayModes } from "../utils/view-menu";
import type { CustomBulkActionsInput } from "./bulk-actions";
import type { ActionItem } from "./columns/actions-column";
import { DataTableSkeleton } from "./data-table-skeleton";
import { TableRecordDetails } from "./details/table-record-details";
// Direct import keeps the toolbar available without a client-only dynamic wrapper.
import { TableFilterBar } from "./filters/table-filter-bar";
// Lazy load heavy components using React.lazy inside './forms/lazy-forms'
import { catalogueFormAtom } from "./forms/atoms/catalogue-form-atoms";
import { LazyCatalogueFormContainer as CatalogueFormContainer } from "./forms/lazy-forms";
// Import DataTableClient directly for better SSR compatibility
import { TableComponent as DataTableClient } from "./table-component";
import { DataTableAdvancedToolbar } from "./toolbar/data-table-advanced-toolbar";
import { TableDisplayModeSwitcher } from "./toolbar/table-display-mode-switcher";
import { TableGalleryMenu } from "./toolbar/table-gallery-menu";
import { TableListMenu } from "./toolbar/table-list-menu";
import { TableRendererSettings } from "./toolbar/table-renderer-settings";
import { TableGanttSettings } from "./toolbar/table-gantt-settings";
import { TableKanbanGroupingMenu } from "./toolbar/table-kanban-grouping-menu";

// Default UI components
function DefaultTableTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2 className={`font-semibold text-foreground text-xl ${className || ""}`}>
      {children}
    </h2>
  );
}

function DefaultTableDescription({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={`text-muted-foreground text-sm ${className || ""}`}>
      {children}
    </p>
  );
}

// Helper hook for creating column options (removed as unused)

// Hook removed - advanced filters are now handled directly in DataTableAdvancedToolbar

const EMPTY_COLUMN_TYPE_MAPPING: Record<string, never> = {};
const KANBAN_GROUPING_SYSTEM_COLUMNS = new Set(["actions", "select"]);
const GALLERY_SYSTEM_COLUMNS = new Set(["actions", "select"]);

interface KanbanGroupingColumn {
  id: string;
  label: string;
  type?: string;
}

interface KanbanGroupingColumnDefinition {
  enableGrouping?: boolean;
  header: string;
  id: string;
  type?: string;
}

interface GalleryControlColumn {
  id: string;
  label: string;
  type?: string;
}

interface GalleryControlColumnDefinition {
  header: string;
  id: string;
  type?: string;
}

function getKanbanGroupingColumns(
  definitions: KanbanGroupingColumnDefinition[]
): KanbanGroupingColumn[] {
  return definitions
    .filter(
      (column) =>
        !KANBAN_GROUPING_SYSTEM_COLUMNS.has(column.id) &&
        column.enableGrouping !== false
    )
    .map((column) => ({
      id: column.id,
      label: column.header,
      type: column.type || "text",
    }));
}

function shouldShowKanbanGroupingControl({
  displayModes,
  enableGrouping,
  groupingColumnsCount,
}: {
  displayModes?: TableDisplayMode[];
  enableGrouping?: boolean;
  groupingColumnsCount: number;
}): boolean {
  return (
    enableGrouping !== false &&
    (displayModes ?? ["table"]).includes("kanban") &&
    groupingColumnsCount > 0
  );
}

function getGalleryControlColumns(
  definitions: GalleryControlColumnDefinition[]
): GalleryControlColumn[] {
  return definitions
    .filter((column) => !GALLERY_SYSTEM_COLUMNS.has(column.id))
    .map((column) => ({
      id: column.id,
      label: column.header,
      type: column.type || "text",
    }));
}

function shouldShowGalleryControl({
  columnsCount,
  displayModes,
}: {
  columnsCount: number;
  displayModes?: TableDisplayMode[];
}): boolean {
  return (displayModes ?? ["table"]).includes("gallery") && columnsCount > 0;
}

function resolveToolbarRuntime({
  config,
  enableAdvancedFilters,
  searchDebounceMs,
  toolbarActions,
  toolbarActionsPlacement,
}: {
  config: TableCatalogueConfig;
  enableAdvancedFilters?: boolean;
  searchDebounceMs?: number;
  toolbarActions?: ToolbarActionsInput;
  toolbarActionsPlacement?: ToolbarActionsPlacement;
}) {
  return {
    resolvedSearchDebounceMs:
      searchDebounceMs ?? config.table.searchDebounceMs ?? 300,
    resolvedToolbarActions: toolbarActions ?? config.toolbarActions,
    resolvedToolbarActionsPlacement:
      toolbarActionsPlacement ??
      config.toolbarActionsPlacement ??
      "between-create-export",
    shouldEnableAdvancedFilters:
      enableAdvancedFilters ?? config.table.enableAdvancedFilters ?? false,
  } as const;
}

function resolveDataTableHeaderContent({
  configDescription,
  configTitle,
  description,
  tableType,
  title,
  translations,
}: {
  configDescription?: string;
  configTitle?: string;
  description?: string;
  tableType: string;
  title?: string;
  translations?: DataTableTranslations;
}) {
  const translationText = translations as
    | (DataTableTranslations & { description?: string; title?: string })
    | undefined;

  return {
    displayDescription:
      description ||
      translationText?.description ||
      configDescription ||
      `Manage your ${tableType}`,
    displayTitle:
      title || translationText?.title || configTitle || `${tableType} Table`,
  };
}

/** The UI provider's `form` is the create form; the Form mode reads `table.form` itself. On/off flags such as `chart: true` are not settings. */
function uiModeDefaults(table: object) {
  return Object.fromEntries(
    Object.entries(pickGenericModeConfigs(table)).filter(
      ([key, value]) =>
        key !== "form" && Boolean(value) && typeof value === "object"
    )
  ) as Omit<GenericModeViewConfigs, "form">;
}

/** View → Card settings of modes rendered by optional registry items. */
function rendererSettings({
  columns,
  defaultDisplayMode,
  defaults,
  displayModes,
  renderers,
  tableId,
}: {
  columns: TableCatalogueColumnConfig[];
  defaultDisplayMode?: TableDisplayMode;
  defaults: object;
  displayModes?: TableDisplayMode[];
  renderers?: DisplayModeRenderers;
  tableId: string;
}): Partial<Record<TableDisplayMode, ReactNode>> {
  const settings: Partial<Record<TableDisplayMode, ReactNode>> = {};
  for (const mode of displayModes ?? []) {
    const renderer = renderers?.[mode];
    if (renderer?.Settings) {
      settings[mode] = (
        <TableRendererSettings
          columns={columns}
          defaultDisplayMode={defaultDisplayMode}
          defaults={modeDefaultsOf(defaults, mode)}
          mode={mode}
          renderer={renderer}
          tableId={tableId}
        />
      );
    }
  }
  return settings;
}

function DataTableHeaderControls({
  defaultDensity,
  allowViewSave,
  allowViewSharing,
  baseData,
  columnTypeMapping,
  defaultDisplayMode,
  defaultFormType,
  displayModes,
  displayModeRenderers,
  rendererColumns,
  rendererDefaults,
  enableKanbanGrouping,
  enableGalleryControl,
  enableAdvancedFilters,
  searchDebounceMs,
  galleryColumns,
  galleryConfig,
  ganttConfig,
  initialActiveViewId,
  listConfig,
  initialViews,
  kanbanConfig,
  kanbanControlColumns,
  kanbanDefaultGroupBy,
  kanbanGroupingColumns,
  onExport,
  shouldShowViewControls: _shouldShowViewControls,
  shouldShowViews,
  quickFiltersVisible,
  tableId,
  tableType,
  toolbarActions,
  toolbarActionsPlacement,
}: {
  allowViewSave?: boolean;
  allowViewSharing?: boolean;
  baseData: Record<string, unknown>[];
  columnTypeMapping: Record<
    string,
    "date" | "multiSelect" | "number" | "select" | "text"
  >;
  defaultDisplayMode?: TableDisplayMode;
  defaultDensity?: TableView["config"]["density"];
  defaultFormType: string;
  displayModes?: TableDisplayMode[];
  displayModeRenderers?: DisplayModeRenderers;
  rendererColumns: TableCatalogueColumnConfig[];
  rendererDefaults: object;
  enableKanbanGrouping: boolean;
  enableGalleryControl: boolean;
  enableAdvancedFilters: boolean;
  searchDebounceMs: number;
  galleryColumns: GalleryControlColumn[];
  galleryConfig?: TableGalleryConfig;
  ganttConfig?: TableGanttViewConfig;
  listConfig?: TableListConfig;
  initialActiveViewId?: string;
  initialViews?: TableView[];
  kanbanConfig?: TableKanbanConfig;
  kanbanControlColumns: KanbanGroupingColumn[];
  kanbanDefaultGroupBy?: string;
  kanbanGroupingColumns: KanbanGroupingColumn[];
  onExport?: (rows: Record<string, unknown>[]) => Promise<void> | void;
  shouldShowViewControls: boolean;
  shouldShowViews: boolean;
  quickFiltersVisible: boolean;
  tableId: string;
  tableType: string;
  toolbarActions?: ToolbarActionsInput;
  toolbarActionsPlacement: ToolbarActionsPlacement;
}) {
  return (
    <DataTableAdvancedToolbar
      cardSettings={{
        kanban: enableKanbanGrouping ? (
          <TableKanbanGroupingMenu
            columns={kanbanGroupingColumns}
            controlColumns={kanbanControlColumns}
            defaultConfig={kanbanConfig}
            defaultDisplayMode={defaultDisplayMode}
            defaultGroupBy={kanbanDefaultGroupBy}
            embedded
            tableId={tableId}
          />
        ) : undefined,
        gallery: enableGalleryControl ? (
          <TableGalleryMenu
            columns={galleryColumns}
            defaultConfig={galleryConfig}
            defaultDisplayMode={defaultDisplayMode}
            embedded
            tableId={tableId}
          />
        ) : undefined,
        list: (displayModes ?? []).includes("list") ? (
          <TableListMenu
            columns={galleryColumns}
            defaultConfig={listConfig}
            defaultDisplayMode={defaultDisplayMode}
            tableId={tableId}
          />
        ) : undefined,
        gantt: (displayModes ?? []).includes("gantt") ? (
          <TableGanttSettings
            defaultConfig={ganttConfig}
            defaultDisplayMode={defaultDisplayMode}
            tableId={tableId}
          />
        ) : undefined,
        ...rendererSettings({
          columns: rendererColumns,
          defaultDisplayMode,
          defaults: rendererDefaults,
          displayModes,
          renderers: displayModeRenderers,
          tableId,
        }),
      }}
      columnTypeMapping={columnTypeMapping}
      data={baseData}
      enableAdvancedFilters={enableAdvancedFilters}
      formType={defaultFormType}
      modeSettings={
        <TableDisplayModeSwitcher
          defaultDisplayMode={defaultDisplayMode}
          displayModes={displayModes}
          tableId={tableId}
        />
      }
      onExport={onExport}
      quickFiltersVisible={quickFiltersVisible}
      searchDebounceMs={searchDebounceMs}
      tableId={tableId}
      tableType={tableType}
      toolbarActions={toolbarActions}
      toolbarActionsPlacement={toolbarActionsPlacement}
      viewManagerProps={{
        enabled: shouldShowViews,
        allowViewSave,
        allowViewSharing,
        defaultDensity,
        defaultDisplayMode,
        initialActiveViewId,
        initialViews,
        displayModes,
      }}
    />
  );
}

/** Record view derived from the columns, used when no `details` are given. */
const DEFAULT_DETAILS: RecordDetailsConfig = {};

function resolveRecordDetails(
  details: RecordDetailsConfig | false | undefined
): RecordDetailsConfig | undefined {
  return details === false ? undefined : (details ?? DEFAULT_DETAILS);
}

/** Opens the record view, then the host's handler; none when neither exists. */
function rowActivationHandler(
  openDetails: ((row: Record<string, unknown>) => void) | undefined,
  onRowActivate:
    | ((row: Record<string, unknown>, event: React.MouseEvent) => void)
    | undefined
) {
  if (!(openDetails || onRowActivate)) {
    return;
  }
  return (row: Record<string, unknown>, event: React.MouseEvent) => {
    openDetails?.(row);
    onRowActivate?.(row, event);
  };
}

function detailViewHandler(
  details: RecordDetailsConfig | undefined,
  open: (row: Record<string, unknown>) => void,
  onOpenDetails?: (row: Record<string, unknown>) => void
) {
  return onOpenDetails ?? (details ? open : undefined);
}

function useRecordView(
  tableId: string,
  details?: RecordDetailsConfig,
  onOpenDetails?: (row: Record<string, unknown>) => void
) {
  const [viewedRow, setViewedRow] = useState<Record<string, unknown>>();
  const recordForm = useAtomValue(catalogueFormAtom);
  const formOpen = recordForm.isOpen && recordForm.tableId === tableId;
  const standaloneFormOpen = formOpen && recordForm.surfaceOwner !== "details";
  useEffect(() => {
    if (standaloneFormOpen) {
      setViewedRow(undefined);
    }
  }, [standaloneFormOpen]);
  const open = useCallback(
    (row: Record<string, unknown>) => {
      // Keep an inline editor attached to its original record until it closes.
      if (!formOpen) {
        setViewedRow(row);
      }
    },
    [formOpen]
  );
  const openDetails = detailViewHandler(details, open, onOpenDetails);

  return {
    viewedRow: standaloneFormOpen ? undefined : viewedRow,
    setViewedRow,
    openDetails,
  };
}

function PlanningRecordOverlay({
  session,
  locale,
  labels,
  onOpen,
}: {
  session: ReturnType<typeof usePlanningState>["session"];
  locale: string;
  labels?: ReturnType<typeof planningLabelOverrides>;
  onOpen?: (row: Record<string, unknown>) => void;
}) {
  if (!session) {
    return null;
  }
  return (
    <PlanningSurface
      labels={labels}
      locale={locale}
      onOpenRecord={
        onOpen
          ? (task) => {
              if (task.record) {
                onOpen(task.record);
              }
            }
          : undefined
      }
      session={session}
    />
  );
}

function isFilterBarVisible(
  prop: boolean | undefined,
  configured: boolean | undefined
): boolean {
  return prop ?? configured ?? false;
}

function DataTableContent({
  className,
  loadingOverlay,
  enableToolbar = true,
  showFilterBar,
  onRowSelectionChange,
  onRowSelectionStateChange,
  rowSelection,
  onBulkEdit,
  onBulkDelete,
  onBulkCopy,
  onBulkExport,
  customBulkActions,
  closeOnError,
  activeRowId,
  emptyState,
  getRowId,
  onRowClick,
  onRowActivate,
  showDefaultToastsForCustomHandlers,
  onExport,
  toolbarActions,
  toolbarActionsPlacement,
  tableId: tableIdProp,
  tableType,
  formType,
  title,
  description,
  enableAdvancedFilters,
  searchDebounceMs,
  enableViews = true,
  columnTypeMapping = EMPTY_COLUMN_TYPE_MAPPING,
  initialData,
  initialPageCount,
  initialRowCount,
  initialActiveViewId,
  initialViews,
  details,
  onOpenDetails,
  onRevertActivity,
  rowActions,
  displayModeRenderers,
}: {
  rowActions?: ActionItem<Record<string, unknown>>[];
  /**
   * Views rendered by optional registry items, e.g.
   * `{ calendar: calendarRenderer }` from `yayaw-table-calendar`.
   */
  displayModeRenderers?: DisplayModeRenderers;
  /**
   * Built-in record view, shown on row click. Fields come from the columns by
   * default; pass `false` to turn it off.
   */
  details?: RecordDetailsConfig | false;
  /** Open an application-owned record route or drawer instead of the built-in details. */
  onOpenDetails?: (row: Record<string, unknown>) => void;
  onRevertActivity?: DetailRevertHandler;
  className?: string;
  loadingOverlay?: React.ReactNode;
  enableToolbar?: boolean;
  showFilterBar?: boolean;
  onRowSelectionChange?: (rows: Row<Record<string, unknown>>[]) => void;
  onRowSelectionStateChange?: (selection: Record<string, boolean>) => void;
  rowSelection?: Record<string, boolean>;
  onBulkEdit?: (
    rows: Row<Record<string, unknown>>[]
  ) => Promise<BulkActionCustomHandlerResult> | BulkActionCustomHandlerResult;
  onBulkDelete?: (
    rows: Row<Record<string, unknown>>[]
  ) => Promise<BulkDeleteCustomHandlerResult> | BulkDeleteCustomHandlerResult;
  onBulkCopy?: (
    rows: Row<Record<string, unknown>>[]
  ) => Promise<BulkActionCustomHandlerResult> | BulkActionCustomHandlerResult;
  onBulkExport?: (
    rows: Row<Record<string, unknown>>[]
  ) => Promise<BulkActionCustomHandlerResult> | BulkActionCustomHandlerResult;
  customBulkActions?: CustomBulkActionsInput<Record<string, unknown>>;
  closeOnError?: boolean;
  activeRowId?: string;
  emptyState?: TableEmptyStateConfig;
  getRowId?: (row: Record<string, unknown>) => string;
  onRowClick?: (
    url: string,
    row: Record<string, unknown>,
    event: React.MouseEvent
  ) => void;
  onRowActivate?: (
    row: Record<string, unknown>,
    event: React.MouseEvent
  ) => void;
  showDefaultToastsForCustomHandlers?: boolean;
  onExport?: (rows: Record<string, unknown>[]) => void | Promise<void>;
  toolbarActions?: ToolbarActionsInput;
  toolbarActionsPlacement?: ToolbarActionsPlacement;
  /**
   * Stable table instance id used for URL state, cache, selection, and invalidation.
   * Defaults to tableType for backwards compatibility.
   */
  tableId?: string;
  tableType: string; // Required
  /**
   * Default form type used by create/edit forms when the table config does not
   * provide a more specific createFormType/editFormType.
   */
  formType?: string;
  title?: string;
  description?: string;
  /** Whether to enable advanced filtering */
  enableAdvancedFilters?: boolean;
  /** Delay before applying global search, in milliseconds. */
  searchDebounceMs?: number;
  /**
   * Whether to show the saved views manager.
   * Defaults to true and can also be disabled from table config.
   */
  enableViews?: boolean;
  /** Column type mapping for advanced filters */
  columnTypeMapping?: Record<
    string,
    "text" | "number" | "date" | "select" | "multiSelect"
  >;
  /**
   * Server-rendered rows used to hydrate the first table view before the client
   * query refreshes. Pair with initialPageCount and initialRowCount for
   * server-paginated datasets.
   */
  initialData?: Record<string, unknown>[];
  initialPageCount?: number;
  initialRowCount?: number;
  /**
   * Saved view to apply on first render when no URL state is already present.
   */
  initialActiveViewId?: string;
  /**
   * Initial saved views used before the view action list resolves.
   */
  initialViews?: TableView[];
}) {
  const tableId = tableIdProp ?? tableType;
  useAutoPageSizeLifetime(tableId);
  const defaultFormType = formType ?? tableType;
  const { session: planningSession } = usePlanningState();
  const { locale: planningLocale, t: planningTranslate } = useTranslations();
  const planningLabels = useMemo(
    () => planningLabelOverrides(planningTranslate),
    [planningTranslate]
  );
  const recordDetails = resolveRecordDetails(details);
  const { viewedRow, setViewedRow, openDetails } = useRecordView(
    tableId,
    recordDetails,
    onOpenDetails
  );

  // Nested translations from TableProvider (used to resolve for DataTableUIProvider)
  const { translations: nestedTranslations } = useTranslations();

  // Use our data table hook to get everything we need
  const {
    columns,
    config,
    data,
    isLoading,
    pageCount,
    refetch,
    rowCount,
    visibilityKey,
  } = useDataTable({
    onView: openDetails,
    rowActions,
    formType: defaultFormType,
    initialData,
    initialPageCount,
    initialRowCount,
    tableId,
    tableType,
  });

  // Use fetched data from API
  const baseData = data || [];

  // Use baseData directly since filtering is handled by the API and DataTableAdvancedToolbar
  const finalData = baseData;

  // Debug logs for advanced filters removed since configuration is now handled in DataTableAdvancedToolbar

  // Get the title and description from props, provider translations, config, or fallback
  const { TitleComponent, DescriptionComponent } = useTableComponents();
  const { displayDescription, displayTitle } = resolveDataTableHeaderContent({
    configDescription: config.translations?.keys?.description,
    configTitle: config.translations?.keys?.title,
    description,
    tableType,
    title,
    translations: nestedTranslations,
  });

  // Use custom components if provided, otherwise use defaults
  const Title = TitleComponent || DefaultTableTitle;
  const Description = DescriptionComponent || DefaultTableDescription;
  const shouldShowToolbar = enableToolbar && config.table.showToolbar !== false;
  const shouldShowToolbarHeader = config.table.showToolbarHeader !== false;
  const shouldShowViews =
    enableViews !== false && config.table.enableViews !== false;
  const {
    resolvedSearchDebounceMs,
    resolvedToolbarActions,
    resolvedToolbarActionsPlacement,
    shouldEnableAdvancedFilters,
  } = resolveToolbarRuntime({
    config,
    enableAdvancedFilters,
    searchDebounceMs,
    toolbarActions,
    toolbarActionsPlacement,
  });
  const getTableActions = useTableActions();
  const canCreateRecords =
    config.table.allowCreate !== false &&
    typeof getTableActions?.(tableType)?.create === "function";
  // The Form mode ships in the table; it is offered when records can be created.
  // The Feed mode ships in the table too; `table.feed: false` withholds it.
  const modeRenderers = useMemo(
    () =>
      withFormRenderer(
        withoutDisabledModeRenderers(
          withFeedRenderer(displayModeRenderers),
          config.table
        ),
        isFormModeEnabled(config.table.form, canCreateRecords)
      ),
    [canCreateRecords, config.table, displayModeRenderers]
  );
  const offeredDisplayModes = useMemo(
    () =>
      availableDisplayModes(config.table.displayModes, {
        planning: Boolean(planningSession),
        renderers: Object.keys(modeRenderers ?? {}),
      }),
    [config.table.displayModes, modeRenderers, planningSession]
  );
  const shouldShowDisplayModes = offeredDisplayModes.length > 1;
  const kanbanGroupingColumns = useMemo(
    () => getKanbanGroupingColumns(config.columns.definitions),
    [config.columns.definitions]
  );
  const galleryColumns = useMemo(
    () => getGalleryControlColumns(config.columns.definitions),
    [config.columns.definitions]
  );
  const shouldShowKanbanGrouping = shouldShowKanbanGroupingControl({
    displayModes: config.table.displayModes,
    enableGrouping: config.table.enableGrouping,
    groupingColumnsCount: kanbanGroupingColumns.length,
  });
  const shouldShowGallery = shouldShowGalleryControl({
    columnsCount: galleryColumns.length,
    displayModes: config.table.displayModes,
  });
  const shouldShowViewControls =
    shouldShowViews ||
    shouldShowDisplayModes ||
    shouldShowKanbanGrouping ||
    shouldShowGallery;

  return (
    <TableStateSyncProvider enabled={config.table.syncUrl !== false}>
      <Suspense fallback={<DataTableSkeleton />}>
        <DataTableUIProvider
          columnsConfig={{
            defaultColumnOrder: config.columns.order || [],
            defaultSort: config.columns.sort || [],
            defaultVisibleColumns: config.columns.visible || [],
            mandatoryColumns: config.columns.mandatory || [],
          }}
          tableConfig={{
            allowBulkDelete: config.table.allowBulkDelete,
            allowBulkEdit: config.table.allowBulkEdit,
            allowCreate: config.table.allowCreate,
            allowDelete: config.table.allowDelete,
            allowDuplicate: config.table.allowDuplicate,
            allowEdit: config.table.allowEdit,
            allowInlineEdit: config.table.allowInlineEdit,
            allowViewSave: config.table.allowViewSave,
            allowViewSharing: config.table.allowViewSharing,
            actionsAsIcons: config.table.actionsAsIcons,
            bulkExport: config.table.bulkExport,
            defaultDisplayMode: config.table.defaultDisplayMode,
            defaultPageSize: config.table.defaultPageSize || 10,
            density: config.table.density,
            displayModes: config.table.displayModes,
            emptyState: config.table.emptyState,
            export: config.table.export,
            showToolbar: config.table.showToolbar,
            showToolbarHeader: config.table.showToolbarHeader,
            enableColumnDragDropByDefault:
              config.table.enableColumnDragDropByDefault,
            enableColumnResizing: config.table.enableColumnResizing,
            enableColumnDnd: config.table.enableColumnDnd,
            enableColumnFilters: config.table.enableColumnFilters,
            enableAdvancedFilters: shouldEnableAdvancedFilters,
            enableColumnPinning: config.table.enableColumnPinning,
            enableCalculations: config.table.enableCalculations,
            enableGrouping: config.table.enableGrouping,
            enableMultiRowSelection:
              config.table.enableMultiRowSelection !== false,
            enablePagination: config.table.enablePagination !== false,
            enableRowSelection: config.table.enableRowSelection,
            enableRowClickEdit: config.table.enableRowClickEdit,
            enableSorting: config.table.enableSorting,
            enableViews: config.table.enableViews,
            preserveSelectionOnQuery: config.table.preserveSelectionOnQuery,
            searchDebounceMs: resolvedSearchDebounceMs,
            syncUrl: config.table.syncUrl,
            inlineEdit: config.table.inlineEdit,
            gallery: config.table.gallery,
            ...uiModeDefaults(config.table),
            manualOrder: config.table.manualOrder,
            planning: config.table.planning,
            gantt: config.table.gantt,
            kanban: config.table.kanban,
            layoutPreset: config.table.layoutPreset,
            enableAutoPageSize: config.table.enableAutoPageSize,
            defaultAutoPageSize: config.table.defaultAutoPageSize,
            pageSizeOptions: config.table.pageSizeOptions || [
              10, 20, 50, 100, 200, 500,
            ],
            rowClickMode: config.table.rowClickMode,
          }}
          tableId={tableId}
          translations={resolveTranslationsToUiStrings(
            (nestedTranslations ?? defaultTranslations) as DataTableTranslations
          )}
        >
          <div className="flex flex-col gap-4">
            {shouldShowToolbar && shouldShowToolbarHeader && (
              <div className="space-y-1">
                <Title>{displayTitle}</Title>
                <Description>{displayDescription}</Description>
              </div>
            )}

            <TableFilterBar
              tableId={tableId}
              tableType={tableType}
              visible={isFilterBarVisible(
                showFilterBar,
                config.table.showFilterBar
              )}
            />

            {/* Header with title/description and toolbar */}
            {shouldShowToolbar && (
              <div className="space-y-3">
                {/* Keep settings mounted while a filter or sort request is loading. */}
                <DataTableHeaderControls
                  allowViewSave={config.table.allowViewSave}
                  allowViewSharing={config.table.allowViewSharing}
                  baseData={baseData}
                  columnTypeMapping={columnTypeMapping}
                  defaultDensity={config.table.density}
                  defaultDisplayMode={config.table.defaultDisplayMode}
                  defaultFormType={defaultFormType}
                  displayModeRenderers={modeRenderers}
                  displayModes={offeredDisplayModes}
                  enableAdvancedFilters={shouldEnableAdvancedFilters}
                  enableGalleryControl={shouldShowGallery}
                  enableKanbanGrouping={shouldShowKanbanGrouping}
                  galleryColumns={galleryColumns}
                  galleryConfig={config.table.gallery}
                  listConfig={config.table.list}
                  ganttConfig={config.table.gantt}
                  initialActiveViewId={initialActiveViewId}
                  initialViews={initialViews}
                  kanbanConfig={config.table.kanban}
                  kanbanControlColumns={galleryColumns}
                  kanbanDefaultGroupBy={config.table.kanban?.groupBy}
                  kanbanGroupingColumns={kanbanGroupingColumns}
                  onExport={onExport}
                  quickFiltersVisible={isFilterBarVisible(
                    showFilterBar,
                    config.table.showFilterBar
                  )}
                  rendererColumns={config.columns.definitions}
                  rendererDefaults={config.table}
                  searchDebounceMs={resolvedSearchDebounceMs}
                  shouldShowViewControls={shouldShowViewControls}
                  shouldShowViews={shouldShowViews}
                  tableId={tableId}
                  tableType={tableType}
                  toolbarActions={resolvedToolbarActions}
                  toolbarActionsPlacement={resolvedToolbarActionsPlacement}
                />
              </div>
            )}

            {/* Table content */}
            {isLoading ? (
              <DataTableSkeleton />
            ) : (
              <DataTableClient
                activeRowId={activeRowId}
                className={className}
                closeOnError={closeOnError}
                columns={
                  columns as import("@/components/ui/yayaw-table/tanstack").ColumnDef<
                    Record<string, unknown>
                  >[]
                }
                customBulkActions={customBulkActions}
                data={finalData}
                displayModeRenderers={modeRenderers}
                details={recordDetails}
                emptyState={emptyState}
                enableColumnDragDropByDefault={Boolean(
                  config.table.enableColumnDragDropByDefault
                )}
                enableColumnFilters={config.table.enableColumnFilters}
                enableColumnPinning={config.table.enableColumnPinning !== false}
                enableColumnResizing={
                  config.table.enableColumnResizing === true
                }
                enableGrouping={config.table.enableGrouping}
                enableMultiRowSelection={
                  config.table.enableMultiRowSelection !== false
                }
                enablePagination={config.table.enablePagination !== false}
                enableRowSelection={config.table.enableRowSelection}
                enableSorting={config.table.enableSorting}
                formType={defaultFormType}
                getRowId={getRowId}
                key={`${tableId}-${visibilityKey}`}
                loadingOverlay={loadingOverlay}
                onBulkCopy={onBulkCopy}
                onBulkDelete={onBulkDelete}
                onBulkEdit={onBulkEdit}
                onBulkExport={onBulkExport}
                onOpenDetails={openDetails}
                onRevertActivity={onRevertActivity}
                onRowActivate={rowActivationHandler(openDetails, onRowActivate)}
                onRowClick={onRowClick}
                onRowSelectionChange={onRowSelectionChange}
                onRowSelectionStateChange={onRowSelectionStateChange}
                queryFn={async (_params) => {
                  // For fetched data, use the refetch function
                  await refetch();
                  return {
                    data: finalData,
                    pageCount: pageCount || 1,
                    rowCount: rowCount || finalData.length,
                  };
                }}
                rowSelection={rowSelection}
                showDefaultToastsForCustomHandlers={
                  showDefaultToastsForCustomHandlers
                }
                tableId={tableId}
                tableType={tableType}
              />
            )}
          </div>
        </DataTableUIProvider>
      </Suspense>

      {/* Render the CatalogueForm container to handle form operations */}
      <Suspense fallback={null}>
        <CatalogueFormContainer tableId={tableId} />
      </Suspense>
      <PlanningRecordOverlay
        labels={planningLabels}
        locale={planningLocale}
        onOpen={openDetails}
        session={planningSession}
      />
      <TableRecordDetails
        details={recordDetails}
        formType={defaultFormType}
        getRowId={getRowId}
        onClose={() => setViewedRow(undefined)}
        onRefresh={refetch}
        onRevertActivity={onRevertActivity}
        row={viewedRow}
        rows={finalData}
        tableConfig={config}
        tableId={tableId}
        tableType={tableType}
      />
    </TableStateSyncProvider>
  );
}

export function DataTable(
  props: Parameters<typeof DataTableContent>[0] & {
    // Provider props (single entry point API)
    translations?: import("../types/translations").DataTableTranslations;
    locale?: string;
    getFormConfig?: Parameters<typeof TableProvider>[0]["getFormConfig"];
    getTableActions?: Parameters<typeof TableProvider>[0]["getTableActions"];
    getTableConfig?: Parameters<typeof TableProvider>[0]["getTableConfig"];
    columnsConfig?: Parameters<typeof TableProvider>[0]["columnsConfig"];
    tableConfig?: Parameters<typeof TableProvider>[0]["tableConfig"];
    queryClient?: import("@tanstack/react-query").QueryClient;
    TitleComponent?: Parameters<typeof TableProvider>[0]["TitleComponent"];
    DescriptionComponent?: Parameters<
      typeof TableProvider
    >[0]["DescriptionComponent"];
    children?: React.ReactNode;
    /**
     * Isolates this instance on a page with other tables: its URL keys are
     * `<instanceId>-view`, `<instanceId>-historyIndex` and `<instanceId>-…`
     * (instead of `view`, `historyIndex` and `<tableId>-…`) and its state
     * lives in a store of its own. Config, actions and views still use the table.
     */
    instanceId?: string;
    /**
     * Settings an instance with URL sync off starts from, applied before its
     * first request: a saved view (its id becomes the active view) or a view
     * config. For tables embedded without a toolbar, e.g. dashboard widgets.
     */
    initialView?: { id?: null | string; config: TableViewConfig };
  }
) {
  const {
    translations,
    locale,
    getFormConfig,
    getTableActions,
    getTableConfig,
    queryClient,
    columnsConfig,
    tableConfig,
    TitleComponent,
    DescriptionComponent,
    tableType,
    tableId,
    formType,
    children,
    instanceId,
    initialView,
    ...rest
  } = props;
  const resolvedTableId = tableId ?? tableType;

  type ContentProps = Parameters<typeof DataTableContent>[0];
  const table = (
    <TableProvider
      columnsConfig={columnsConfig}
      DescriptionComponent={DescriptionComponent}
      getFormConfig={getFormConfig}
      getTableActions={getTableActions}
      getTableConfig={getTableConfig}
      locale={locale}
      queryClient={queryClient}
      TitleComponent={TitleComponent}
      tableConfig={tableConfig}
      tableId={resolvedTableId}
      tableType={tableType}
      translations={
        (translations as DataTableTranslations | undefined) ??
        defaultTranslations
      }
    >
      {children}
      <DataTableContent
        {...(rest as ContentProps)}
        formType={formType}
        tableId={resolvedTableId}
        tableType={tableType}
      />
    </TableProvider>
  );
  if (!(instanceId || initialView)) {
    return table;
  }
  const sourceConfig = getTableConfig?.(tableType);
  const sourceTable =
    sourceConfig && "table" in sourceConfig ? sourceConfig.table : undefined;
  return (
    <TableInstanceScope
      defaults={{
        density: sourceTable?.density,
        displayMode: sourceTable?.defaultDisplayMode,
        pageSize: sourceTable?.defaultPageSize,
      }}
      initialView={sourceTable?.syncUrl === false ? initialView : undefined}
      instanceId={instanceId}
      tableId={resolvedTableId}
    >
      {table}
    </TableInstanceScope>
  );
}

/** A store of the instance's own, started from `initialView` when given. */
function TableInstanceScope({
  children,
  defaults,
  initialView,
  instanceId,
  tableId,
}: {
  children: ReactNode;
  defaults: Parameters<typeof seedTableViewState>[3];
  initialView?: { id?: null | string; config: TableViewConfig };
  instanceId?: string;
  tableId: string;
}) {
  const [store] = useState(() => {
    const instanceStore = createStore();
    if (initialView) {
      seedTableViewState(instanceStore, tableId, initialView, defaults);
    }
    return instanceStore;
  });
  return (
    <JotaiProvider store={store}>
      <TableInstanceProvider instanceId={instanceId}>
        {children}
      </TableInstanceProvider>
    </JotaiProvider>
  );
}

// Simple toolbar component removed as unused
