/**
 * New DataTable component using the declarative architecture
 * This component replaces the old DataTable with a more streamlined API
 */
"use client";

import type { Row } from "@/components/ui/yayaw-table/tanstack";
import type React from "react";
// Import advanced filters hook directly
import { Suspense, useMemo } from "react";
import type {
  BulkActionCustomHandlerResult,
  BulkDeleteCustomHandlerResult,
} from "../hooks/use-bulk-actions";
import { useDataTable } from "../hooks/use-data-table";
import type { TableCatalogueConfig } from "../hooks/use-table-config";

import { DataTableUIProvider } from "../providers/data-table-ui-provider";
import {
  defaultTranslations,
  TableProvider,
  useTableComponents,
  useTranslations,
} from "../providers/table-provider";
import { resolveTranslationsToUiStrings } from "../providers/translation-cache";
import { TableStateSyncProvider } from "../providers/table-state-sync-provider";
import type { TableEmptyStateConfig } from "../config/helpers";
import type {
  ToolbarActionsInput,
  ToolbarActionsPlacement,
} from "../types/toolbar-types";
import type { DataTableTranslations } from "../types/translations";
import type { TableView } from "../types/view-types";
import type {
  TableDisplayMode,
  TableGalleryConfig,
  TableKanbanConfig,
} from "../types/display-types";
import type { CustomBulkActionsInput } from "./bulk-actions";
import { DataTableSkeleton } from "./data-table-skeleton";
// Lazy load heavy components using React.lazy inside './forms/lazy-forms'
import { LazyCatalogueFormContainer as CatalogueFormContainer } from "./forms/lazy-forms";
// Import DataTableClient directly for better SSR compatibility
import { TableComponent as DataTableClient } from "./table-component";

// Direct import keeps the toolbar available without a client-only dynamic wrapper.
import { DataTableAdvancedToolbar } from "./toolbar/data-table-advanced-toolbar";
import { TableDisplayModeSwitcher } from "./toolbar/table-display-mode-switcher";
import { TableGalleryMenu } from "./toolbar/table-gallery-menu";
import { TableKanbanGroupingMenu } from "./toolbar/table-kanban-grouping-menu";
import { DataTableViewManager } from "./toolbar/table-view-manager";

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
      title ||
      translationText?.title ||
      configTitle ||
      `${tableType} Table`,
  };
}

function DataTableHeaderControls({
  allowViewSave,
  allowViewSharing,
  baseData,
  columnTypeMapping,
  defaultDisplayMode,
  defaultFormType,
  displayModes,
  enableKanbanGrouping,
  enableGalleryControl,
  enableAdvancedFilters,
  searchDebounceMs,
  galleryColumns,
  galleryConfig,
  initialActiveViewId,
  initialViews,
  kanbanConfig,
  kanbanControlColumns,
  kanbanDefaultGroupBy,
  kanbanGroupingColumns,
  onExport,
  shouldShowViewControls,
  shouldShowViews,
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
  defaultFormType: string;
  displayModes?: TableDisplayMode[];
  enableKanbanGrouping: boolean;
  enableGalleryControl: boolean;
  enableAdvancedFilters: boolean;
  searchDebounceMs: number;
  galleryColumns: GalleryControlColumn[];
  galleryConfig?: TableGalleryConfig;
  initialActiveViewId?: string;
  initialViews?: TableView[];
  kanbanConfig?: TableKanbanConfig;
  kanbanControlColumns: KanbanGroupingColumn[];
  kanbanDefaultGroupBy?: string;
  kanbanGroupingColumns: KanbanGroupingColumn[];
  onExport?: (rows: Record<string, unknown>[]) => Promise<void> | void;
  shouldShowViewControls: boolean;
  shouldShowViews: boolean;
  tableId: string;
  tableType: string;
  toolbarActions?: ToolbarActionsInput;
  toolbarActionsPlacement: ToolbarActionsPlacement;
}) {
  return (
    <div
      className={
        shouldShowViewControls
          ? "flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between"
          : "flex justify-end"
      }
    >
      {shouldShowViewControls ? (
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {shouldShowViews ? (
            <DataTableViewManager
              allowViewSave={allowViewSave !== false}
              allowViewSharing={allowViewSharing === true}
              defaultDisplayMode={defaultDisplayMode}
              initialActiveViewId={initialActiveViewId}
              initialViews={initialViews}
              tableId={tableId}
              tableType={tableType}
            />
          ) : null}
          <TableDisplayModeSwitcher
            defaultDisplayMode={defaultDisplayMode}
            displayModes={displayModes}
            tableId={tableId}
          />
          <TableKanbanGroupingMenu
            columns={kanbanGroupingColumns}
            controlColumns={kanbanControlColumns}
            defaultConfig={kanbanConfig}
            defaultDisplayMode={defaultDisplayMode}
            defaultGroupBy={kanbanDefaultGroupBy}
            enabled={enableKanbanGrouping}
            tableId={tableId}
          />
          <TableGalleryMenu
            columns={galleryColumns}
            defaultConfig={galleryConfig}
            defaultDisplayMode={defaultDisplayMode}
            enabled={enableGalleryControl}
            tableId={tableId}
          />
        </div>
      ) : null}
      <div className="flex-shrink-0">
        <DataTableAdvancedToolbar
          columnTypeMapping={columnTypeMapping}
          data={baseData}
          enableAdvancedFilters={enableAdvancedFilters}
          formType={defaultFormType}
          onExport={onExport}
          searchDebounceMs={searchDebounceMs}
          tableId={tableId}
          tableType={tableType}
          toolbarActions={toolbarActions}
          toolbarActionsPlacement={toolbarActionsPlacement}
        />
      </div>
    </div>
  );
}

function DataTableContent({
  className,
  loadingOverlay,
  enableToolbar = true,
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
}: {
  className?: string;
  loadingOverlay?: React.ReactNode;
  enableToolbar?: boolean;
  onRowSelectionChange?: (rows: Row<Record<string, unknown>>[]) => void;
  onRowSelectionStateChange?: (
    selection: Record<string, boolean>
  ) => void;
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
  const defaultFormType = formType ?? tableType;

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
  const shouldShowViews = enableViews !== false && config.table.enableViews !== false;
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
  const shouldShowDisplayModes = (config.table.displayModes?.length ?? 1) > 1;
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
            kanban: config.table.kanban,
            layoutPreset: config.table.layoutPreset,
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
          <div className="space-y-4">
            {/* Header with title/description and toolbar */}
            {shouldShowToolbar && (
              <div className="space-y-3">
                {shouldShowToolbarHeader && (
                  <div className="space-y-1">
                    <Title>{displayTitle}</Title>
                    <Description>{displayDescription}</Description>
                  </div>
                )}

                {!isLoading && (
                  <DataTableHeaderControls
                    allowViewSave={config.table.allowViewSave}
                    allowViewSharing={config.table.allowViewSharing}
                    baseData={baseData}
                    columnTypeMapping={columnTypeMapping}
                    defaultDisplayMode={config.table.defaultDisplayMode}
                    defaultFormType={defaultFormType}
                    displayModes={config.table.displayModes}
                    enableGalleryControl={shouldShowGallery}
                    enableKanbanGrouping={shouldShowKanbanGrouping}
                    enableAdvancedFilters={shouldEnableAdvancedFilters}
                    galleryColumns={galleryColumns}
                    galleryConfig={config.table.gallery}
                    initialActiveViewId={initialActiveViewId}
                    initialViews={initialViews}
                    kanbanConfig={config.table.kanban}
                    kanbanControlColumns={galleryColumns}
                    kanbanDefaultGroupBy={config.table.kanban?.groupBy}
                    kanbanGroupingColumns={kanbanGroupingColumns}
                    onExport={onExport}
                    searchDebounceMs={resolvedSearchDebounceMs}
                    shouldShowViewControls={shouldShowViewControls}
                    shouldShowViews={shouldShowViews}
                    tableId={tableId}
                    tableType={tableType}
                    toolbarActions={resolvedToolbarActions}
                    toolbarActionsPlacement={resolvedToolbarActionsPlacement}
                  />
                )}
              </div>
            )}

            {/* Table content */}
            {isLoading ? (
              <DataTableSkeleton />
            ) : (
              <DataTableClient
                className={className}
                activeRowId={activeRowId}
                columns={
                  columns as import("@/components/ui/yayaw-table/tanstack").ColumnDef<
                    Record<string, unknown>
                  >[]
                }
                data={finalData}
                emptyState={emptyState}
                enableColumnDragDropByDefault={Boolean(
                  config.table.enableColumnDragDropByDefault
                )}
                enableColumnResizing={config.table.enableColumnResizing === true}
                enableColumnFilters={config.table.enableColumnFilters}
                enableColumnPinning={config.table.enableColumnPinning !== false}
                enableGrouping={config.table.enableGrouping}
                enableMultiRowSelection={
                  config.table.enableMultiRowSelection !== false
                }
                enablePagination={config.table.enablePagination !== false}
                enableRowSelection={config.table.enableRowSelection}
                enableSorting={config.table.enableSorting}
                getRowId={getRowId}
                key={`${tableId}-${visibilityKey}`}
                loadingOverlay={loadingOverlay}
                closeOnError={closeOnError}
                customBulkActions={customBulkActions}
                onBulkCopy={onBulkCopy}
                onBulkDelete={onBulkDelete}
                onBulkEdit={onBulkEdit}
                onBulkExport={onBulkExport}
                onRowActivate={onRowActivate}
                onRowClick={onRowClick}
                onRowSelectionChange={onRowSelectionChange}
                onRowSelectionStateChange={onRowSelectionStateChange}
                rowSelection={rowSelection}
                showDefaultToastsForCustomHandlers={
                  showDefaultToastsForCustomHandlers
                }
                queryFn={async (_params) => {
                  // For fetched data, use the refetch function
                  await refetch();
                  return {
                    data: finalData,
                    pageCount: pageCount || 1,
                    rowCount: rowCount || finalData.length,
                  };
                }}
                tableId={tableId}
                tableType={tableType}
                formType={defaultFormType}
              />
            )}
          </div>
        </DataTableUIProvider>
      </Suspense>

      {/* Render the CatalogueForm container to handle form operations */}
      <Suspense fallback={null}>
        <CatalogueFormContainer />
      </Suspense>
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
    ...rest
  } = props;
  const resolvedTableId = tableId ?? tableType;

  type ContentProps = Parameters<typeof DataTableContent>[0];
  return (
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
}

// Simple toolbar component removed as unused
