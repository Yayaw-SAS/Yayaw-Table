"use client"

import {
    StackMenuContent,
    StackMenuView
} from "@/src/components/ui-custom/stack-menu"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Plus, Filter, X } from "lucide-react"
import { useTranslations } from "../../../providers/table-provider"
import { useMemo, useState, useCallback, useEffect } from "react"

import type { ColumnFiltersState } from "@tanstack/react-table"
import type { AdvancedFiltersState, FilterActions, ColumnsFilterConfig, ColumnDataType } from "../../../types/filter-types"
import { AdvancedFilterPanel } from "../../filters/advanced-filter-panel"

// Debug flag
const DEBUG = true

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
    // Props pour filtres avancés (optionnels)
    advancedFilters?: AdvancedFiltersState
    advancedActions?: FilterActions
    advancedColumnsConfig?: ColumnsFilterConfig
    useAdvancedFilters?: boolean
}

export function TableFiltersMenu({
    columnFilters,
    columns,
    invalidateTable,
    setColumnFilters,
    tableId,
    advancedFilters = [],
    advancedActions,
    advancedColumnsConfig = {},
    useAdvancedFilters = false
}: TableFiltersMenuProps) {
    const { t } = useTranslations()

    // Debug logs
    useEffect(() => {
        if (DEBUG) {
            console.log("=== TableFiltersMenu Debug ===")
            console.log("tableId:", tableId)
            console.log("columnFilters:", columnFilters)
            console.log("columns:", columns)
            console.log("useAdvancedFilters:", useAdvancedFilters)
            console.log("advancedFilters:", advancedFilters)
            console.log("advancedActions:", advancedActions)
            console.log("advancedColumnsConfig:", advancedColumnsConfig)
            console.log("==============================")
        }
    }, [tableId, columnFilters, columns, useAdvancedFilters, advancedFilters, advancedActions, advancedColumnsConfig])

    // Use advanced filters if enabled and we have the proper setup
    if (useAdvancedFilters && advancedActions && Object.keys(advancedColumnsConfig).length > 0) {
        return (
            <StackMenuView name="filters">
                <StackMenuContent className="p-0">
                    {/* Debug info */}
                    {DEBUG && (
                        <div className="m-3 p-2 bg-yellow-100 border border-yellow-300 rounded text-xs">
                            <div>Debug Info (Advanced Mode):</div>
                            <div>• Columns: {columns.length}</div>
                            <div>• Advanced Filters: {advancedFilters.length}</div>
                            <div>• Config keys: {Object.keys(advancedColumnsConfig).join(', ')}</div>
                            <div>• Actions available: {!!advancedActions}</div>
                        </div>
                    )}

                    {/* Use the full Bazza UI Advanced Filter Panel */}
                    <AdvancedFilterPanel
                        filters={advancedFilters}
                        columnsConfig={advancedColumnsConfig}
                        actions={advancedActions}
                        className="border-0"
                        variant="modern"
                        showAddButton={true}
                        showClearButton={true}
                        showPerformance={false}
                        enableAnimations={true}
                        maxVisibleFilters={5}
                        recentColumns={[]}
                        popularColumns={['name', 'status', 'category']}
                    />
                </StackMenuContent>
            </StackMenuView>
        )
    }

    // Fallback to legacy filter interface
    return (
        <StackMenuView name="filters">
            <StackMenuContent>
                <div className="space-y-4">
                    <div className="text-center py-8 text-muted-foreground">
                        <Filter className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Advanced filters not available</p>
                        <p className="text-xs">Enable advanced filters to use this feature</p>
                    </div>

                    {/* Show legacy column filters if any exist */}
                    {columnFilters.length > 0 && (
                        <div className="space-y-2">
                            <Separator />
                            <h4 className="text-sm font-medium">Legacy Filters</h4>
                            {columnFilters.map((filter, index) => (
                                <div key={`${filter.id}-${index}`} className="flex items-center gap-2 p-2 rounded-md border">
                                    <span className="text-sm font-medium">{filter.id}</span>
                                    <span className="text-xs text-muted-foreground">:</span>
                                    <span className="text-sm">{String(filter.value)}</span>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                            const newFilters = columnFilters.filter((_, i) => i !== index)
                                            setColumnFilters(newFilters)
                                        }}
                                        className="h-6 w-6 p-0 ml-auto"
                                    >
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </StackMenuContent>
        </StackMenuView>
    )
}