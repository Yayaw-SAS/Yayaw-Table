/**
 * Hook for managing URL state with nuqs
 * Allows sharing links to specific table states
 */
"use client"

import type { ColumnFiltersState, SortingState } from "@tanstack/react-table"
import { createParser, useQueryState } from "nuqs"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

// Simple debounce implementation to avoid lodash dependency
function debounce<T extends (...args: any[]) => void>(func: T, wait: number): T {
    let timeout: NodeJS.Timeout | null = null
    return ((...args: any[]) => {
        if (timeout) clearTimeout(timeout)
        timeout = setTimeout(() => func(...args), wait)
    }) as T
}

// Debug flag to help track sorting issues
const DEBUG = false

// Create parsers for different types of state
const arrayParser = createParser({
    parse: (value: string) => (value ? JSON.parse(value) : []),
    serialize: (value: unknown[]) => (value?.length ? JSON.stringify(value) : "")
})

const objectParser = createParser({
    parse: (value: string) => (value ? JSON.parse(value) : {}),
    serialize: (value: object) => (Object.keys(value || {}).length ? JSON.stringify(value) : "")
})

// Using URL state as the single source of truth - no Jotai atoms

/**
 * Interface for pagination parameters
 */
interface PaginationParams {
    /**
     * Current page index (0-based)
     */
    pageIndex?: number

    /**
     * Number of items per page
     */
    pageSize?: number
}

/**
 * Options for the useTableUrlState hook
 */
interface UseTableUrlStateOptions {
    /**
     * Whether URL state management is enabled
     * @default true
     */
    enabled?: boolean

    /**
     * Unique identifier for the table
     */
    tableId: string
}

/**
 * Hook for managing table state through URL parameters using nuqs
 * Enables shareable table configurations and server-side processing
 *
 * @param options - Configuration options
 * @returns Object with URL state utilities and parameters
 */
export function useTableUrlState({ enabled = true, tableId }: UseTableUrlStateOptions) {
    // Track if we're currently syncing to prevent loops
    const isSyncing = useRef(false)

    // Batch update queue
    const updateQueue = useRef<Array<() => void>>([])
    const batchTimeout = useRef<null | number>(null)

    // Process batched updates
    const processBatchedUpdates = useCallback(() => {
        if (updateQueue.current.length === 0) return

        isSyncing.current = true
        try {
            // Execute all queued updates
            for (const update of updateQueue.current) {
                update()
            }
        } finally {
            updateQueue.current = []
            isSyncing.current = false
        }
    }, [])

    // Helper function to queue URL parameter updates
    const queueUrlUpdate = useCallback(
        <T>(setter: (value: T) => void, value: T) => {
            if (isSyncing.current) return

            updateQueue.current.push(() => setter(value))

            // Clear existing timeout
            if (batchTimeout.current !== null) {
                window.clearTimeout(batchTimeout.current)
            }

            // Schedule batch update
            batchTimeout.current = window.setTimeout(processBatchedUpdates, 0)
        },
        [processBatchedUpdates]
    )

    // URL parameters using nuqs
    // View and history management
    const [viewParam, setViewParam] = useQueryState("view")
    const [historyIndexParam, setHistoryIndexParam] = useQueryState("historyIndex", {
        defaultValue: "0"
    })

    // Table state parameters
    const [sortParam, setSortParam] = useQueryState(`${tableId}-sort`, arrayParser)

    const [filtersParam, setFiltersParam] = useQueryState(`${tableId}-filters`, arrayParser)

    const [pageParam, setPageParam] = useQueryState(`${tableId}-page`, {
        defaultValue: "0"
    })

    const [pageSizeParam, setPageSizeParam] = useQueryState(`${tableId}-pageSize`, {
        defaultValue: "10"
    })

    const [visibilityParam, setVisibilityParam] = useQueryState(
        `${tableId}-visibility`,
        objectParser
    )

    const [orderParam, setOrderParam] = useQueryState(`${tableId}-order`, arrayParser)

    const [expandedParam, setExpandedParam] = useQueryState(`${tableId}-expanded`, {
        defaultValue: "",
        parse: (value) => (value ? JSON.parse(decodeURIComponent(value)) : {}),
        serialize: (value) =>
            Object.keys(value || {}).length ? encodeURIComponent(JSON.stringify(value)) : ""
    })

    const [groupingParam, setGroupingParam] = useQueryState(`${tableId}-grouping`, arrayParser)

    // Column pinning parameter
    const [pinningParam, setPinningParam] = useQueryState(`${tableId}-pinning`, {
        defaultValue: "",
        parse: (value) => (value ? JSON.parse(decodeURIComponent(value)) : { left: [], right: [] }),
        serialize: (value) => {
            // Only serialize if we have pinned columns
            const hasLeft = value?.left?.length > 0
            const hasRight = value?.right?.length > 0
            return hasLeft || hasRight ? encodeURIComponent(JSON.stringify(value)) : ""
        }
    })

    type TableParamValue = ColumnFiltersState | SortingState | Record<string, boolean> | string[]

    const debouncedSetParamRef = useRef<((key: string, value: TableParamValue) => void) | null>(
        null
    )

    // Create debounced setter on mount
    useEffect(() => {
        if (!debouncedSetParamRef.current) {
            debouncedSetParamRef.current = debounce((key: string, value: TableParamValue) => {
                if (key.includes("filters")) {
                    setFiltersParam(value as ColumnFiltersState)
                } else if (key.includes("sort")) {
                    setSortParam(value as SortingState)
                }
                // Add other param setters as needed
            }, 150)
        }
    }, [setFiltersParam, setSortParam])

    const setColumnFiltersFromUI = useCallback(
        (filters: ColumnFiltersState) => {
            debouncedSetParamRef.current?.(`${tableId}-filters`, filters)
        },
        [tableId]
    )

    const setSorting = useCallback(
        (sorting: SortingState) => {
            debouncedSetParamRef.current?.(`${tableId}-sort`, sorting)
        },
        [tableId]
    )

    // Method to reset all filters
    const resetFilters = useCallback(() => {
        queueUrlUpdate(setFiltersParam, [])
    }, [queueUrlUpdate, setFiltersParam])

    // Methods for other URL parameters
    const setPaginationFromUI = useCallback(
        (pagination: PaginationParams) => {
            // Use default values if pageIndex or pageSize are undefined
            const pageIndex = pagination.pageIndex ?? 0
            const pageSize = pagination.pageSize ?? 10

            // Always update with valid values
            queueUrlUpdate(setPageParam, pageIndex.toString())
            queueUrlUpdate(setPageSizeParam, pageSize.toString())
        },
        [queueUrlUpdate, setPageParam, setPageSizeParam]
    )

    const setVisibilityFromUI = useCallback(
        (visibility: Record<string, boolean>) => {
            queueUrlUpdate(setVisibilityParam, visibility)
        },
        [queueUrlUpdate, setVisibilityParam]
    )

    const setOrderFromUI = useCallback(
        (order: string[]) => {
            queueUrlUpdate(setOrderParam, order)
        },
        [queueUrlUpdate, setOrderParam]
    )

    const setExpandedFromUI = useCallback(
        (expanded: Record<string, boolean>) => {
            queueUrlUpdate(setExpandedParam, expanded)
        },
        [queueUrlUpdate, setExpandedParam]
    )

    const setGroupingFromUI = useCallback(
        (grouping: string[]) => {
            queueUrlUpdate(setGroupingParam, grouping)
        },
        [queueUrlUpdate, setGroupingParam]
    )

    // Handler for column pinning changes from UI
    const setPinningFromUI = useCallback(
        (pinning: { left: string[]; right: string[] }) => {
            queueUrlUpdate(setPinningParam, pinning)
        },
        [queueUrlUpdate, setPinningParam]
    )

    // Create shareable URL with all parameters
    const createShareableUrl = useCallback(() => {
        const url = new URL(window.location.href)

        // Add all URL parameters
        if (viewParam) url.searchParams.set("view", viewParam)
        if (historyIndexParam) url.searchParams.set("historyIndex", historyIndexParam)
        if (sortParam?.length)
            url.searchParams.set(`${tableId}-sort`, encodeURIComponent(JSON.stringify(sortParam)))
        if (filtersParam?.length)
            url.searchParams.set(
                `${tableId}-filters`,
                encodeURIComponent(JSON.stringify(filtersParam))
            )
        if (pageParam) url.searchParams.set(`${tableId}-page`, pageParam)
        if (pageSizeParam) url.searchParams.set(`${tableId}-pageSize`, pageSizeParam)
        if (visibilityParam && Object.keys(visibilityParam).length)
            url.searchParams.set(
                `${tableId}-visibility`,
                encodeURIComponent(JSON.stringify(visibilityParam))
            )
        if (orderParam?.length)
            url.searchParams.set(`${tableId}-order`, encodeURIComponent(JSON.stringify(orderParam)))
        if (expandedParam && Object.keys(expandedParam).length)
            url.searchParams.set(
                `${tableId}-expanded`,
                encodeURIComponent(JSON.stringify(expandedParam))
            )
        if (groupingParam?.length)
            url.searchParams.set(
                `${tableId}-grouping`,
                encodeURIComponent(JSON.stringify(groupingParam))
            )
        if (pinningParam && (pinningParam.left?.length || pinningParam.right?.length))
            url.searchParams.set(
                `${tableId}-pinning`,
                encodeURIComponent(JSON.stringify(pinningParam))
            )

        return url.toString()
    }, [
        tableId,
        viewParam,
        historyIndexParam,
        sortParam,
        filtersParam,
        pageParam,
        pageSizeParam,
        visibilityParam,
        orderParam,
        expandedParam,
        groupingParam,
        pinningParam
    ])

    // Reset all URL state parameters
    const resetUrlState = useCallback(() => {
        if (isSyncing.current) return

        try {
            isSyncing.current = true
            // Reset all URL parameters
            setViewParam(null)
            setHistoryIndexParam("0")
            setSortParam([])
            setFiltersParam([])
            setPageParam("0")
            setPageSizeParam("10")
            setVisibilityParam({})
            setOrderParam([])
            setExpandedParam({})
            setGroupingParam([])
            setPinningParam({ left: [], right: [] })
        } finally {
            // Use requestAnimationFrame to avoid React warnings
            requestAnimationFrame(() => {
                isSyncing.current = false
            })
        }
    }, [
        setViewParam,
        setHistoryIndexParam,
        setSortParam,
        setFiltersParam,
        setPageParam,
        setPageSizeParam,
        setVisibilityParam,
        setOrderParam,
        setExpandedParam,
        setGroupingParam,
        setPinningParam
    ])

    // Get pagination state from URL parameters
    const pagination = useMemo(
        () => ({
            pageIndex: Number.parseInt(pageParam || "0", 10),
            pageSize: Number.parseInt(pageSizeParam || "10", 10)
        }),
        [pageParam, pageSizeParam]
    )

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (batchTimeout.current !== null) {
                window.clearTimeout(batchTimeout.current)
            }
        }
    }, [])

    return {
        // Utility functions
        createShareableUrl,
        // Raw URL parameters
        expandedParam,
        filtersParam: filtersParam || [],
        groupingParam: groupingParam || [],
        historyIndexParam,
        orderParam: orderParam || [],
        pageParam: pageParam || "0",
        pageSizeParam: pageSizeParam || "10",
        // Processed state
        pagination,
        pinningParam,
        resetFilters,

        resetUrlState,

        // Setter functions for UI components
        setColumnFiltersFromUI,
        setExpandedFromUI,
        // Raw setters (should generally not be used directly)
        setExpandedParam,
        setFiltersParam,
        setGroupingFromUI,
        setGroupingParam,
        setHistoryIndexParam,
        setOrderFromUI,

        setOrderParam,
        setPageParam,
        setPageSizeParam,
        setPaginationFromUI,
        setPinningFromUI,
        setPinningParam,
        setSorting,
        setSortParam,
        setViewParam,
        setVisibilityFromUI,
        setVisibilityParam,

        sortParam: sortParam || [],
        viewParam,
        visibilityParam: visibilityParam || {}
    }
}

// Helper function to ensure consistent property order in sorting objects
function normalizeSortingObject(sort: { desc: boolean; id: string }) {
    // TanStack Table requires sorting objects to have 'id' property first, then 'desc'
    // eslint-disable-next-line perfectionist/sort-objects
    return { id: sort.id, desc: sort.desc }
}
