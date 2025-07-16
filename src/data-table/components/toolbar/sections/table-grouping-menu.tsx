'use client'

import type { GroupingState } from '@tanstack/react-table'
import { Group, X } from 'lucide-react'
import { useMemo } from 'react'
import {
    StackMenuContent,
    StackMenuItem,
    StackMenuView
} from '@/src/components/ui-custom/stack-menu'
import { useTranslations } from '../../../providers/table-provider'

export interface TableGroupingMenuProps {
    columns: {
        canFilter?: boolean
        canGroup?: boolean
        canHide?: boolean
        canSort?: boolean
        id: string
        label: string
    }[]
    grouping: GroupingState
    invalidateTable: () => Promise<void>
    setGrouping: (state: GroupingState) => void
    tableId: string
}

export function TableGroupingMenu({
    columns,
    grouping,
    setGrouping,
    tableId
}: TableGroupingMenuProps) {
    const { t } = useTranslations()

    // Get groupable columns
    const groupableColumns = useMemo(
        () => columns.filter((col) => col.canGroup !== false),
        [columns]
    )

    // Skip rendering if no groupable columns
    if (groupableColumns.length === 0) {
        return null
    }

    return (
        <StackMenuView name="group">
            <StackMenuContent>
                {/* Clear all groups option */}
                {grouping.length > 0 && (
                    <StackMenuItem
                        icon={<X className="h-5 w-5" />}
                        onClick={() => {
                            if (grouping.length > 0) {
                                setGrouping([])
                            }
                        }}
                    >
                        {t('common.reset')}
                    </StackMenuItem>
                )}

                {/* Individual column grouping */}
                {groupableColumns.map((column) => {
                    const isGrouped = grouping.includes(column.id)

                    return (
                        <StackMenuItem
                            endIcon={
                                <div className="flex h-4 w-4 items-center justify-center rounded-sm border border-current">
                                    {isGrouped && <div className="h-2 w-2 rounded-sm bg-current" />}
                                </div>
                            }
                            icon={<Group className="h-5 w-5" />}
                            key={column.id}
                            onClick={() => {
                                if (isGrouped) {
                                    setGrouping(grouping.filter((id) => id !== column.id))
                                } else {
                                    setGrouping([...grouping, column.id])
                                }
                            }}
                        >
                            {column.label}
                        </StackMenuItem>
                    )
                })}
            </StackMenuContent>
        </StackMenuView>
    )
}
