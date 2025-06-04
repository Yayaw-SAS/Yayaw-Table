/**
 * Types for table views
 * Defines the structure of saved table views
 */

import type { ColumnFiltersState, SortingState, VisibilityState } from "@tanstack/react-table"

/**
 * Table view
 * Represents a saved view of the table
 */
export interface TableView {
    /**
     * View configuration
     */
    config: TableViewConfig

    /**
     * Creation date
     */
    createdAt?: Date

    /**
     * ID of the user who created the view
     */
    createdById: string

    /**
     * Unique identifier for the view
     */
    id: string

    /**
     * Whether the view is the default view
     * The default view is loaded when the table is first rendered
     */
    isDefault?: boolean

    /**
     * Whether the view is global (available to all users)
     */
    isGlobal?: boolean

    /**
     * Whether the view is a system view
     * System views cannot be edited or deleted by users
     */
    isSystem?: boolean

    /**
     * Display name for the view
     */
    name: string

    /**
     * ID of the user who owns the view
     */
    ownerId?: null | string

    /**
     * ID of the table this view belongs to
     */
    tableId: string

    /**
     * Last update date
     */
    updatedAt?: Date
}

/**
 * Table view configuration
 * Contains all state that can be saved in a view
 */
export interface TableViewConfig {
    /**
     * Column filters
     */
    columnFilters?: ColumnFiltersState

    /**
     * Column order
     */
    columnOrder?: string[]

    /**
     * Column visibility
     */
    columnVisibility?: VisibilityState

    /**
     * Sorting
     */
    sorting?: SortingState
}
