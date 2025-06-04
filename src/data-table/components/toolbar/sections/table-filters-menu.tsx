"use client"

import {
    StackMenuBackButton,
    StackMenuContent,
    StackMenuHeader,
    StackMenuItem,
    StackMenuTitle,
    StackMenuView
} from "@/components/ui/stack-menu"
import { ArrowUpDown, Filter, X } from "lucide-react"
import { useTranslations } from "../../../providers/table-provider"
import { useMemo } from "react"

import type { ColumnFiltersState } from "@tanstack/react-table"

export interface TableFiltersMenuProps {
    columnFilters: ColumnFiltersState
    columns: {
        canFilter?: boolean
        canGroup?: boolean
        canHide?: boolean
        canSort?: boolean
        id: string
        label: string
    }[]
    invalidateTable: () => Promise<void>
    setColumnFilters: (state: ColumnFiltersState) => void
    tableId: string
}

export function TableFiltersMenu({
    columnFilters,
    columns,
    invalidateTable,
    setColumnFilters,
    tableId
}: TableFiltersMenuProps) {
    const { t } = useTranslations()

    // Get filterable columns
    const filterableColumns = useMemo(
        () => columns.filter((col) => col.canFilter !== false),
        [columns]
    )

    // Skip rendering if no filterable columns
    if (filterableColumns.length === 0) return null

    return (
        <StackMenuView name="filters">
            <StackMenuHeader>
                <StackMenuBackButton icon={<ArrowUpDown className="h-4 w-4 rotate-90" />}>
                    Retour
                </StackMenuBackButton>
                <StackMenuTitle>Filtrer</StackMenuTitle>
            </StackMenuHeader>

            <StackMenuContent>
                {/* Clear all filters option */}
                {columnFilters.length > 0 && (
                    <StackMenuItem
                        icon={<X className="h-5 w-5" />}
                        onClick={() => {
                            if (columnFilters.length > 0) {
                                setColumnFilters([])
                            }
                        }}
                    >
                        {t("filters.clear_all")}
                    </StackMenuItem>
                )}

                {filterableColumns.map((column) => {
                    const filter = columnFilters.find((f) => f.id === column.id)

                    return (
                        <StackMenuItem
                            endIcon={
                                filter ? (
                                    <div className="flex h-4 w-4 items-center justify-center rounded-sm border border-current">
                                        <div className="h-2 w-2 rounded-sm bg-current" />
                                    </div>
                                ) : (
                                    <div className="h-4 w-4 rounded-sm border border-current" />
                                )
                            }
                            icon={<Filter className="h-5 w-5" />}
                            key={column.id}
                            onClick={() => {
                                if (filter) {
                                    setColumnFilters(
                                        columnFilters.filter((f) => f.id !== column.id)
                                    )
                                } else {
                                    setColumnFilters([
                                        ...columnFilters,
                                        { id: column.id, value: "" }
                                    ])
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
