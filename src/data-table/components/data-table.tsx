/**
 * New DataTable component using the declarative architecture
 * This component replaces the old DataTable with a more streamlined API
 */
'use client';

import type { Row } from '@tanstack/react-table';
import dynamic from 'next/dynamic';
// Import advanced filters hook directly
import { Suspense, useMemo } from 'react';
import { useDataTable } from '../hooks/use-data-table';
import {
  useColumnsFilterConfig,
  useDataTableAdvancedFilters,
  useTableAccessors,
} from '../hooks/use-data-table-advanced-filters';
import { DataTableUIProvider } from '../providers/data-table-ui-provider';
import { useTableComponents } from '../providers/table-provider';
import { DataTableSkeleton } from './data-table-skeleton';

// Dynamically import the DataTableClient component with no SSR
// This ensures it's only rendered on the client side to avoid hydration issues
const DataTableClient = dynamic(
  () =>
    import('./modern-data-table').then((mod) => ({
      default: mod.DataTable,
    })),
  {
    loading: () => <DataTableSkeleton />,
    ssr: false,
  }
);
// Lazy load heavy components for better performance
const CatalogueFormContainer = dynamic(
  () =>
    import('./forms/lazy-forms').then((mod) => ({
      default: mod.LazyCatalogueFormContainer,
    })),
  {
    loading: () => null,
    ssr: false,
  }
);

const DataTableAdvancedToolbar = dynamic(
  () =>
    import('./toolbar/data-table-advanced-toolbar').then((mod) => ({
      default: mod.DataTableAdvancedToolbar,
    })),
  {
    loading: () => <div className="h-12 animate-pulse rounded bg-muted" />,
    ssr: false,
  }
);

// Default UI components
function DefaultTableTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2 className={`font-semibold text-foreground text-xl ${className || ''}`}>
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
    <p className={`text-muted-foreground text-sm ${className || ''}`}>
      {children}
    </p>
  );
}

// Helper hook for creating column options
function useColumnOptions(
  enableAdvancedFilters: boolean,
  columnDefinitions?: unknown[]
) {
  return useMemo(() => {
    if (!enableAdvancedFilters) {
      return [];
    }
    const definitions = columnDefinitions || [];

    return definitions.map((colDef) => {
      const col = colDef as Record<string, unknown>;
      return {
        canFilter: col.canFilter !== false,
        canHide: col.canHide !== false,
        id: String(col.id || ''),
        label: String(col.header || col.id || ''),
        placeholder: col.placeholder,
        description: col.description,
        options: col.options,
        min: col.min,
        max: col.max,
        type: col.type,
      };
    });
  }, [enableAdvancedFilters, columnDefinitions]);
}

/**
 * Hook to set up advanced filters configuration
 */
function useAdvancedFiltersSetup({
  enableAdvancedFilters,
  config,
  columnTypeMapping,
  baseData,
  tableId,
}: {
  enableAdvancedFilters: boolean;
  config: ReturnType<typeof useDataTable>['config'];
  columnTypeMapping: Record<
    string,
    'text' | 'number' | 'date' | 'option' | 'multiOption'
  >;
  baseData: Record<string, unknown>[];
  tableId: string;
}) {
  // Create enhanced column options similar to toolbar (always create, use conditionally)
  const columnOptions = useColumnOptions(
    enableAdvancedFilters,
    config.columns?.definitions
  );

  // Create advanced columns configuration from table columns (always call hook)
  const advancedColumnsConfig = useColumnsFilterConfig(
    columnOptions,
    columnTypeMapping
  );

  // Create accessors for advanced filtering (always call hook)
  const accessors = useTableAccessors(
    baseData,
    columnOptions.map((col) => String(col.id || ''))
  );

  // Set up advanced filters (always call hook)
  const advancedFiltersResult = useDataTableAdvancedFilters({
    tableType: tableId,
    strategy: 'client',
    data: baseData,
    advancedColumnsConfig,
    accessors,
    autoComputeFaceted: true,
  });

  // Use filtered data from advanced filters if enabled
  const finalData = enableAdvancedFilters
    ? advancedFiltersResult.filteredData
    : baseData;

  // Store config for toolbar if enabled
  const advancedFiltersConfig = enableAdvancedFilters
    ? {
        filters: advancedFiltersResult.advancedFilters,
        actions: advancedFiltersResult.advancedActions,
        columnsConfig: advancedColumnsConfig,
        onConvertToAdvanced: advancedFiltersResult.convertLegacyToAdvanced,
      }
    : undefined;

  return { finalData, advancedFiltersConfig };
}

/**
 * DataTable component with declarative configuration
 * This component uses the table catalogue to configure itself
 */
export function DataTable({
  className,
  enableToolbar = true,
  onRowSelectionChange,
  tableType,
  title,
  description,
  enableAdvancedFilters = false,
  data: providedData,
  columnTypeMapping = {},
}: {
  className?: string;
  enableToolbar?: boolean;
  onRowSelectionChange?: (rows: Row<Record<string, unknown>>[]) => void;
  tableType: string; // Required
  title?: string;
  description?: string;
  /** Whether to enable advanced filtering */
  enableAdvancedFilters?: boolean;
  /** Data for advanced filtering (optional, if not provided, will be fetched) */
  data?: Record<string, unknown>[];
  /** Column type mapping for advanced filters */
  columnTypeMapping?: Record<
    string,
    'text' | 'number' | 'date' | 'option' | 'multiOption'
  >;
}) {
  // Utiliser directement le tableType comme tableId
  const tableId = tableType;

  // Use our data table hook to get everything we need
  const {
    columns,
    config,
    data,
    isLoading,
    pageCount,
    refetch,
    rowCount,
    translations,
    visibilityKey,
  } = useDataTable({
    tableId,
    tableType,
  });

  // Use provided data for advanced filters if available, otherwise use fetched data
  const baseData = providedData || data || [];

  // Add DEBUG flag for development
  const DEBUG = false;

  // Configure advanced filters
  const { finalData, advancedFiltersConfig } = useAdvancedFiltersSetup({
    enableAdvancedFilters,
    config,
    columnTypeMapping,
    baseData,
    tableId,
  });

  if (DEBUG) {
    console.log('Advanced filters config:', advancedFiltersConfig);
  }

  // Get the title and description from config or props
  const { TitleComponent, DescriptionComponent } = useTableComponents();
  const displayTitle =
    title || config.translations?.keys?.title || `${tableType} Table`;
  const displayDescription =
    description ||
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
            defaultPageSize: config.table.defaultPageSize || 10,
            enableColumnDragDropByDefault:
              config.table.enableColumnDragDropByDefault,
            enableColumnFilters: config.table.enableColumnFilters,
            enableMultiRowSelection: true,
            enablePagination: true,
            enableRowSelection: config.table.enableRowSelection,
            enableSorting: config.table.enableSorting,
            manualFiltering: config.table.manualFiltering,
            manualPagination: config.table.manualPagination,
            manualSorting: config.table.manualSorting,
            pageSizeOptions: config.table.pageSizeOptions || [5, 10, 20, 50],
          }}
          tableId={tableId}
          translations={translations}
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
                  columns as import('@tanstack/react-table').ColumnDef<
                    Record<string, unknown>
                  >[]
                }
                data={finalData}
                enableColumnDragDropByDefault={
                  config.table.enableColumnDragDropByDefault
                }
                enableColumnFilters={config.table.enableColumnFilters}
                enableMultiRowSelection={true}
                enablePagination={true}
                enableRowSelection={config.table.enableRowSelection}
                enableSorting={config.table.enableSorting}
                key={`${tableId}-${visibilityKey}`}
                manualFiltering={config.table.manualFiltering}
                manualPagination={config.table.manualPagination}
                manualSorting={config.table.manualSorting}
                onRowSelectionChange={onRowSelectionChange}
                queryFn={async (_params) => {
                  // We need to wrap the refresh function to match the expected signature
                  await refetch();
                  // Return the current data to avoid flickering
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
