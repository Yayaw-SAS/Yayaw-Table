/**
 * New DataTable component using the declarative architecture
 * This component replaces the old DataTable with a more streamlined API
 */
"use client";

import type { Row } from "@tanstack/react-table";
import type React from "react";
// Import advanced filters hook directly
import { Suspense } from "react";
import type { TableEmptyStateConfig } from "../config/helpers";
import type {
  BulkActionCustomHandlerResult,
  BulkDeleteCustomHandlerResult,
} from "../hooks/use-bulk-actions";
import { useDataTable } from "../hooks/use-data-table";
import { DataTableUIProvider } from "../providers/data-table-ui-provider";
import {
  defaultTranslations,
  TableProvider,
  useTableComponents,
  useTranslations,
} from "../providers/table-provider";
import { resolveTranslationsToUiStrings } from "../providers/translation-cache";
import type { TableDisplayMode } from "../types/display-types";
import type {
  ToolbarActionsInput,
  ToolbarActionsPlacement,
} from "../types/toolbar-types";
import type { DataTableTranslations } from "../types/translations";
import type { TableView } from "../types/view-types";
import type { CustomBulkActionsInput } from "./bulk-actions";
import { DataTableSkeleton } from "./data-table-skeleton";
// Lazy load heavy components using React.lazy inside './forms/lazy-forms'
import { LazyCatalogueFormContainer as CatalogueFormContainer } from "./forms/lazy-forms";
// Import DataTableClient directly for better SSR compatibility
import { TableComponent as DataTableClient } from "./table-component";

// Direct import keeps the toolbar available without a client-only dynamic wrapper.
import { DataTableAdvancedToolbar } from "./toolbar/data-table-advanced-toolbar";
import { TableDisplayModeSwitcher } from "./toolbar/table-display-mode-switcher";
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

function DataTableHeaderControls({
  allowViewSave,
  allowViewSharing,
  baseData,
  columnTypeMapping,
  defaultDisplayMode,
  defaultFormType,
  displayModes,
  enableAdvancedFilters,
  initialActiveViewId,
  initialViews,
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
  enableAdvancedFilters: boolean;
  initialActiveViewId?: string;
  initialViews?: TableView[];
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
        </div>
      ) : null}
      <div className="flex-shrink-0">
        <DataTableAdvancedToolbar
          columnTypeMapping={columnTypeMapping}
          data={baseData}
          enableAdvancedFilters={enableAdvancedFilters}
          formType={defaultFormType}
          onExport={onExport}
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
  toolbarActionsPlacement = "between-create-export",
  tableId: tableIdProp,
  tableType,
  formType,
  title,
  description,
  enableAdvancedFilters = false,
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
  const shouldShowViews =
    enableViews !== false && config.table.enableViews !== false;
  const shouldShowDisplayModes = (config.table.displayModes?.length ?? 1) > 1;
  const shouldShowViewControls = shouldShowViews || shouldShowDisplayModes;

  return (
    <>
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
            enableColumnFilters: config.table.enableColumnFilters,
            enableCalculations: config.table.enableCalculations,
            enableGrouping: config.table.enableGrouping,
            enableMultiRowSelection:
              config.table.enableMultiRowSelection !== false,
            enablePagination: config.table.enablePagination !== false,
            enableRowSelection: config.table.enableRowSelection,
            enableRowClickEdit: config.table.enableRowClickEdit,
            enableSorting: config.table.enableSorting,
            enableViews: config.table.enableViews,
            inlineEdit: config.table.inlineEdit,
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
                    enableAdvancedFilters={enableAdvancedFilters}
                    initialActiveViewId={initialActiveViewId}
                    initialViews={initialViews}
                    onExport={onExport}
                    shouldShowViewControls={shouldShowViewControls}
                    shouldShowViews={shouldShowViews}
                    tableId={tableId}
                    tableType={tableType}
                    toolbarActions={toolbarActions}
                    toolbarActionsPlacement={toolbarActionsPlacement}
                  />
                )}
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
                  columns as import("@tanstack/react-table").ColumnDef<
                    Record<string, unknown>
                  >[]
                }
                customBulkActions={customBulkActions}
                data={finalData}
                emptyState={emptyState}
                enableColumnDragDropByDefault={Boolean(
                  config.table.enableColumnDragDropByDefault
                )}
                enableColumnFilters={config.table.enableColumnFilters}
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
                onRowActivate={onRowActivate}
                onRowClick={onRowClick}
                onRowSelectionChange={onRowSelectionChange}
                queryFn={async (_params) => {
                  // For fetched data, use the refetch function
                  await refetch();
                  return {
                    data: finalData,
                    pageCount: pageCount || 1,
                    rowCount: rowCount || finalData.length,
                  };
                }}
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
        <CatalogueFormContainer />
      </Suspense>
    </>
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
