/**
 * Advanced table filters menu
 * Modern replacement for TableFiltersMenu using advanced filtering system
 */
"use client"

import {
    StackMenuBackButton,
    StackMenuContent,
    StackMenuHeader,
    StackMenuTitle,
    StackMenuView
} from "@/components/ui/stack-menu"
import { ArrowUpDown, Filter, Plus, X } from "lucide-react"
import { useTranslations } from "../../../providers/table-provider"
import { useCallback, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

import type { ColumnFiltersState } from "@tanstack/react-table"
import type {
    AdvancedFiltersState,
    ColumnsFilterConfig,
    FilterActions,
    ColumnDataType
} from "../../../types/filter-types"

import { AdvancedFilterPanel, CompactFilterPanel } from "../../filters/advanced-filter-panel"

export interface AdvancedTableFiltersMenuProps {
    /** Legacy column filters for backward compatibility */
    columnFilters: ColumnFiltersState
    /** Available columns */
    columns: {
        canFilter?: boolean
        canGroup?: boolean
        canHide?: boolean
        canSort?: boolean
        id: string
        label: string
    }[]
    /** Advanced filters state */
    advancedFilters?: AdvancedFiltersState
    /** Advanced filters actions */
    advancedActions?: FilterActions
    /** Advanced columns configuration */
    advancedColumnsConfig?: ColumnsFilterConfig
    /** Whether to use advanced filtering mode */
    useAdvancedFilters?: boolean
    /** Callback to convert legacy filter to advanced */
    onConvertToAdvanced?: (columnId: string, type: ColumnDataType) => void
    /** Legacy setColumnFilters for backward compatibility */
    setColumnFilters: (state: ColumnFiltersState) => void
    /** Table invalidation function */
    invalidateTable: () => Promise<void>
    /** Table identifier */
    tableId: string
}

/**
 * Legacy filter item component for backward compatibility
 */
function LegacyFilterItem({
    column,
    isActive,
    onToggle,
    onConvertToAdvanced
}: {
    column: { id: string; label: string }
    isActive: boolean
    onToggle: () => void
    onConvertToAdvanced?: (columnId: string, type: ColumnDataType) => void
}) {
    const [showConvertOptions, setShowConvertOptions] = useState(false)

    const handleConvert = useCallback((type: ColumnDataType) => {
        onConvertToAdvanced?.(column.id, type)
        setShowConvertOptions(false)
    }, [column.id, onConvertToAdvanced])

    return (
        <div className="flex items-center justify-between p-2 hover:bg-accent rounded-lg">
            <div className="flex items-center gap-3">
                <button
                    onClick={onToggle}
                    className="flex h-4 w-4 items-center justify-center rounded-sm border border-current"
                >
                    {isActive && <div className="h-2 w-2 rounded-sm bg-current" />}
                </button>
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span>{column.label}</span>
            </div>

            {onConvertToAdvanced && (
                <div className="flex items-center gap-2">
                    {showConvertOptions ? (
                        <div className="flex gap-1">
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleConvert('text')}
                                className="h-6 px-2 text-xs"
                            >
                                Text
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleConvert('number')}
                                className="h-6 px-2 text-xs"
                            >
                                Number
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleConvert('date')}
                                className="h-6 px-2 text-xs"
                            >
                                Date
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleConvert('option')}
                                className="h-6 px-2 text-xs"
                            >
                                Option
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setShowConvertOptions(false)}
                                className="h-6 px-2 text-xs"
                            >
                                Cancel
                            </Button>
                        </div>
                    ) : (
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setShowConvertOptions(true)}
                            className="h-6 px-2 text-xs text-primary"
                        >
                            Upgrade
                        </Button>
                    )}
                </div>
            )}
        </div>
    )
}

/**
 * Advanced table filters menu component
 */
export function AdvancedTableFiltersMenu({
    columnFilters,
    columns,
    advancedFilters = [],
    advancedActions,
    advancedColumnsConfig = {},
    useAdvancedFilters = false,
    onConvertToAdvanced,
    setColumnFilters,
    invalidateTable,
    tableId
}: AdvancedTableFiltersMenuProps) {
    const { t } = useTranslations()

    // Get filterable columns
    const filterableColumns = useMemo(
        () => columns.filter((col) => col.canFilter !== false),
        [columns]
    )

    // Calculate legacy and advanced filter stats
    const legacyFiltersCount = columnFilters.length
    const advancedFiltersCount = advancedFilters.filter(f => f.isActive).length
    const totalFiltersCount = legacyFiltersCount + advancedFiltersCount

    // Handle legacy filter toggle
    const handleLegacyToggle = useCallback((columnId: string) => {
        const existingFilter = columnFilters.find(f => f.id === columnId)
        if (existingFilter) {
            setColumnFilters(columnFilters.filter(f => f.id !== columnId))
        } else {
            setColumnFilters([...columnFilters, { id: columnId, value: "" }])
        }
    }, [columnFilters, setColumnFilters])

    // Handle clear all filters
    const handleClearAll = useCallback(() => {
        setColumnFilters([])
        advancedActions?.clearFilters()
    }, [setColumnFilters, advancedActions])

    // Skip rendering if no filterable columns
    if (filterableColumns.length === 0) return null

    return (
        <StackMenuView name="filters">
            <StackMenuHeader>
                <StackMenuBackButton icon={<ArrowUpDown className="h-4 w-4 rotate-90" />}>
                    {t("menu.back")}
                </StackMenuBackButton>
                <StackMenuTitle>
                    <div className="flex items-center gap-2">
                        <span>{t("menu.filter")}</span>
                        {totalFiltersCount > 0 && (
                            <Badge variant="secondary" className="text-xs">
                                {totalFiltersCount}
                            </Badge>
                        )}
                    </div>
                </StackMenuTitle>
            </StackMenuHeader>

            <StackMenuContent>
                <ScrollArea className="max-h-96">
                    <div className="space-y-4">
                        {/* Advanced Filters Section */}
                        {useAdvancedFilters && advancedActions && Object.keys(advancedColumnsConfig).length > 0 && (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-medium text-foreground">
                                        Advanced Filters
                                    </h4>
                                    {advancedFiltersCount > 0 && (
                                        <Badge variant="default" className="text-xs">
                                            {advancedFiltersCount} active
                                        </Badge>
                                    )}
                                </div>

                                <CompactFilterPanel
                                    filters={advancedFilters}
                                    columnsConfig={advancedColumnsConfig}
                                    actions={advancedActions}
                                />

                                {(legacyFiltersCount > 0 || filterableColumns.length > 0) && (
                                    <Separator className="my-3" />
                                )}
                            </div>
                        )}

                        {/* Legacy Filters Section */}
                        {filterableColumns.length > 0 && (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-medium text-foreground">
                                        {useAdvancedFilters ? 'Basic Filters' : 'Filters'}
                                    </h4>
                                    {legacyFiltersCount > 0 && (
                                        <Badge variant="secondary" className="text-xs">
                                            {legacyFiltersCount} active
                                        </Badge>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    {filterableColumns.map((column) => {
                                        const isActive = columnFilters.some(f => f.id === column.id)
                                        
                                        return (
                                            <LegacyFilterItem
                                                key={column.id}
                                                column={column}
                                                isActive={isActive}
                                                onToggle={() => handleLegacyToggle(column.id)}
                                                onConvertToAdvanced={
                                                    useAdvancedFilters && onConvertToAdvanced 
                                                        ? onConvertToAdvanced 
                                                        : undefined
                                                }
                                            />
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Clear All Section */}
                        {totalFiltersCount > 0 && (
                            <>
                                <Separator className="my-3" />
                                <Button
                                    variant="ghost"
                                    onClick={handleClearAll}
                                    className="w-full justify-start"
                                >
                                    <X className="h-4 w-4 mr-2" />
                                    {t("filters.clear")} ({totalFiltersCount})
                                </Button>
                            </>
                        )}

                        {/* No Filters State */}
                        {totalFiltersCount === 0 && (
                            <div className="text-center py-6 text-muted-foreground">
                                <Filter className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">No active filters</p>
                                <p className="text-xs">Click on a column to add a filter</p>
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </StackMenuContent>
        </StackMenuView>
    )
}

/**
 * Simple wrapper for backward compatibility with existing TableFiltersMenu
 */
export function TableFiltersMenuAdvanced(props: Omit<AdvancedTableFiltersMenuProps, 'advancedFilters' | 'advancedActions' | 'advancedColumnsConfig' | 'useAdvancedFilters' | 'onConvertToAdvanced'>) {
    return (
        <AdvancedTableFiltersMenu
            {...props}
            useAdvancedFilters={false}
        />
    )
} 