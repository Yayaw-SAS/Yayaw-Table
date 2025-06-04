"use client"

import {
    StackMenuBackButton,
    StackMenuContent,
    StackMenuHeader,
    StackMenuItem,
    StackMenuTitle,
    StackMenuView
} from "@/components/ui/stack-menu"
import { ArrowDownAZ, ArrowUpAZ, ArrowUpDown, X } from "lucide-react"
import { useTranslations } from "../../../providers/table-provider"

import type { SortingState } from "@tanstack/react-table"

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

    // Get sortable columns
    const sortableColumns = columns.filter((col) =>
        typeof col.getCanSort === "function" ? col.getCanSort() : col.canSort !== false
    )
    // Skip rendering if no sortable columns
    if (sortableColumns.length === 0) return null

    return (
        <StackMenuView name="sort">
            <StackMenuHeader>
                <StackMenuBackButton icon={<ArrowUpDown className="h-4 w-4 rotate-90" />}>
                    {t("common.back", { defaultValue: "Retour" })}
                </StackMenuBackButton>
                <StackMenuTitle>{t("sort.title", { defaultValue: "Trier" })}</StackMenuTitle>
            </StackMenuHeader>

            <StackMenuContent>
                {/* Clear sort option */}
                {sorting.length > 0 && (
                    <StackMenuItem icon={<X className="h-5 w-5" />} onClick={() => setSorting([])}>
                        {t("sort.clear")}
                    </StackMenuItem>
                )}

                {/* Sort options */}
                {sortableColumns.map((column) => {
                    const columnId = column.id
                    const sortOrder = sorting.find((sort) => sort.id === columnId)?.desc

                    // Use the label property directly (from our enriched object)
                    const columnLabel = column.label || columnId

                    return (
                        <StackMenuItem
                            icon={
                                sortOrder === undefined ? (
                                    <ArrowUpAZ className="h-5 w-5" />
                                ) : sortOrder ? (
                                    <ArrowDownAZ className="h-5 w-5" />
                                ) : (
                                    <ArrowUpAZ className="h-5 w-5" />
                                )
                            }
                            key={columnId}
                            onClick={() => {
                                if (sortOrder === undefined) {
                                    // First click: ascending
                                    setSorting([{ desc: false, id: columnId }])
                                } else if (!sortOrder) {
                                    // Second click: descending
                                    setSorting([{ desc: true, id: columnId }])
                                } else {
                                    // Third click: remove sort
                                    setSorting([])
                                }
                            }}
                        >
                            {columnLabel}
                        </StackMenuItem>
                    )
                })}
            </StackMenuContent>
        </StackMenuView>
    )
}
