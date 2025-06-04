/**
 * Hook for fetching and managing table data with URL state
 * Uses TanStack Query for data fetching and caching
 */
"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useMemo, useState } from "react"

import { processServerFilters } from "../utils/server-filters"

import { useTableUrlState } from "./use-table-url-state"

const DEBUG = false

interface UseTableUrlDataOptions<TData> {
    enabled?: boolean
    getRowId?: (row: TData) => string
    initialData?: TData[]
    queryFn: (params: {
        columnFilters: Array<{ id: string; value: unknown }>
        complexFilters: unknown[]
        pagination: {
            pageIndex: number
            pageSize: number
        }
        serverFilters: Record<string, unknown>
        sorting: {
            desc: boolean
            id: string
        }[]
        tableId: string
    }) => Promise<{
        data: TData[]
        pageCount: number
        rowCount: number
    }>
    tableId: string
}

/**
 * Hook for fetching and managing table data with URL state
 * @param options - Configuration options for data fetching
 * @returns Object with data and loading state
 */
export function useTableUrlData<TData>({
    enabled = true,
    getRowId = (row: TData) => (row as Record<string, unknown>).id as string,
    initialData = [],
    queryFn,
    tableId
}: UseTableUrlDataOptions<TData>) {
    // Get URL state
    const { filtersParam, orderParam, pagination, sortParam } = useTableUrlState({
        tableId
    })

    // Use React state for row selection (client-side only)
    const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({})

    // Get query client
    const queryClient = useQueryClient()

    // Process filters for server-side compatibility
    const processedFiltersQuery = useQuery({
        queryFn: () => {
            // Ensure filtersParam is always an array
            const filters = Array.isArray(filtersParam) ? filtersParam : []

            if (filters.length === 0) {
                return { complexFilters: [], serverFilters: {} }
            }

            // Extract global filter if present
            const globalFilterEntry = filters.find(
                (f: unknown): f is { id: string; value: unknown } =>
                    typeof f === "object" &&
                    f !== null &&
                    "id" in f &&
                    (f as { id: string }).id === "global"
            )
            const globalFilter =
                globalFilterEntry &&
                typeof globalFilterEntry === "object" &&
                "value" in globalFilterEntry
                    ? (globalFilterEntry.value as string)
                    : ""

            // Process column filters for server-side compatibility
            const result = processServerFilters(
                (filters as Array<{ id: string; value: unknown }>)
                    .filter((filter) => filter.id !== "global") // Remove global filter from regular filters
                    .map((filter) => ({
                        id: filter.id,
                        value: filter.value
                    }))
            )

            // Add global filter if present
            if (globalFilter) {
                result.serverFilters.global = globalFilter
            }

            return result
        },
        // Ensure the query is stable and doesn't cause unnecessary re-renders
        queryKey: ["tableProcessedFilters", tableId, filtersParam],
        staleTime: 5000 // 5 seconds
    })

    // Extract complex filters and server filters from the query result
    const { complexFilters, serverFilters } = processedFiltersQuery.data || {
        complexFilters: [],
        serverFilters: {}
    }

    // Modify the enabled condition to also run when processedFiltersQuery is pending but we have initial data
    // This prevents the infinite loading state when processedFiltersQuery is stuck in pending
    const shouldEnableQuery =
        Boolean(tableId) &&
        enabled &&
        (processedFiltersQuery.status === "success" ||
            (processedFiltersQuery.status === "pending" && initialData.length > 0))

    // Query for fetching data
    const {
        data: queryResult,
        error,
        isError,
        isLoading,
        refetch,
        status
    } = useQuery({
        // Enable the query when processedFiltersQuery is complete or when we have initial data
        enabled: shouldEnableQuery,
        initialData: initialData.length
            ? {
                  data: initialData,
                  pageCount: 1,
                  rowCount: initialData.length
              }
            : undefined,
        queryFn: async () => {
            try {
                if (DEBUG) {
                    console.log("[useTableUrlData] Starting data fetch with params:", {
                        filtersParam,
                        pagination,
                        serverFilters,
                        sortParam,
                        tableId
                    })
                }

                // Check if we have any key-specific filters that might be causing individual requests
                const hasKeyFilter = Object.keys(serverFilters).includes("key")

                // If we're doing a key-specific lookup, we should clear all filters and do a full table fetch instead
                // This prevents the individual key-based requests we're seeing
                const cleanedServerFilters = hasKeyFilter ? {} : serverFilters

                // Simply convert each filter to the format expected by fetchTableData
                const columnFilters: Array<{ id: string; value: unknown }> = []
                for (const [id, value] of Object.entries(cleanedServerFilters)) {
                    // For object values like {contains: 'value'}, extract just the value
                    if (typeof value === "object" && value !== null) {
                        // If it's a contains filter, extract the value
                        if ("contains" in value) {
                            // For text search, we need to extract just the value for TanStack Table compatibility
                            columnFilters.push({
                                id,
                                value: (value as { contains: unknown }).contains // Extract just the value for client-side filtering
                            })
                        } else {
                            // For other object filters, pass the whole object
                            columnFilters.push({
                                id,
                                value
                            })
                        }
                    } else {
                        // For simple values, pass them directly
                        columnFilters.push({
                            id,
                            value
                        })
                    }
                }

                const params = {
                    // Use columnFilters for TanStack Table compatibility
                    columnFilters,
                    // Use complexFilters for special filter types
                    complexFilters,
                    // Pagination parameters from URL
                    pagination,
                    // Use serverFilters directly for server-side filtering (without key filters)
                    serverFilters: cleanedServerFilters,
                    // Sorting parameters
                    sorting: (sortParam as { desc: boolean; id: string }[]) || [],
                    // Table identifier
                    tableId
                }

                if (DEBUG) {
                    console.log("[useTableUrlData] Calling queryFn with params:", params)
                }

                try {
                    const result = await queryFn(params)
                    if (DEBUG) {
                        console.log("[useTableUrlData] Query result:", result)
                    }
                    return result
                } catch (error) {
                    console.error("[useTableUrlData] Error in queryFn:", error)
                    throw error
                }
            } catch (err) {
                console.error("[useTableUrlData] Error fetching table data:", err)
                throw err
            }
        },
        queryKey: [
            "tableData",
            tableId,
            JSON.stringify(sortParam),
            JSON.stringify(filtersParam),
            JSON.stringify(pagination),
            JSON.stringify(serverFilters)
        ],
        // Prevent refetching on window focus to avoid duplicate requests
        refetchOnWindowFocus: false,
        // Improve cache options for better performance
        staleTime: 30000 // 30 seconds
    })

    // Get data from query result or use initial data
    const data = queryResult?.data || []

    // Apply row ordering if drag is enabled and we have a row order
    const orderedData = useMemo(() => {
        if (!Array.isArray(data) || data.length === 0) {
            return data
        }

        // If we have a row order, apply it
        if (Array.isArray(orderParam) && orderParam.length > 0) {
            // Create a map of row IDs to their order index
            const orderMap = new Map<string, number>()
            ;(orderParam as string[]).forEach((id, index) => {
                orderMap.set(id, index)
            })

            // Sort the data based on the order map
            return [...data].sort((a, b) => {
                const aId = getRowId(a)
                const bId = getRowId(b)

                // If both rows are in the order map, sort by their order
                if (orderMap.has(aId) && orderMap.has(bId)) {
                    return (orderMap.get(aId) || 0) - (orderMap.get(bId) || 0)
                }

                // If only one row is in the order map, it comes first
                if (orderMap.has(aId)) return -1
                if (orderMap.has(bId)) return 1

                // If neither row is in the order map, maintain original order
                return 0
            })
        }

        return data
    }, [data, orderParam, getRowId])

    // Enhanced refetch that invalidates the cache
    const enhancedRefetch = useCallback(async () => {
        queryClient.invalidateQueries({ queryKey: ["tableData", tableId] })
        return await refetch()
    }, [queryClient, refetch, tableId])

    return {
        data: orderedData,
        enhancedRefetch,
        error,
        isError,
        isLoading,
        pagination,
        refetch,
        rowCount: queryResult?.rowCount || 0,
        rowSelection,
        setRowSelection,
        status
    }
}
