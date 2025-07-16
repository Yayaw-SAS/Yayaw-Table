'use client'

import type { SortingState } from '@tanstack/react-table'
import { ArrowDownAZ, ArrowUpAZ, ArrowUpDown, X } from 'lucide-react'
import {
    StackMenuContent,
    StackMenuItem,
    StackMenuView
} from '@/src/components/ui-custom/stack-menu'
import { useDataTable } from '../../../hooks/use-data-table'
import { useTranslations } from '../../../providers/table-provider'

export interface TableSortMenuProps {
    columns: Array<{
        canSort?: boolean
        getCanSort: () => boolean
        id: string
        label: string
    }>
    invalidateTable: () => Promise<void>
    setSorting: (state: SortingState) => void
    sorting: SortingState
    tableId: string
}

export function TableSortMenu({
    columns,
    invalidateTable,
    setSorting,
    sorting,
    tableId
}: TableSortMenuProps) {
    const { t } = useTranslations()

    // Get table configuration to access column headers with translations
    const { config } = useDataTable({
        tableType: tableId
    })

    // Get sortable columns
    const sortableColumns = columns.filter((col) => {
        const canSort =
            typeof col.getCanSort === 'function' ? col.getCanSort() : col.canSort !== false
        return canSort
    })

    // Skip rendering if no sortable columns
    if (sortableColumns.length === 0) {
        return null
    }

    return (
        <StackMenuView name="sort">
            <StackMenuContent>
                {/* Clear sort option */}
                {sorting.length > 0 && (
                    <StackMenuItem icon={<X className="h-5 w-5" />} onClick={() => setSorting([])}>
                        {t('common.reset')}
                    </StackMenuItem>
                )}

                {/* Sort options */}
                {sortableColumns.map((column) => {
                    const columnId = column.id
                    const sortOrder = sorting.find((sort) => sort.id === columnId)?.desc
                    const isActiveSorted = sortOrder !== undefined

                    // Get column configuration from table config to get proper translated header
                    const columnConfig = config?.columns?.definitions?.find(
                        (def: { id: string; header?: string }) => def.id === columnId
                    )

                    // Use translated header from config, with fallbacks
                    let columnLabel: string
                    if (columnId === 'select') {
                        columnLabel = t('common.selection')
                    } else if (columnId === 'actions') {
                        columnLabel = t('actions.title')
                    } else if (columnConfig?.header) {
                        // Try to translate the header from config
                        columnLabel = t(columnConfig.header)
                    } else {
                        // Fallback to the label from the column or columnId
                        columnLabel = column.label || columnId
                    }

                    return (
                        <StackMenuItem
                            className={isActiveSorted ? 'bg-accent font-medium' : ''}
                            icon={
                                sortOrder === undefined ? (
                                    <ArrowUpDown className="h-5 w-5 text-muted-foreground" />
                                ) : sortOrder ? (
                                    <ArrowDownAZ className="h-5 w-5 text-foreground" />
                                ) : (
                                    <ArrowUpAZ className="h-5 w-5 text-foreground" />
                                )
                            }
                            key={columnId}
                            onClick={() => {
                                if (sortOrder === undefined) {
                                    // First click: ascending
                                    setSorting([{ desc: false, id: columnId }])
                                } else if (sortOrder) {
                                    // Third click: remove sort
                                    setSorting([])
                                } else {
                                    // Second click: descending
                                    setSorting([{ desc: true, id: columnId }])
                                }
                            }}
                        >
                            <span className={isActiveSorted ? 'font-medium' : ''}>
                                {columnLabel}
                            </span>
                        </StackMenuItem>
                    )
                })}
            </StackMenuContent>
        </StackMenuView>
    )
}
