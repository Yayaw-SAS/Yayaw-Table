/**
 * New DataTable component using the declarative architecture
 * This component replaces the old DataTable with a more streamlined API
 */
'use client';

import type { Row } from '@tanstack/react-table';
import dynamic from 'next/dynamic';
// Import advanced filters hook directly
import { Suspense } from 'react';
import { useDataTable } from '../hooks/use-data-table';

import { DataTableUIProvider } from '../providers/data-table-ui-provider';
import { useTableComponents } from '../providers/table-provider';
import { DataTableSkeleton } from './data-table-skeleton';

// Import DataTableClient directly for better SSR compatibility
import { DataTable as DataTableClient } from './modern-data-table';

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

// Import direct pour déboguer (au lieu de dynamic)
import { DataTableAdvancedToolbar } from './toolbar/data-table-advanced-toolbar';

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

// Helper hook for creating column options (removed as unused)

// Hook removed - advanced filters are now handled directly in DataTableAdvancedToolbar

/**
 * DataTable component with declarative configuration
 * This component uses the table catalogue to configure itself
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Main table component with complex configuration logic
export function DataTable({
  className,
  enableToolbar = true,
  onRowSelectionChange,
  onBulkEdit,
  onBulkDelete,
  onBulkCopy,
  tableType,
  title,
  description,
  enableAdvancedFilters = false,
  columnTypeMapping = {},
}: {
  className?: string;
  enableToolbar?: boolean;
  onRowSelectionChange?: (rows: Row<Record<string, unknown>>[]) => void;
  onBulkEdit?: (rows: Row<Record<string, unknown>>[]) => void;
  onBulkDelete?: (rows: Row<Record<string, unknown>>[]) => void;
  onBulkCopy?: (rows: Row<Record<string, unknown>>[]) => void;
  tableType: string; // Required
  title?: string;
  description?: string;
  /** Whether to enable advanced filtering */
  enableAdvancedFilters?: boolean;
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

  // Use fetched data from API
  const baseData = data || [];

  // Add DEBUG flag for development
  const DEBUG = false;

  if (DEBUG) {
    console.log('🔍 DataTable Debug:', {
      'fetched data length': data?.length || 0,
      'baseData length': baseData.length,
      rowCount,
      tableType,
      'columns length': columns?.length || 0,
    });
  }

  // Use baseData directly since filtering is handled by the API and DataTableAdvancedToolbar
  const finalData = baseData;

  if (DEBUG) {
    console.log('🔍 DataTable Debug Info:', {
      'baseData length': baseData.length,
      'finalData length': finalData.length,
      'columns length': columns?.length || 0,
      isLoading,
      rowCount,
      config,
      'first baseData item': baseData[0],
    });
  }

  if (DEBUG) {
    if (isLoading) {
      console.log('🔄 Table is loading - showing skeleton');
    } else {
      console.log('🚀 Table ready - rendering DataTableClient with:', {
        'finalData length': finalData.length,
        'columns available': !!columns,
        'columns length': columns?.length,
        'first column': columns?.[0],
        visibilityKey,
      });
    }
  }

  // Debug logs for advanced filters removed since configuration is now handled in DataTableAdvancedToolbar

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
                enableColumnDragDropByDefault={false}
                enableColumnFilters={config.table.enableColumnFilters}
                enableGrouping={config.table.enableGrouping}
                enableMultiRowSelection={true}
                enablePagination={true}
                enableRowSelection={config.table.enableRowSelection}
                enableSorting={config.table.enableSorting}
                key={`${tableId}-${visibilityKey}`}
                manualFiltering={config.table.manualFiltering}
                manualPagination={config.table.manualPagination}
                manualSorting={config.table.manualSorting}
                onBulkCopy={onBulkCopy}
                onBulkDelete={onBulkDelete}
                onBulkEdit={onBulkEdit}
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

// Simple toolbar component removed as unused
