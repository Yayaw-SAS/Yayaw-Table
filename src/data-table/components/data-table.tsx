/**
 * New DataTable component using the declarative architecture
 * This component replaces the old DataTable with a more streamlined API
 */
"use client"

import type { Row } from "@tanstack/react-table"
import dynamic from "next/dynamic"
import { Suspense } from "react"

import { useDataTable } from "../hooks/use-data-table"
import { DataTableUIProvider } from "../providers/data-table-ui-provider"

import { DataTableSkeleton } from "./data-table-skeleton"
import { useTranslations, useTableComponents } from "../providers/table-provider"

// Dynamically import the DataTableClient component with no SSR
// This ensures it's only rendered on the client side to avoid hydration issues
const DataTableClient = dynamic(
    () =>
        import("./modern-data-table").then((mod) => ({
            default: mod.DataTable
        })),
    {
        loading: () => <DataTableSkeleton />,
        ssr: false
    }
)
import { CatalogueFormContainer } from "./forms/catalogue-form-container"
import { DataTableAdvancedToolbar } from "./toolbar/data-table-advanced-toolbar"

// Default UI components
function DefaultTableTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={`text-xl font-semibold text-foreground ${className || ''}`}>
      {children}
    </h2>
  )
}

function DefaultTableDescription({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`text-sm text-muted-foreground ${className || ''}`}>
      {children}
    </p>
  )
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
    columnTypeMapping = {}
}: {
    className?: string
    enableToolbar?: boolean
    onRowSelectionChange?: (rows: Row<Record<string, unknown>>[]) => void
    tableType: string // Required
    title?: string
    description?: string
    /** Whether to enable advanced filtering */
    enableAdvancedFilters?: boolean
    /** Data for advanced filtering (optional, if not provided, will be fetched) */
    data?: Record<string, unknown>[]
    /** Column type mapping for advanced filters */
    columnTypeMapping?: Record<string, 'text' | 'number' | 'date' | 'option' | 'multiOption'>
}) {
    // Utiliser directement le tableType comme tableId
    const tableId = tableType

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
        visibilityKey
    } = useDataTable({
        tableId,
        tableType
    })

    // Use provided data for advanced filters if available, otherwise use fetched data
    const finalData = providedData || data || []

    // Get the title and description from config or props
    const { t } = useTranslations()
    const { TitleComponent, DescriptionComponent } = useTableComponents()
    const displayTitle = title || config.translations?.keys?.title || `${tableType} Table`
    const displayDescription = description || config.translations?.keys?.description || `Manage your ${tableType}`

    // Use custom components if provided, otherwise use defaults
    const Title = TitleComponent || DefaultTableTitle
    const Description = DescriptionComponent || DefaultTableDescription

    return (
        <>
            <Suspense fallback={<DataTableSkeleton />}>
                <DataTableUIProvider
                    columnsConfig={{
                        defaultColumnOrder: config.columns.order || [],
                        defaultSort: config.columns.sort || [],
                        defaultVisibleColumns: config.columns.visible || [],
                        mandatoryColumns: config.columns.mandatory || []
                    }}
                    tableConfig={{
                        defaultPageSize: config.table.defaultPageSize || 10,
                        enableColumnDragDropByDefault: config.table.enableColumnDragDropByDefault || false,
                        enableColumnFilters: config.table.enableColumnFilters,
                        enableMultiRowSelection: config.table.enableMultiRowSelection || true,
                        enablePagination: config.table.enablePagination || true,
                        enableRowSelection: config.table.enableRowSelection,
                        enableSorting: config.table.enableSorting,
                        manualFiltering: config.table.manualFiltering,
                        manualPagination: config.table.manualPagination,
                        manualSorting: config.table.manualSorting,
                        pageSizeOptions: config.table.pageSizeOptions || [5, 10, 20, 50]
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
                                            tableId={tableId}
                                            enableAdvancedFilters={enableAdvancedFilters}
                                            data={finalData}
                                            columnTypeMapping={columnTypeMapping}
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
                                key={`${tableId}-${visibilityKey}`}
                                className={className}
                                columns={
                                    columns as Array<
                                        import("@tanstack/react-table").ColumnDef<
                                            Record<string, unknown>
                                        >
                                    >
                                }
                                data={finalData}
                                enableColumnDragDropByDefault={
                                    config.table.enableColumnDragDropByDefault || false
                                }
                                enableColumnFilters={config.table.enableColumnFilters}
                                enableMultiRowSelection={config.table.enableMultiRowSelection || true}
                                enablePagination={config.table.enablePagination || true}
                                enableRowSelection={config.table.enableRowSelection}
                                enableSorting={config.table.enableSorting}
                                manualFiltering={config.table.manualFiltering}
                                manualPagination={config.table.manualPagination}
                                manualSorting={config.table.manualSorting}
                                onRowSelectionChange={onRowSelectionChange}
                                queryFn={async (params) => {
                                    // We need to wrap the refresh function to match the expected signature
                                    await refetch()
                                    // Return the current data to avoid flickering
                                    return {
                                        data: finalData,
                                        pageCount: pageCount || 1,
                                        rowCount: rowCount || finalData.length
                                    }
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
    )
}
