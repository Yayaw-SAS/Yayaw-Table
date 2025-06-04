import type {
    ColumnFiltersState,
    ExpandedState,
    GroupingState,
    PaginationState,
    RowSelectionState,
    SortingState,
    VisibilityState
} from "@tanstack/react-table"
/**
 * Base atoms for DataTable component
 * These atoms provide core functionality used across the DataTable
 */
import { atom } from "jotai"
import { atomFamily, atomWithStorage } from "jotai/utils"

import type { DataTableColumnDef } from "../../types/column-types"

/**
 * Atom to store the current table ID
 * This is used to identify the table across the application
 */
export const tableIdAtom = atom<string>("")

/**
 * Atom family to store column definitions for a specific table
 * Keyed by tableId
 */
export const columnsAtom = atomFamily((tableId: string) =>
    atom<DataTableColumnDef<Record<string, unknown>>[]>([])
)

/**
 * Store column translations by table ID
 * Maps column IDs to their translated headers
 */
export const columnTranslationsAtom = atomFamily((tableId: string) =>
    atom<Record<string, string>>({})
)

// Note: columnIdMappingAtom is defined in filter-atoms.ts

/**
 * Derived atom that combines column definitions with their translations
 * This provides a complete view of columns with translated headers
 */
export const translatedColumnsAtom = atomFamily((tableId: string) =>
    atom((get) => {
        const columns = get(columnsAtom(tableId))
        const translations = get(columnTranslationsAtom(tableId))

        return columns.map((column: DataTableColumnDef<Record<string, unknown>>) => ({
            ...column,
            translatedHeader: translations[column.id] || column.header
        }))
    })
)

/**
 * Atom family to store sorting state for a specific table
 * Keyed by tableId
 */
export const sortingAtom = atomFamily((tableId: string) => atom<SortingState>([]))

/**
 * Atom family to store column filters state for a specific table
 * Keyed by tableId
 */
export const columnFiltersAtom = atomFamily((tableId: string) => atom<ColumnFiltersState>([]))

/**
 * Atom family to store global filter state for a specific table
 * Used for filtering across all columns
 * Keyed by tableId
 */
export const globalFilterAtom = atomFamily((tableId: string) => atom<string>(""))

/**
 * Atom family to store column visibility state for a specific table
 * Keyed by tableId
 */
export const columnVisibilityAtom = atomFamily((tableId: string) => atom<VisibilityState>({}))

/**
 * Atom family to store column order state for a specific table
 * Keyed by tableId
 */
export const columnOrderAtom = atomFamily((tableId: string) => atom<string[]>([]))

/**
 * Atom family to store pagination state for a specific table
 * Keyed by tableId
 */
export const paginationAtom = atomFamily((tableId: string) =>
    atom<PaginationState>({
        pageIndex: 0,
        pageSize: 10
    })
)

/**
 * Atom family to store row selection state for a specific table
 * Not persisted in views as it's a transient state
 * Keyed by tableId
 */
export const rowSelectionAtom = atomFamily((tableId: string) => atom<RowSelectionState>({}))

/**
 * Atom family to store expanded state for a specific table
 * Used for expandable rows or tree-like structures
 * Keyed by tableId
 */
export const expandedAtom = atomFamily((tableId: string) => atom<ExpandedState>({}))

/**
 * Atom family to store grouping state for a specific table
 * Used for row grouping functionality
 * Keyed by tableId
 */
export const groupingAtom = atomFamily((tableId: string) => atom<GroupingState>([]))

/**
 * Atom family for row ordering
 * Used for drag and drop reordering of rows
 * Persisted to localStorage to maintain order between sessions
 */
export const rowOrderAtom = atomFamily((tableId: string) =>
    atomWithStorage<string[]>(`${tableId}-row-order`, [])
)

/**
 * Atom family for tracking active row drag
 * Used to highlight the currently dragged row
 */
export const activeRowDragAtom = atomFamily((tableId: string) => atom<null | string>(null))

/**
 * Atom family for tracking active column drag
 * Used to highlight the currently dragged column
 */
export const activeColumnDragAtom = atomFamily((tableId: string) => atom<null | string>(null))

/**
 * Atom family for tracking if row drag is enabled
 * This can be toggled by the user or disabled for certain tables
 */
export const rowDragEnabledAtom = atomFamily((tableId: string) =>
    atomWithStorage<boolean>(`${tableId}-row-drag-enabled`, true)
)

/**
 * Atom family for tracking if column drag is enabled
 * This can be toggled by the user or disabled for certain tables
 */
export const columnDragEnabledAtom = atomFamily((tableId: string) =>
    atomWithStorage<boolean>(`${tableId}-column-drag-enabled`, true)
)

/**
 * Atom to store whether the table is in a loading state
 * Used for showing loading indicators
 */
export const isLoadingAtom = atom<boolean>(false)

/**
 * Atom to store any error that occurred during table operations
 * Used for showing error messages
 */
export const errorAtom = atom<null | string>(null)

/**
 * Atom to store whether the table is in debug mode
 * When in debug mode, additional logging and UI elements may be displayed
 */
export const isDebugModeAtom = atom<boolean>(process.env.NODE_ENV === "development")

/**
 * Atom family to store table features configuration
 * Controls which features are enabled for a specific table
 * Keyed by tableId
 */
export const featuresAtom = atomFamily((tableId: string) =>
    atom({
        enableColumnFilters: true,
        enableColumnResizing: false,
        enableColumnVisibility: true,
        enableExpanding: true,
        enableGrouping: true,
        enablePagination: true,
        enablePinning: true,
        enableRowSelection: true,
        enableServerSide: true,
        enableSorting: true
    })
)
