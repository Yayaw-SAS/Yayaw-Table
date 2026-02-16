/**
 * New DataTable component using the declarative architecture
 * This component replaces the old DataTable with a more streamlined API
 */
"use client";

import type { Row } from "@tanstack/react-table";
import type React from "react";
// Import advanced filters hook directly
import { Suspense } from "react";
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
import type { DataTableTranslations } from "../types/translations";
import { DataTableSkeleton } from "./data-table-skeleton";
// Lazy load heavy components using React.lazy inside './forms/lazy-forms'
import { LazyCatalogueFormContainer as CatalogueFormContainer } from "./forms/lazy-forms";
// Import DataTableClient directly for better SSR compatibility
import { TableComponent as DataTableClient } from "./table-component";

// Import direct pour déboguer (au lieu de dynamic)
import { DataTableAdvancedToolbar } from "./toolbar/data-table-advanced-toolbar";

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

/**
 * DataTable component with declarative configuration
 * This component uses the table catalogue to configure itself
 */
function DataTableContent({
  className,
  loadingOverlay,
  enableToolbar = true,
  onRowSelectionChange,
  onBulkEdit,
  onBulkDelete,
  onBulkCopy,
  onBulkExport,
  closeOnError,
  showDefaultToastsForCustomHandlers,
  onExport,
  tableType,
  title,
  description,
  enableAdvancedFilters = false,
  columnTypeMapping = {},
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
  closeOnError?: boolean;
  showDefaultToastsForCustomHandlers?: boolean;
  onExport?: (rows: Record<string, unknown>[]) => void | Promise<void>;
  tableType: string; // Required
  title?: string;
  description?: string;
  /** Whether to enable advanced filtering */
  enableAdvancedFilters?: boolean;
  /** Column type mapping for advanced filters */
  columnTypeMapping?: Record<
    string,
    "text" | "number" | "date" | "option" | "multiOption"
  >;
}) {
  // Utiliser directement le tableType comme tableId
  const tableId = tableType;

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
  const displayTitle =
    title ||
    (
      nestedTranslations as
        | (DataTableTranslations & { title?: string })
        | undefined
    )?.title ||
    config.translations?.keys?.title ||
    `${tableType} Table`;
  const displayDescription =
    description ||
    (
      nestedTranslations as
        | (DataTableTranslations & { description?: string })
        | undefined
    )?.description ||
    config.translations?.keys?.description ||
    `Manage your ${tableType}`;

  // Use custom components if provided, otherwise use defaults
  const Title = TitleComponent || DefaultTableTitle;
  const Description = DescriptionComponent || DefaultTableDescription;

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
            actionsAsIcons: config.table.actionsAsIcons,
            bulkExport: config.table.bulkExport,
            defaultPageSize: config.table.defaultPageSize || 10,
            export: config.table.export,
            enableColumnDragDropByDefault:
              config.table.enableColumnDragDropByDefault,
            enableColumnFilters: config.table.enableColumnFilters,
            enableGrouping: config.table.enableGrouping,
            enableMultiRowSelection:
              config.table.enableMultiRowSelection !== false,
            enablePagination: config.table.enablePagination !== false,
            enableRowSelection: config.table.enableRowSelection,
            enableSorting: config.table.enableSorting,
            pageSizeOptions: config.table.pageSizeOptions || [
              10, 20, 50, 100, 200, 500,
            ],
          }}
          tableId={tableId}
          translations={resolveTranslationsToUiStrings(
            (nestedTranslations ?? defaultTranslations) as DataTableTranslations
          )}
        >
          <div className="space-y-4">
            {/* Header with title/description and toolbar */}
            {enableToolbar && (
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                {/* Title and description section */}
                <div className="space-y-1">
                  <Title>{displayTitle}</Title>
                  <Description>{displayDescription}</Description>
                </div>

                {/* Toolbar section */}
                {!isLoading && (
                  <div className="flex-shrink-0">
                    <DataTableAdvancedToolbar
                      columnTypeMapping={columnTypeMapping}
                      data={baseData}
                      enableAdvancedFilters={enableAdvancedFilters}
                      onExport={onExport}
                      tableId={tableId}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Table content */}
            {isLoading ? (
              <DataTableSkeleton />
            ) : (
              <DataTableClient
                className={className}
                columns={
                  columns as import("@tanstack/react-table").ColumnDef<
                    Record<string, unknown>
                  >[]
                }
                data={finalData}
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
                key={`${tableId}-${visibilityKey}`}
                loadingOverlay={loadingOverlay}
                closeOnError={closeOnError}
                onBulkCopy={onBulkCopy}
                onBulkDelete={onBulkDelete}
                onBulkEdit={onBulkEdit}
                onBulkExport={onBulkExport}
                onRowSelectionChange={onRowSelectionChange}
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
    children,
    ...rest
  } = props;

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
      tableId={tableType}
      translations={
        (translations as DataTableTranslations | undefined) ??
        defaultTranslations
      }
    >
      {children}
      <DataTableContent {...(rest as ContentProps)} tableType={tableType} />
    </TableProvider>
  );
}

// Simple toolbar component removed as unused
