/**
 * Main hook for data tables
 * Combines configuration, data fetching, and actions in a single hook
 */
"use client"

import { useQueryClient } from "@tanstack/react-query"
import {
    type ColumnDef,
    type ColumnFilter,
    type ColumnSort,
    type OnChangeFn,
    type PaginationState,
    type VisibilityState,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable
} from "@tanstack/react-table"
import { useTranslations, useTableActions, useTableConfig } from "../providers/table-provider"
import type * as React from "react"
import { useCallback, useMemo } from "react"

import type { ActionsColumnProps } from "../components/columns/actions-column"
import { useColumns } from "../components/columns/hooks/use-columns"
import { useTableTranslations } from "./use-table-translations"
import { useTableUrlData } from "./use-table-url-data"
import { useTableUrlState } from "./use-table-url-state"

const DEBUG = false

/**
 * Configuration for table columns in the catalogue
 */
interface TableCatalogueColumnConfig {
    id: string
    type: string
    header: string
    enableSorting?: boolean
    typeKey?: string
    customRenderers?: Record<string, (value: unknown) => React.ReactNode>
}

/**
 * Configuration for table behavior in the catalogue
 */
interface TableCatalogueTableConfig {
    enableRowSelection: boolean
    enableColumnFilters: boolean
    enableSorting: boolean
    manualFiltering: boolean
    manualPagination: boolean
    manualSorting: boolean
    enableColumnDragDropByDefault?: boolean
    enableMultiRowSelection?: boolean
    enablePagination?: boolean
    defaultPageSize?: number
    pageSizeOptions?: number[]
}

/**
 * Full configuration for a table type in the catalogue
 */
interface TableCatalogueConfig {
    table: TableCatalogueTableConfig
    columns: {
        definitions: TableCatalogueColumnConfig[]
        order?: string[]
        sort?: ColumnSort[]
        visible?: string[]
        mandatory?: string[]
    }
    translations?: {
        namespace: string
        keys: Record<string, string>
    }
}

/**
 * Options for the useDataTable hook
 */
export interface UseDataTableOptions {
    /**
     * Whether to enable data fetching
     * Defaults to true
     */
    enabled?: boolean

    /**
     * Initial page size
     * Defaults to 10
     */
    initialPageSize?: number

    /**
     * Unique identifier for this table instance
     * Defaults to tableType if not provided
     */
    tableId?: string

    /**
     * Type of table to use (corresponds to a key in the table catalogue)
     */
    tableType: string
}

/**
 * Main hook for data tables
 * @param options Configuration options
 * @returns Everything needed to render a data table
 */
export function useDataTable<TData extends Record<string, unknown>>(options: UseDataTableOptions) {
    const { enabled = true, initialPageSize = 10, tableType, tableId = tableType } = options

    // Get QueryClient instance
    const queryClient = useQueryClient()

    // Get configuration and actions helpers from the provider
    const getTableConfig = useTableConfig()
    const getTableActions = useTableActions()
    const { t } = useTranslations()

    // Get table configuration and actions - use type assertion for now
    const config = useMemo(() => {
        const tableConfig = getTableConfig?.(tableType) as TableCatalogueConfig | undefined
        if (!tableConfig) {
            // Return a default configuration if none found
            return {
                table: {
                    enableRowSelection: true,
                    enableColumnFilters: true,
                    enableSorting: true,
                    manualFiltering: false,
                    manualPagination: false,
                    manualSorting: false,
                    enableColumnDragDropByDefault: false,
                    enableMultiRowSelection: true,
                    enablePagination: true,
                    defaultPageSize: 10,
                    pageSizeOptions: [5, 10, 20, 50]
                },
                columns: {
                    definitions: [],
                    order: [],
                    sort: [],
                    visible: [],
                    mandatory: []
                },
                translations: {
                    namespace: "common",
                    keys: {}
                }
            } as TableCatalogueConfig
        }
        return tableConfig
    }, [getTableConfig, tableType])

    const actions = useMemo(() => {
        const tableActions = getTableActions?.(tableType)
        if (!tableActions) {
            // Return empty actions if none found
            return {
                list: async () => ({ data: [], meta: { pageCount: 0, totalCount: 0 } })
            }
        }
        return tableActions
    }, [getTableActions, tableType])

    // Get translations
    const baseTranslations = useTableTranslations()

    // Create translations object
    const translations = useMemo(() => {
        if (!config.translations?.keys) {
            return baseTranslations
        }
        
        return {
            ...baseTranslations,
            ...Object.entries(config.translations.keys).reduce(
                (acc, [key, value]) => {
                    // Use the main t function for translation keys
                    acc[key] = t(value)
                    return acc
                },
                {} as Record<string, string>
            )
        }
    }, [baseTranslations, config.translations?.keys, t])

    // Set up URL state for the table
    const tableUrlState = useTableUrlState({ tableId })

    // Create a function to invalidate table data
    const invalidateTable = useCallback(async () => {
        await queryClient.invalidateQueries({
            queryKey: ["tableData", tableId]
        })
    }, [queryClient, tableId])

    // Create query function
    const queryFn = useCallback(
        async (params: Record<string, unknown>) => {
            const { columnFilters, complexFilters, pagination, sorting } = params

            // Type the pagination object properly
            const paginationTyped = pagination as
                | { pageSize?: number; pageIndex?: number }
                | undefined

            try {
                if (DEBUG) {
                    console.log("Fetching data for table type:", tableType)
                    console.log("Actions available:", Object.keys(actions))
                    console.log("Query params:", {
                        columnFilters,
                        complexFilters,
                        pagination,
                        sorting
                    })
                }

                // Build proper orderBy parameter for Prisma
                let orderBy = undefined
                if (Array.isArray(sorting) && sorting.length > 0) {
                    const sortField = sorting[0].id
                    const sortDirection = sorting[0].desc ? "desc" : "asc"
                    orderBy = { [sortField]: sortDirection }
                    if (DEBUG) {
                        console.log("Adding orderBy to request:", orderBy)
                    }
                }

                // Type the column filters properly
                const columnFiltersTyped = (columnFilters || []) as Array<{
                    id: string
                    value: unknown
                }>

                // Create a clean filters object without any key-specific filters
                const cleanedFilters = Object.fromEntries(
                    columnFiltersTyped
                        .filter(
                            (filter: { id: string; value: unknown }) =>
                                !["id", "key"].includes(filter.id)
                        )
                        .map((filter: { id: string; value: unknown }) => [filter.id, filter.value])
                )

                // Prepare base request parameters
                const requestParams = {
                    filters: cleanedFilters,
                    limit: paginationTyped?.pageSize || 10,
                    orderBy,
                    page: (paginationTyped?.pageIndex || 0) + 1
                }

                if (DEBUG) {
                    console.log("Request params:", requestParams)
                }

                // Execute the request - safely handle the list action
                if (actions.list) {
                const response = await actions.list(requestParams)

                if (DEBUG) {
                    console.log("Server response:", response)
                }

                return {
                        data: (response.data || []) as TData[],
                    pageCount: response.meta?.pageCount || 1,
                    rowCount: response.meta?.totalCount || response.data?.length || 0
                    }
                } else {
                    console.warn(`No list action available for table type: ${tableType}`)
                    return { data: [] as TData[], pageCount: 0, rowCount: 0 }
                }
            } catch (error) {
                console.error(`Error fetching ${tableType}:`, error)
                return { data: [] as TData[], pageCount: 0, rowCount: 0 }
            }
        },
        [actions, tableType]
    )

    // Use the tableUrlData hook to manage data fetching and state
    const {
        data,
        error,
        isError,
        isLoading,
        refetch: baseRefetch,
        rowCount,
        rowSelection,
        setRowSelection
    } = useTableUrlData<TData>({
        enabled,
        initialData: [], // Provide empty array as initial data to avoid undefined issues
        queryFn,
        tableId
    })

    // Get table state from URL parameters with proper type assertions
    const columnFilters = (tableUrlState.filtersParam || []) as ColumnFilter[]
    const columnOrder = (tableUrlState.orderParam || []) as string[]
    const columnVisibility = (tableUrlState.visibilityParam || {}) as VisibilityState
    const sorting = (tableUrlState.sortParam || []) as ColumnSort[]
    const { pagination } = tableUrlState

    // Enhanced refetch function that resets pagination and invalidates queries
    const enhancedRefetch = useCallback(async () => {
        tableUrlState.setPageParam("0")
        await invalidateTable()
        await baseRefetch()
    }, [tableUrlState, invalidateTable, baseRefetch])

    // Create action handlers
    const handleCreate = useCallback(
        async (data: Partial<TData>) => {
            if (!actions.create) {
                console.error(`Create action not available for ${tableType}`)
                return false
            }

            try {
                const result = await actions.create(data)

                if (!result.success) {
                    console.error(`Failed to create ${tableType}:`, result.error)
                    return false
                }

                // Refresh data
                await enhancedRefetch()
                return true
            } catch (error) {
                console.error(`Error creating ${tableType}:`, error)
                return false
            }
        },
        [actions, enhancedRefetch, tableType]
    )

    const handleEdit = useCallback(
        async (row: TData & { id: string }, data: Partial<TData>) => {
            if (!actions.update) {
                console.error(`Update action not available for ${tableType}`)
                return false
            }

            try {
                const result = await actions.update(row.id, data)

                if (!result.success) {
                    console.error(`Failed to update ${tableType}:`, result.error)
                    return false
                }

                // Refresh data
                await enhancedRefetch()
                return true
            } catch (error) {
                console.error(`Error updating ${tableType}:`, error)
                return false
            }
        },
        [actions, enhancedRefetch, tableType]
    )

    const handleDelete = useCallback(
        async (row: TData & { id: string }) => {
            if (!actions.delete) {
                console.error(`Delete action not available for ${tableType}`)
                return false
            }

            try {
                const result = await actions.delete(row.id)

                if (!result.success) {
                    console.error(`Failed to delete ${tableType}:`, result.error)
                    return false
                }

                // Refresh data
                await enhancedRefetch()
                return true
            } catch (error) {
                console.error(`Error deleting ${tableType}:`, error)
                return false
            }
        },
        [actions, enhancedRefetch, tableType]
    )

    // Use our columns hook to define columns in a modular way
    const { column, createColumns } = useColumns<TData>({
        enableSelection: config.table.enableRowSelection,
        tableId
    })

    // Create a safe translation helper
    const getTranslationSafe = useCallback((key: string): string => {
        // Try to use the t function first for any translation key
        try {
            return t(key)
        } catch {
            // If that fails, return the key itself as fallback
            return key
        }
    }, [t])

    // Create columns based on configuration
    const columns = useMemo(() => {
        const columnDefs: Array<ColumnDef<TData>> = []

        // Add selection column if enabled
        if (config.table.enableRowSelection) {
            // Use the selection column from the columns hook
            columnDefs.push(column.selection())
        }

        // Add columns from configuration
        for (const colDef of config.columns.definitions) {
            switch (colDef.type) {
                case "actions":
                    columnDefs.push(
                        column.actions({
                            header: t("actions.title"),
                            includeDelete: true,
                            includeEdit: true,
                            onDelete: async (row: TData) => {
                                return await handleDelete(row as TData & { id: string })
                            },
                            onEdit: async (row: TData) => {
                                return await handleEdit(row as TData & { id: string }, {})
                            },
                            onRefresh: async () => {
                                await enhancedRefetch()
                            },
                            tableId: tableId
                        } as ActionsColumnProps<TData>)
                    )
                    break
                case "boolean":
                    columnDefs.push(
                        column.boolean(colDef.id as keyof TData, {
                            enableSorting: colDef.enableSorting,
                            header: getTranslationSafe(colDef.header)
                        })
                    )
                    break
                case "code":
                    columnDefs.push(
                        column.code(colDef.id as keyof TData, {
                            enableSorting: colDef.enableSorting,
                            header: getTranslationSafe(colDef.header)
                        })
                    )
                    break
                case "date":
                    columnDefs.push(
                        column.date(colDef.id as keyof TData, {
                            enableSorting: colDef.enableSorting,
                            header: getTranslationSafe(colDef.header)
                        })
                    )
                    break
                case "dynamicType":
                    // Use dynamic type column that renders based on the type in the specified typeKey
                    columnDefs.push(
                        column.dynamicType(
                            colDef.id as keyof TData,
                            colDef.typeKey as keyof TData,
                            {
                                // Pass any custom renderers if defined (with proper typing)
                                customRenderers: colDef.customRenderers as
                                    | Record<string, (value: unknown) => React.ReactNode>
                                    | undefined,
                                enableSorting: colDef.enableSorting,
                                header: getTranslationSafe(colDef.header)
                            }
                        )
                    )
                    break
                case "number":
                    // Use number column for proper number formatting
                    columnDefs.push(
                        column.number(colDef.id as keyof TData, {
                            enableSorting: colDef.enableSorting,
                            header: getTranslationSafe(colDef.header)
                        })
                    )
                    break
                case "tag":
                    columnDefs.push(
                        column.tag(colDef.id as keyof TData, {
                            enableSorting: colDef.enableSorting,
                            header: getTranslationSafe(colDef.header)
                        })
                    )
                    break
                case "text":
                    columnDefs.push(
                        column.text(colDef.id as keyof TData, {
                            enableSorting: colDef.enableSorting,
                            header: getTranslationSafe(colDef.header)
                        })
                    )
                    break
                // Add more column types as needed
                default:
                    // Default to text column
                    columnDefs.push(
                        column.text(colDef.id as keyof TData, {
                            enableSorting: colDef.enableSorting,
                            header: getTranslationSafe(colDef.header)
                        })
                    )
            }
        }

        // Add actions column if not already added
        if (!columnDefs.some((col) => "id" in col && col.id === "actions")) {
            columnDefs.push(
                column.actions({
                    header: t("actions.title"),
                    includeDelete: true,
                    includeDuplicate: !!actions.duplicate,
                    includeEdit: true,
                    includeView: true,
                    onDelete: async (row: TData) => {
                        return await handleDelete(row as TData & { id: string })
                    },
                    onDuplicate: actions.duplicate
                        ? async (row: TData) => {
                              try {
                                  if (!actions.duplicate) {
                                      throw new Error(
                                          `Duplicate action not available for ${tableType}`
                                      )
                                  }

                                  const result = await actions.duplicate(
                                      (row as TData & { id: string }).id
                                  )
                                  await enhancedRefetch()
                                  return result.success
                              } catch (error) {
                                  console.error("Failed to duplicate row:", error)
                                  return false
                              }
                          }
                        : undefined,
                    onEdit: async (row: TData) => {
                        return await handleEdit(row as TData & { id: string }, {})
                    },
                    onRefresh: async () => {
                        await enhancedRefetch()
                    },
                    onView: async (row: TData) => {
                        // Placeholder for view action - to be implemented later
                        if (DEBUG) {
                            console.log(
                                `View action triggered for ${tableType} with ID:`,
                                (row as TData & { id: string }).id
                            )
                        }
                        // We'll return true to indicate success even though we're not doing anything yet
                        return true
                    },
                    tableId: tableId
                } as ActionsColumnProps<TData>)
            )
        }

        return createColumns(columnDefs)
    }, [
        column,
        config.columns.definitions,
        config.table.enableRowSelection,
        createColumns,
        enhancedRefetch,
        t,
        getTranslationSafe,
        actions.duplicate,
        tableType,
        handleDelete,
        handleEdit,
        tableId
    ])

    // Create formatted column metadata for the TableOptionsMenu
    const columnOptions = useMemo(() => {
        return columns.map((col) => {
            const colDef = col as ColumnDef<TData>
            let label: string

            // Simplified header handling - just use the ID or a default label
            if (colDef.id === "select") {
                label = "Selection"
            } else if (colDef.id === "actions") {
                label = "Actions"
            } else {
                // For other columns, use the ID as the label
                label = colDef.id || "Column"
            }

            return {
                canFilter: true, // Default to true, actual filtering capability is handled by the column implementation
                canHide: true, // Default to true, actual hiding capability is handled by the column implementation
                canSort: true, // Default to true, actual sorting capability is handled by the column implementation
                id: colDef.id || "unknown",
                label
            }
        })
    }, [columns])

    // Create table instance with configuration
    const table = useReactTable({
        columns,
        data: data || [],
        enableColumnFilters: config.table.enableColumnFilters,
        enableMultiRowSelection: true,
        enableRowSelection: true,
        enableSorting: config.table.enableSorting,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        manualFiltering: config.table.manualFiltering,
        manualPagination: config.table.manualPagination,
        manualSorting: config.table.manualSorting,
        onColumnFiltersChange: tableUrlState.setColumnFiltersFromUI as OnChangeFn<
            typeof columnFilters
        >,
        onColumnOrderChange: tableUrlState.setOrderFromUI as OnChangeFn<typeof columnOrder>,
        onColumnVisibilityChange: tableUrlState.setVisibilityFromUI as OnChangeFn<
            typeof columnVisibility
        >,
        onPaginationChange: tableUrlState.setPaginationFromUI as OnChangeFn<PaginationState>,
        onRowSelectionChange: setRowSelection,
        onSortingChange: tableUrlState.setSorting as OnChangeFn<typeof sorting>,
        pageCount: Math.ceil(rowCount / pagination.pageSize),
        state: {
            columnFilters,
            columnOrder,
            columnVisibility,
            pagination,
            rowSelection,
            sorting
        }
    })

    // Return everything needed to render a data table
    return {
        // Table actions
        actions: {
            create: handleCreate,
            delete: handleDelete,
            edit: handleEdit,
            invalidateTable,
            refresh: enhancedRefetch
        },

        // Column configuration
        columnOptions,

        columns,
        // Table configuration
        config,

        // URL state utilities
        createShareableUrl: tableUrlState.createShareableUrl,

        // Table data
        data,
        error,
        // Data actions
        handleCreate,
        handleDelete,
        handleEdit,
        isError,
        isLoading,
        pageCount: Math.ceil(rowCount / pagination.pageSize),

        refetch: enhancedRefetch,
        resetFilters: tableUrlState.resetFilters,
        resetUrlState: tableUrlState.resetUrlState,
        rowCount,
        rowSelection,
        // Table state
        setColumnFilters: tableUrlState.setColumnFiltersFromUI as OnChangeFn<typeof columnFilters>,
        setColumnVisibility: tableUrlState.setVisibilityFromUI as OnChangeFn<
            typeof columnVisibility
        >,
        setGrouping: tableUrlState.setGroupingFromUI,

        setPageIndex: (pageIndex: number) => tableUrlState.setPageParam(pageIndex.toString()),
        setPageSize: (pageSize: number) => tableUrlState.setPageSizeParam(pageSize.toString()),
        setRowSelection,

        setSorting: tableUrlState.setSorting as OnChangeFn<typeof sorting>,
        state: {
            columnFilters,
            columnOrder,
            columnVisibility,
            grouping: tableUrlState.groupingParam || [],
            pagination,
            sorting
        },
        // Table instance
        tableInstance: table,

        // Translations
        translations,

        // Force re-render key when column visibility changes (until atoms are fully synced with URL state)
        visibilityKey: JSON.stringify(columnVisibility)
    }
}
