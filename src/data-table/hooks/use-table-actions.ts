/**
 * Hook for managing table CRUD actions
 * Provides unified error handling and success callbacks
 */
'use client'

import { useCallback, useMemo } from 'react'
import { useTableActions as useProviderTableActions } from '../providers/table-provider'

/**
 * Generic action result type
 */
interface ActionResult {
    success: boolean
    error?: string
    data?: unknown
}

/**
 * Generic table actions interface
 */
interface TableActions {
    list?: (
        params: any
    ) => Promise<{ data: any[]; meta: { pageCount: number; totalCount: number } }>
    create?: (data: any) => Promise<ActionResult>
    update?: (id: string, data: any) => Promise<ActionResult>
    delete?: (id: string) => Promise<ActionResult>
    duplicate?: (id: string) => Promise<ActionResult>
}

/**
 * Options for the table actions hook
 */
interface UseTableActionsOptions {
    tableType: string
    onSuccess?: () => Promise<void>
    onError?: (error: string, action: string) => void
    enableLogging?: boolean
}

/**
 * Hook for managing table CRUD actions with unified error handling
 */
export function useTableActions<TData extends Record<string, unknown> = Record<string, unknown>>(
    options: UseTableActionsOptions
) {
    const { tableType, onSuccess, onError, enableLogging = true } = options

    // Get actions from provider
    const getTableActions = useProviderTableActions()

    const actions = useMemo(() => {
        const tableActions = getTableActions?.(tableType) as TableActions | undefined

        if (!tableActions) {
            // Return empty actions if none found
            return {
                list: async () => ({ data: [], meta: { pageCount: 0, totalCount: 0 } })
            } as TableActions
        }

        return tableActions
    }, [getTableActions, tableType])

    /**
     * Generic action executor with unified error handling
     */
    const executeAction = useCallback(
        async <T = boolean>(
            actionName: string,
            actionFn: () => Promise<ActionResult>,
            successReturnValue: T = true as T
        ): Promise<T | false> => {
            try {
                const result = await actionFn()

                if (!result.success) {
                    const _errorMsg = `Failed to ${actionName} ${tableType}: ${result.error}`

                    if (enableLogging) {
                    }

                    if (onError) {
                        onError(result.error || 'Unknown error', actionName)
                    }

                    return false
                }

                // Execute success callback
                if (onSuccess) {
                    await onSuccess()
                }

                return successReturnValue
            } catch (error) {
                const _errorMsg = `Error ${actionName} ${tableType}: ${error}`

                if (enableLogging) {
                }

                if (onError) {
                    onError(error instanceof Error ? error.message : String(error), actionName)
                }

                return false
            }
        },
        [tableType, onSuccess, onError, enableLogging]
    )

    /**
     * Create handler
     */
    const handleCreate = useCallback(
        async (data: Partial<TData>): Promise<boolean> => {
            if (!actions.create) {
                const _errorMsg = `Create action not available for ${tableType}`

                if (enableLogging) {
                }

                if (onError) {
                    onError('Action not available', 'create')
                }

                return false
            }

            return executeAction('create', () => actions.create!(data))
        },
        [actions.create, executeAction, tableType, enableLogging, onError]
    )

    /**
     * Update handler
     */
    const handleEdit = useCallback(
        async (row: TData & { id: string }, data: Partial<TData>): Promise<boolean> => {
            if (!actions.update) {
                const _errorMsg = `Update action not available for ${tableType}`

                if (enableLogging) {
                }

                if (onError) {
                    onError('Action not available', 'update')
                }

                return false
            }

            return executeAction('update', () => actions.update!(row.id, data))
        },
        [actions.update, executeAction, tableType, enableLogging, onError]
    )

    /**
     * Delete handler
     */
    const handleDelete = useCallback(
        async (row: TData & { id: string }): Promise<boolean> => {
            if (!actions.delete) {
                const _errorMsg = `Delete action not available for ${tableType}`

                if (enableLogging) {
                }

                if (onError) {
                    onError('Action not available', 'delete')
                }

                return false
            }

            return executeAction('delete', () => actions.delete!(row.id))
        },
        [actions.delete, executeAction, tableType, enableLogging, onError]
    )

    /**
     * Duplicate handler
     */
    const handleDuplicate = useCallback(
        async (row: TData & { id: string }): Promise<boolean> => {
            if (!actions.duplicate) {
                const _errorMsg = `Duplicate action not available for ${tableType}`

                if (enableLogging) {
                }

                if (onError) {
                    onError('Action not available', 'duplicate')
                }

                return false
            }

            return executeAction('duplicate', () => actions.duplicate!(row.id))
        },
        [actions.duplicate, executeAction, tableType, enableLogging, onError]
    )

    return {
        // Raw actions from provider
        actions,

        // Enhanced handlers
        handleCreate,
        handleEdit,
        handleDelete,
        handleDuplicate,

        // Utility
        hasAction: (actionName: keyof TableActions) => !!actions[actionName],
        isActionsAvailable: Object.keys(actions).length > 1 // More than just 'list'
    }
}
