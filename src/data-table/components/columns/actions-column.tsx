/**
 * Actions column component for data tables
 * Provides standardized display of row action buttons
 */
'use client'

import type { Row } from '@tanstack/react-table'
import type { ReactNode } from 'react'

import { ActionsCellWithTranslations } from '../cells/actions-cell'

export interface ActionItem<TData> {
    /**
     * CSS class for the action item
     */
    className?: string

    /**
     * Custom renderer for the action
     * Used for complex actions like edit with form
     * If provided, onClick will be ignored
     */
    customRenderer?: () => ReactNode

    /**
     * Whether the action is disabled
     */
    disabled?: ((row: TData) => boolean) | boolean

    /**
     * Icon to display for the action (optional)
     */
    icon?: ReactNode

    /**
     * Label for the action
     */
    label: string

    /**
     * Handler function when the action is clicked
     * Can return a boolean to indicate success/failure or void
     * Not required if customRenderer is provided
     */
    onClick?: (row: TData) => Promise<boolean | undefined> | undefined

    /**
     * Type of action (for predefined actions like edit and delete)
     */
    type?: 'custom' | 'delete' | 'duplicate' | 'edit' | 'view'
}

export interface ActionsColumnProps<TData> {
    /**
     * Actions to display for each row
     * Optional if standard actions (edit/delete) are provided
     */
    actions?: ActionItem<TData>[]

    /**
     * Optional custom header text
     */
    header?: string

    /**
     * Whether to include the delete action by default
     */
    includeDelete?: boolean

    /**
     * Whether to include the duplicate action by default
     */
    includeDuplicate?: boolean

    /**
     * Whether to include the edit action by default
     */
    includeEdit?: boolean

    /**
     * Whether to include the view action by default
     */
    includeView?: boolean

    /**
     * Handler for the delete action (required if includeDelete is true)
     * Can return a boolean to indicate success/failure or void
     */
    onDelete?: (row: TData) => Promise<boolean | undefined> | undefined

    /**
     * Handler for the duplicate action (required if includeDuplicate is true)
     * Can return a boolean to indicate success/failure or void
     */
    onDuplicate?: (row: TData) => Promise<boolean | undefined> | undefined

    /**
     * Handler for the edit action (required if includeEdit is true)
     * Can return a boolean to indicate success/failure or void
     */
    onEdit?: (row: TData) => Promise<boolean | undefined> | undefined

    /**
     * Function to refresh the data after an action is performed
     */
    onRefresh?: () => Promise<void> | void

    /**
     * Handler for the view action (required if includeView is true)
     * Can return a boolean to indicate success/failure or void
     */
    onView?: (row: TData) => Promise<boolean | undefined> | undefined

    /**
     * Table ID to use for the form
     * If provided, will be used to determine the form type for edit actions
     */
    tableId?: string
}

export function createActionsColumn<TData extends Record<string, unknown>>({
    actions = [],
    header = 'Actions',
    includeDelete = true,
    includeDuplicate = true,
    includeEdit = true,
    includeView = true,
    onDelete,
    onDuplicate,
    onEdit,
    onRefresh,
    onView,
    tableId
}: ActionsColumnProps<TData>) {
    // Validate standard actions
    if (includeView && !onView) {
    }

    if (includeEdit && !onEdit) {
    }

    if (includeDuplicate && !onDuplicate) {
    }

    if (includeDelete && !onDelete) {
    }

    const column = {
        cell: ({ row }: { row: Row<TData> }) => {
            return (
                <ActionsCellWithTranslations
                    actions={actions}
                    onRefresh={onRefresh}
                    row={row}
                    standardActions={{
                        includeDelete,
                        includeDuplicate,
                        includeEdit,
                        includeView,
                        onDelete,
                        onDuplicate,
                        onEdit,
                        onView,
                        tableId
                    }}
                />
            )
        },
        enableHiding: false,
        enablePinning: false, // Disable manual pinning by users
        enableSorting: false,
        header,
        id: 'actions',
        meta: {
            disableDrag: true,
            disableDrop: true,
            fixedPosition: 'end',
            isActionsColumn: true
        },
        pinned: 'right', // Pin this column to the right side
        // Ensure the column is always visible
        size: 80 // Fixed width for actions column
    }

    return column
}

/**
 * Creates an actions column definition
 * @returns Column definition for displaying row actions
 */
