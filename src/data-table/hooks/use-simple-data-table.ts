import {
    type ColumnDef,
    type ColumnFiltersState,
    getCoreRowModel,
    getFacetedRowModel,
    getFacetedUniqueValues,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    type PaginationState,
    type RowSelectionState,
    type SortingState,
    useReactTable,
    type VisibilityState
} from '@tanstack/react-table'
import { useMemo, useState } from 'react'

interface UseSimpleDataTableOptions<T> {
    data: T[]
    columns: ColumnDef<T, any>[]
    enableRowSelection?: boolean
    enableColumnFilters?: boolean
    enableSorting?: boolean
    enablePagination?: boolean
    initialState?: {
        pagination?: PaginationState
        sorting?: SortingState
        columnFilters?: ColumnFiltersState
        columnVisibility?: VisibilityState
        rowSelection?: RowSelectionState
        globalFilter?: string
    }
    onRowSelect?: (rows: T[]) => void
}

export function useSimpleDataTable<T>({
    data,
    columns,
    enableRowSelection = false,
    enableColumnFilters = true,
    enableSorting = true,
    enablePagination = true,
    initialState = {},
    onRowSelect
}: UseSimpleDataTableOptions<T>) {
    // State management
    const [sorting, setSorting] = useState<SortingState>(initialState.sorting || [])
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(
        initialState.columnFilters || []
    )
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
        initialState.columnVisibility || {}
    )
    const [rowSelection, setRowSelection] = useState<RowSelectionState>(
        initialState.rowSelection || {}
    )
    const [globalFilter, setGlobalFilter] = useState<string>(initialState.globalFilter || '')
    const [pagination, setPagination] = useState<PaginationState>(
        initialState.pagination || { pageIndex: 0, pageSize: 10 }
    )

    // Create table instance
    const table = useReactTable({
        data,
        columns,
        state: {
            sorting: enableSorting ? sorting : [],
            columnFilters: enableColumnFilters ? columnFilters : [],
            columnVisibility,
            rowSelection: enableRowSelection ? rowSelection : {},
            globalFilter,
            pagination: enablePagination ? pagination : { pageIndex: 0, pageSize: data.length }
        },
        enableRowSelection,
        onSortingChange: enableSorting ? setSorting : undefined,
        onColumnFiltersChange: enableColumnFilters ? setColumnFilters : undefined,
        onColumnVisibilityChange: setColumnVisibility,
        onRowSelectionChange: enableRowSelection ? setRowSelection : undefined,
        onGlobalFilterChange: setGlobalFilter,
        onPaginationChange: enablePagination ? setPagination : undefined,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: enablePagination ? getPaginationRowModel() : undefined,
        getSortedRowModel: enableSorting ? getSortedRowModel() : undefined,
        getFacetedRowModel: getFacetedRowModel(),
        getFacetedUniqueValues: getFacetedUniqueValues(),
        globalFilterFn: 'includesString'
    })

    // Get selected rows and call callback
    const selectedRows = useMemo(() => {
        if (!enableRowSelection) {
            return []
        }
        return table.getFilteredSelectedRowModel().rows.map((row) => row.original)
    }, [table, enableRowSelection])

    // Call onRowSelect when selection changes
    useMemo(() => {
        if (onRowSelect && enableRowSelection) {
            onRowSelect(selectedRows)
        }
    }, [selectedRows, onRowSelect, enableRowSelection])

    return {
        table,

        // State getters and setters
        sorting,
        setSorting,
        columnFilters,
        setColumnFilters,
        columnVisibility,
        setColumnVisibility,
        rowSelection,
        setRowSelection,
        globalFilter,
        setGlobalFilter,
        pagination,
        setPagination,

        // Computed values
        selectedRows,

        // Helper functions
        resetFilters: () => {
            setColumnFilters([])
            setGlobalFilter('')
        },
        resetSorting: () => setSorting([]),
        resetSelection: () => setRowSelection({}),
        resetPagination: () => setPagination({ pageIndex: 0, pageSize: 10 }),

        // Table state
        pageCount: table.getPageCount(),
        pageIndex: pagination.pageIndex,
        pageSize: pagination.pageSize,
        totalRows: data.length,
        filteredRows: table.getFilteredRowModel().rows.length
    }
}
