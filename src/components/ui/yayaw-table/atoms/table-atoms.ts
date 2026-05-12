import type {
  ColumnFiltersState,
  ExpandedState,
  GroupingState,
  Row,
  PaginationState,
  RowSelectionState,
  SortingState,
  VisibilityState,
} from "@tanstack/react-table";
/**
 * Base atoms for DataTable component
 * These atoms provide core functionality used across the DataTable
 */
import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { atomFamily } from "jotai-family";

import type { DataTableColumnDef } from "../types/column-types";

/**
 * Atom to store the current table ID
 * This is used to identify the table across the application
 */
export const tableIdAtom = atom<string>("");

/**
 * Atom family to store column definitions for a specific table
 * Keyed by tableId
 */
export const columnsAtom = atomFamily((_tableId: string) =>
  atom<DataTableColumnDef<Record<string, unknown>>[]>([])
);

/**
 * Store column translations by table ID
 * Maps column IDs to their translated headers
 */
export const columnTranslationsAtom = atomFamily((_tableId: string) =>
  atom<Record<string, string>>({})
);

// Note: columnIdMappingAtom is defined in filter-atoms.ts

/**
 * Derived atom that combines column definitions with their translations
 * This provides a complete view of columns with translated headers
 */
export const translatedColumnsAtom = atomFamily((tableId: string) =>
  atom((get) => {
    const columns = get(columnsAtom(tableId));
    const translations = get(columnTranslationsAtom(tableId));

    return columns.map(
      (column: DataTableColumnDef<Record<string, unknown>>) => ({
        ...column,
        translatedHeader: translations[column.id] || column.header,
      })
    );
  })
);

/**
 * Atom family to store sorting state for a specific table
 * Keyed by tableId
 */
export const sortingAtom = atomFamily((_tableId: string) =>
  atom<SortingState>([])
);

/**
 * Atom family to store column filters state for a specific table
 * Keyed by tableId
 */
export const columnFiltersAtom = atomFamily((_tableId: string) =>
  atom<ColumnFiltersState>([])
);

/**
 * Atom family to store global filter state for a specific table
 * Used for filtering across all columns
 * Keyed by tableId
 */
export const globalFilterAtom = atomFamily((_tableId: string) =>
  atom<string>("")
);

/**
 * Atom family to store column visibility state for a specific table
 * Keyed by tableId
 */
export const columnVisibilityAtom = atomFamily((_tableId: string) =>
  atom<VisibilityState>({})
);

/**
 * Atom family to store column order state for a specific table
 * Keyed by tableId
 */
export const columnOrderAtom = atomFamily((_tableId: string) =>
  atom<string[]>([])
);

/**
 * Atom family to store pagination state for a specific table
 * Keyed by tableId
 */
export const paginationAtom = atomFamily((_tableId: string) =>
  atom<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })
);

/**
 * Atom family to store row selection state for a specific table
 * Not persisted in views as it's a transient state
 * Keyed by tableId
 */
export const rowSelectionAtom = atomFamily((_tableId: string) =>
  atom<RowSelectionState>({})
);

export const selectedRowsAtom = atomFamily((_tableId: string) =>
  atom<Row<Record<string, unknown>>[]>([])
);

/**
 * Atom family to store expanded state for a specific table
 * Used for expandable rows or tree-like structures
 * Keyed by tableId
 */
export const expandedAtom = atomFamily((_tableId: string) =>
  atom<ExpandedState>({})
);

/**
 * Atom family to store grouping state for a specific table
 * Used for row grouping functionality
 * Keyed by tableId
 */
export const groupingAtom = atomFamily((_tableId: string) =>
  atom<GroupingState>([])
);

/**
 * Atom family for row ordering
 * Used for drag and drop reordering of rows
 * Persisted to localStorage to maintain order between sessions
 */
export const rowOrderAtom = atomFamily((tableId: string) =>
  atomWithStorage<string[]>(`${tableId}-row-order`, [])
);

/**
 * Atom family for tracking active row drag
 * Used to highlight the currently dragged row
 */
export const activeRowDragAtom = atomFamily((_tableId: string) =>
  atom<null | string>(null)
);

/**
 * Atom family for tracking active column drag
 * Used to highlight the currently dragged column
 */
export const activeColumnDragAtom = atomFamily((_tableId: string) =>
  atom<null | string>(null)
);

/**
 * Atom family for tracking if row drag is enabled
 * This can be toggled by the user or disabled for certain tables
 */
export const rowDragEnabledAtom = atomFamily((tableId: string) =>
  atomWithStorage<boolean>(`${tableId}-row-drag-enabled`, true)
);

/**
 * Atom family for tracking if column drag is enabled
 * This can be toggled by the user or disabled for certain tables
 */
export const columnDragEnabledAtom = atomFamily((tableId: string) =>
  atomWithStorage<boolean>(`${tableId}-column-drag-enabled`, true)
);

/**
 * Atom family for "open Options stack menu to this view" (e.g. "filters" when clicking Filter in column header menu)
 * When set, the toolbar TableMenu opens and navigates to that view; cleared when the menu closes.
 */
export const tableMenuOpenToViewAtom = atomFamily((_tableId: string) =>
  atom<null | string>(null)
);

/**
 * When opening the filters view from a column header Filter click, open the filter for this column id.
 * Cleared when the filter panel has consumed it or when the menu closes.
 */
export const tableMenuOpenFilterColumnIdAtom = atomFamily((_tableId: string) =>
  atom<null | string>(null)
);

/**
 * Atom to store whether the table is in a loading state
 * Used for showing loading indicators
 */
export const isLoadingAtom = atom<boolean>(false);

/**
 * Atom to store any error that occurred during table operations
 * Used for showing error messages
 */
export const errorAtom = atom<null | string>(null);

/**
 * Atom to store whether the table is in debug mode
 * When in debug mode, additional logging and UI elements may be displayed
 */
export const isDebugModeAtom = atom<boolean>(
  process.env.NODE_ENV === "development"
);

/**
 * Atom family to store table features configuration
 * Controls which features are enabled for a specific table
 * Keyed by tableId
 */
export const featuresAtom = atomFamily((_tableId: string) =>
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
    enableSorting: true,
  })
);
