/**
 * Advanced toolbar component for DataTable
 * Provides advanced filtering, view management, and other table controls
 */
"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
// Import table configuration
import { useQueryClient } from "@tanstack/react-query"
import type {
    ColumnDef,
    ColumnFiltersState,
    ColumnSizingState,
    GroupingState,
    SortingState,
    Table,
    VisibilityState
} from "@tanstack/react-table"
import { useSetAtom } from "jotai"
import { PlusIcon, Search } from "lucide-react"
import { useTranslations, useTableConfig } from "../../providers/table-provider"
import { useCallback, useMemo } from "react"

import { useDataTable } from "../../hooks/use-data-table"
import { useDataTableAdvancedFilters, useColumnConfigFromTableColumns, useTableAccessors } from "../../hooks/use-data-table-advanced-filters"
import { useTableInstance } from "../../hooks/use-table-instance"
import { catalogueFormAtom, openCreateForm } from "../forms/atoms/catalogue-form-atoms"

import { TableMenu } from "./table-menu"

// Debug flag to help track issues - activated for debugging
const DEBUG = true

// Define DataTableColumnDef type to fix TypeScript errors
export type DataTableColumnDef<TData> = ColumnDef<TData> & {
    enableHiding?: boolean
    meta?: {
        label?: string
    }
}

/**
 * Props for the DataTableAdvancedToolbar component - DEPRECATED: use only tableId
 */
interface DataTableAdvancedToolbarProps<TData = Record<string, unknown>> {
    /**
     * CSS class name
     */
    className?: string

    /**
     * Column filters state
     */
    columnFilters?: ColumnFiltersState

    /**
     * Available columns with their metadata
     */
    columns?: {
        canFilter?: boolean
        canGroup?: boolean
        canHide?: boolean
        canSort?: boolean
        id: string
        label: string
    }[]

    /**
     * Column visibility state
     */
    columnVisibility?: VisibilityState

    /**
     * Grouping state
     */
    grouping?: GroupingState

    /**
     * Whether to hide the global filter
     */
    hideGlobalFilter?: boolean

    /**
     * Whether to hide the menu
     */
    hideMenu?: boolean

    /**
     * Whether to hide view options
     */
    hideViewOptions?: boolean

    /**
     * Menu button props
     */
    menuButtonProps?: Record<string, unknown>

    /**
     * Function to set column filters
     */
    setColumnFilters?: (state: ColumnFiltersState) => void

    /**
     * Function to set column visibility
     */
    setColumnVisibility?: (state: VisibilityState) => void

    /**
     * Function to set grouping
     */
    setGrouping?: (state: GroupingState) => void

    /**
     * Function to set sorting
     */
    setSorting?: (state: SortingState) => void

    /**
     * Sorting state
     */
    sorting?: SortingState

    /**
     * Table instance
     */
    table?: Table<Record<string, unknown>>

    /**
     * Table ID for identifying which table this toolbar controls
     */
    tableId: string

    /**
     * View options
     */
    viewOptions?: Record<string, unknown>

    /**
     * Whether to enable advanced filtering
     */
    enableAdvancedFilters?: boolean

    /**
     * Data for advanced filtering (optional, if not provided, will be fetched)
     */
    data?: Record<string, unknown>[]

    /**
     * Column type mapping for advanced filters
     */
    columnTypeMapping?: Record<string, 'text' | 'number' | 'date' | 'option' | 'multiOption'>
}

// Define DataTableState type to handle state properties
interface DataTableState {
    columnFilters?: ColumnFiltersState
    columns?: Array<Record<string, unknown>>
    columnVisibility?: VisibilityState
    grouping?: GroupingState
    sorting?: SortingState
}

/**
 * Advanced toolbar component for DataTable
 * Combines search, filters, view management, and column visibility controls
 */
export function DataTableAdvancedToolbar<TData>({
    className,
    hideGlobalFilter,
    hideMenu,
    hideViewOptions,
    menuButtonProps,
    table,
    viewOptions,
    enableAdvancedFilters = false,
    data = [],
    columnTypeMapping = {},
    ...props
}: DataTableAdvancedToolbarProps<TData>) {
    // Ensure tableId is available
    const tableId = props.tableId || "default"

    // Get the configuration helpers from the provider
    const getTableConfig = useTableConfig()
    const { t } = useTranslations()

    const state = useDataTable({
        tableType: tableId
    }) as unknown as DataTableState

    // Advanced filters setup
    const columnOptions = useMemo(() => {
        if (DEBUG) {
            console.log("🔧 TABLE DEBUG:")
            console.log("🔧 table instance:", !!table)
            console.log("🔧 table:", table)
        }
        
        if (!table) {
            if (DEBUG) {
                console.warn("DataTableAdvancedToolbar - No table instance provided")
            }
            return []
        }

        const allColumns = table.getAllColumns()
        if (DEBUG) {
            console.log("🔧 table.getAllColumns():", allColumns)
            console.log("🔧 allColumns length:", allColumns.length)
        }

        const options = allColumns.map((column) => {
            const columnDef = column.columnDef as DataTableColumnDef<TData>
            const option = {
                canFilter: column.getCanFilter(),
                canHide: columnDef.enableHiding !== false,
                id: column.id,
                label: columnDef.meta?.label || column.id
            }
            
            if (DEBUG) {
                console.log("🔧 Column:", column.id, "->", option)
            }
            
            return option
        })

        if (DEBUG) {
            console.log("DataTableAdvancedToolbar - Column options:", options)
        }
        return options
    }, [table])

    // Create advanced columns configuration from table columns
    const advancedColumnsConfig = useColumnConfigFromTableColumns(
        columnOptions,
        columnTypeMapping
    )

    // Create accessors for advanced filtering
    const accessors = useTableAccessors(
        data,
        columnOptions.map(col => col.id)
    )

    if (DEBUG) {
        console.log("🔧 ADVANCED CONFIG DEBUG:")
        console.log("🔧 columnOptions:", columnOptions)
        console.log("🔧 columnTypeMapping:", columnTypeMapping)
        console.log("🔧 advancedColumnsConfig:", advancedColumnsConfig)
        console.log("🔧 accessors:", accessors)
    }

    // Set up advanced filters if enabled
    const advancedFiltersResult = useDataTableAdvancedFilters({
        tableType: tableId,
        strategy: 'client',
        data,
        advancedColumnsConfig,
        accessors,
        autoComputeFaceted: true
    })

    if (DEBUG) {
        console.log("DataTableAdvancedToolbar - state:", state)
        console.log("DataTableAdvancedToolbar - table initialized:", !!table)
        console.log("DataTableAdvancedToolbar - advanced filters enabled:", enableAdvancedFilters)
        console.log("DataTableAdvancedToolbar - advanced filters count:", advancedFiltersResult.activeAdvancedFiltersCount)
        console.log("DataTableAdvancedToolbar - advancedColumnsConfig:", advancedColumnsConfig)
        console.log("DataTableAdvancedToolbar - data length:", data.length)
        console.log("DataTableAdvancedToolbar - advanced filters:", advancedFiltersResult.advancedFilters)
    }

    // Get final columns
    const finalColumns = useMemo(() => {
        if (DEBUG) {
            console.log("DataTableAdvancedToolbar - Computing finalColumns, state:", state)
        }
        return state?.columns ?? columnOptions
    }, [columnOptions, state])

    if (DEBUG) {
        console.log("DataTableAdvancedToolbar - finalColumns:", finalColumns)
    }

    // Get final column visibility
    const finalColumnVisibility = useMemo(() => {
        if (!table) return {}
        return state?.columnVisibility ?? table.getState().columnVisibility
    }, [state?.columnVisibility, table])

    if (DEBUG) {
        console.log("DataTableAdvancedToolbar - finalColumnVisibility:", finalColumnVisibility)
    }

    // QueryClient for invalidating queries
    const queryClient = useQueryClient()

    // Use data table hook to get all table state
    const {
        setColumnFilters,
        setColumnVisibility: dataTableSetColumnVisibility,
        setGrouping,
        setSorting
    } = useDataTable({
        tableType: tableId
    })

    // Create a table instance to use with the TableMenu
    const tableInstance = useTableInstance({
        columns: [], // Empty columns since we only need the table structure for the menu
        data: [],
        tableId: tableId
    })

    // Use props if provided (for backwards compatibility) or values from useDataTable
    const finalColumnFilters = props.columnFilters || state?.columnFilters || []
    const finalGrouping = props.grouping || state?.grouping || []
    const finalSetColumnFilters = props.setColumnFilters || setColumnFilters

    // Specific handler for column visibility with debugging
    const finalSetColumnVisibility = useCallback(
        (value: VisibilityState) => {
            if (DEBUG) {
                console.log("DataTableAdvancedToolbar - Setting column visibility to:", value)
            }

            try {
                // Use the provided setter from props if available, otherwise use the one from useDataTable
                if (props.setColumnVisibility) {
                    props.setColumnVisibility(value)
                } else if (dataTableSetColumnVisibility) {
                    dataTableSetColumnVisibility(value)
                } else {
                    console.warn(
                        "DataTableAdvancedToolbar - No column visibility setter function available"
                    )
                }
            } catch (error) {
                console.error("Error setting column visibility:", error)
            }
        },
        [props.setColumnVisibility, dataTableSetColumnVisibility]
    )

    const finalSetGrouping = props.setGrouping || setGrouping
    const finalSetSorting = props.setSorting || setSorting
    const finalSorting = props.sorting || state?.sorting || []

    // Get the setter for the form state atom
    const setFormState = useSetAtom(catalogueFormAtom)

    // Get table configuration directly using tableId
    const tableConfig = getTableConfig?.(tableId)

    // Count active filters
    const activeFiltersCount = finalColumnFilters.length

    // Convert finalColumns to the format expected by TableMenu
    const tableMenuColumns = Array.isArray(finalColumns)
        ? finalColumns.map((col) => {
              // Handle both types: Record<string, unknown> and specific column type
              const isSpecificColumnType = col && typeof col === "object" && "canFilter" in col

              return {
                  canFilter: isSpecificColumnType
                      ? ((col as { canFilter?: boolean }).canFilter ?? false)
                      : false,
                  canGroup: isSpecificColumnType
                      ? ((col as { canGroup?: boolean }).canGroup ?? false)
                      : false,
                  canHide: isSpecificColumnType
                      ? (col as { canHide?: boolean }).canHide !== false
                      : true,
                  canSort: isSpecificColumnType
                      ? ((col as { canSort?: boolean }).canSort ?? false)
                      : false,
                  id: (col as { id?: string }).id || "",
                  label:
                      (col as { label?: string }).label || (col as { id?: string }).id || "Column"
              }
          })
        : []

    if (DEBUG) {
        console.log("DataTableAdvancedToolbar - tableMenuColumns:", tableMenuColumns)
        console.log(
            "DataTableAdvancedToolbar - finalColumnVisibility state:",
            finalColumnVisibility
        )
    }

    return (
        <div className="flex items-center gap-2">
            {/* Create button */}
            <Button
                onClick={() => {
                    // Set the form state to open the create form
                    // Use tableId directly as the form type since they're now identical
                    setFormState(
                        openCreateForm(tableId, tableId, (data) => {
                            // Invalidate the table data query to refresh the table after successful submission
                            queryClient.invalidateQueries({
                                queryKey: ["tableData", tableId]
                            })
                        })
                    )
                }}
                size="sm"
                variant="default"
            >
                <PlusIcon className="mr-2 h-4 w-4" />
                <span>{t("add_an_item")}</span>
            </Button>

            {/* Search bar */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    placeholder="Search..."
                    className="pl-9 h-8 w-64"
                />
            </div>

            {/* Options menu */}
            <TableMenu
                columns={tableMenuColumns}
                invalidateTable={async () => {
                    await queryClient.invalidateQueries({
                        queryKey: ["tableData", tableId]
                    })
                }}
                setColumnFilters={finalSetColumnFilters}
                setColumnVisibility={finalSetColumnVisibility}
                setGrouping={finalSetGrouping}
                setSorting={finalSetSorting}
                state={{
                    columnFilters: finalColumnFilters as ColumnFiltersState,
                    columnOrder: [],
                    columnPinning: { left: [], right: [] },
                    columnSizing: {} as ColumnSizingState,
                    columnSizingInfo: {
                        columnSizingStart: [],
                        deltaOffset: 0,
                        deltaPercentage: 0,
                        isResizingColumn: false,
                        startOffset: 0,
                        startSize: 0
                    },
                    columnVisibility: finalColumnVisibility as VisibilityState,
                    expanded: {},
                    globalFilter: "",
                    grouping: finalGrouping as GroupingState,
                    pagination: { pageIndex: 0, pageSize: 10 },
                    rowPinning: { bottom: [], top: [] },
                    rowSelection: {},
                    sorting: finalSorting as SortingState
                }}
                tableId={tableId}
                useAdvancedFilters={enableAdvancedFilters}
                advancedFiltersConfig={enableAdvancedFilters ? {
                    filters: advancedFiltersResult.advancedFilters,
                    actions: advancedFiltersResult.advancedActions,
                    columnsConfig: advancedColumnsConfig,
                    onConvertToAdvanced: advancedFiltersResult.convertLegacyToAdvanced
                } : undefined}
            />
        </div>
    )
}
