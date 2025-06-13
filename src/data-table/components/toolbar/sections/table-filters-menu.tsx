"use client"

import {
    StackMenuBackButton,
    StackMenuContent,
    StackMenuHeader,
    StackMenuTitle,
    StackMenuView
} from "@/components/ui/stack-menu"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ArrowUpDown, Filter, X, Plus, Search, Type, Hash, Calendar, CheckSquare, List } from "lucide-react"
import { useTranslations } from "../../../providers/table-provider"
import { useMemo, useState, useCallback, useEffect } from "react"

import type { ColumnFiltersState } from "@tanstack/react-table"
import type { AdvancedFiltersState, FilterActions, ColumnsFilterConfig, ColumnDataType } from "../../../types/filter-types"
import { formatFilterValueForDisplay } from "../../../utils/advanced-filters"
import { FilterValueInput, getDefaultFilterOperator, getDefaultFilterValue } from "../../filters/filter-value-input"

// Debug flag
const DEBUG = true

// Icons pour les types de données
const typeIcons = {
    text: Type,
    number: Hash,
    date: Calendar,
    option: CheckSquare,
    multiOption: List
} as const

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
    const [searchTerm, setSearchTerm] = useState('')

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

    // Get filterable columns
    const filterableColumns = useMemo(() => {
        // Temporairement, on ignore la condition canFilter === false pour debug
        // const filterable = columns.filter((col) => col.canFilter !== false)
        
        // Skip only system columns
        const filterable = columns.filter((col) => 
            col.id !== 'select' && 
            col.id !== 'actions'
        )
        
        if (DEBUG) {
            console.log("TableFiltersMenu - filterableColumns (before filter):", columns)
            console.log("TableFiltersMenu - filterableColumns (after filter):", filterable)
        }
        return filterable
    }, [columns])

    // Filter columns based on search
    const filteredColumns = useMemo(() => {
        if (!searchTerm) return filterableColumns
        return filterableColumns.filter(col => 
            col.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
            col.id.toLowerCase().includes(searchTerm.toLowerCase())
        )
    }, [filterableColumns, searchTerm])

    // Add new advanced filter
    const handleAddAdvancedFilter = useCallback((columnId: string) => {
        console.log("🚀 handleAddAdvancedFilter - START for column:", columnId)
        
        if (!advancedActions || !advancedColumnsConfig) {
            console.error("🚀 handleAddAdvancedFilter - MISSING DEPS:", {
                hasAdvancedActions: !!advancedActions,
                hasAdvancedColumnsConfig: !!advancedColumnsConfig,
                advancedActions,
                advancedColumnsConfig
            })
            return
        }
        
        const config = advancedColumnsConfig[columnId]
        console.log("🚀 handleAddAdvancedFilter - Config for", columnId, ":", config)
        
        if (!config) {
            console.error("🚀 handleAddAdvancedFilter - NO CONFIG for column:", columnId)
            console.log("🚀 handleAddAdvancedFilter - Available configs:", Object.keys(advancedColumnsConfig))
            return
        }

        const operator = getDefaultFilterOperator(config.type)
        const value = getDefaultFilterValue(config.type, operator)
        
        console.log("🚀 handleAddAdvancedFilter - Filter data:", {
            columnId,
            type: config.type,
            operator,
            value
        })

        const filterData = {
            columnId,
            type: config.type,
            operator,
            values: value,
            isActive: true
        }
        
        console.log("🚀 handleAddAdvancedFilter - Calling advancedActions.addFilter with:", filterData)
        
        try {
            advancedActions.addFilter(filterData)
            console.log("🚀 handleAddAdvancedFilter - SUCCESS!")
        } catch (error) {
            console.error("🚀 handleAddAdvancedFilter - ERROR:", error)
        }
    }, [advancedActions, advancedColumnsConfig])

    // Toggle legacy filter
    const handleToggleLegacyFilter = useCallback((columnId: string) => {
        if (DEBUG) {
            console.log("TableFiltersMenu - handleToggleLegacyFilter called for:", columnId)
        }
        
        const filter = columnFilters.find((f) => f.id === columnId)
        
        if (filter) {
            setColumnFilters(columnFilters.filter((f) => f.id !== columnId))
        } else {
            setColumnFilters([...columnFilters, { id: columnId, value: "" }])
        }
    }, [columnFilters, setColumnFilters])

    // Clear all filters
    const handleClearAll = useCallback(() => {
        if (DEBUG) {
            console.log("TableFiltersMenu - handleClearAll called")
        }
        
        if (useAdvancedFilters && advancedActions) {
            advancedActions.clearFilters()
        } else {
            setColumnFilters([])
        }
    }, [useAdvancedFilters, advancedActions, setColumnFilters])

    // Skip rendering if no filterable columns
    if (filterableColumns.length === 0) {
        if (DEBUG) {
            console.warn("TableFiltersMenu - No filterable columns, skipping render")
        }
        return null
    }

    const totalActiveFilters = useAdvancedFilters 
        ? advancedFilters.filter(f => f.isActive).length
        : columnFilters.length

    if (DEBUG) {
        console.log("TableFiltersMenu - Rendering with:", {
            totalActiveFilters,
            filteredColumnsCount: filteredColumns.length,
            useAdvancedFilters
        })
    }

    return (
        <StackMenuView name="filters">
            <StackMenuHeader>
                <StackMenuBackButton icon={<ArrowUpDown className="h-4 w-4 rotate-90" />}>
                    {t("menu.back")}
                </StackMenuBackButton>
                <StackMenuTitle>
                    <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4" />
                        {t("menu.filter")}
                        {totalActiveFilters > 0 && (
                            <Badge variant="secondary" className="text-xs">
                                {totalActiveFilters}
                            </Badge>
                        )}
                    </div>
                </StackMenuTitle>
            </StackMenuHeader>

            <StackMenuContent className="w-full p-2">
                {/* Debug info */}
                {DEBUG && (
                    <div className="mb-4 p-2 bg-yellow-100 border border-yellow-300 rounded text-xs">
                        <div>Debug Info:</div>
                        <div>• Columns: {columns.length}</div>
                        <div>• Filterable: {filterableColumns.length}</div>
                        <div>• Advanced: {useAdvancedFilters ? 'Yes' : 'No'}</div>
                        <div>• Config keys: {Object.keys(advancedColumnsConfig).join(', ')}</div>
                    </div>
                )}

                {/* Search bar */}
                <div className="mb-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search columns..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 h-8"
                        />
                    </div>
                </div>

                {/* Active Filters Section */}
                {totalActiveFilters > 0 && (
                    <div className="mb-4">
                        <div className="mb-2 flex items-center justify-between">
                            <div className="px-2 font-medium text-muted-foreground text-sm">
                                Active Filters ({totalActiveFilters})
                            </div>
                            <Button
                                size="sm"
                                variant="link"
                                onClick={handleClearAll}
                                className="h-6 px-2 text-xs text-primary hover:text-primary"
                            >
                                Clear all
                            </Button>
                        </div>
                        
                        <div className="space-y-2">
                            {/* Advanced Filters */}
                            {useAdvancedFilters && advancedFilters.map((filter) => {
                                const config = advancedColumnsConfig[filter.columnId]
                                if (!config) return null

                                const TypeIcon = typeIcons[filter.type]
                                const displayValue = formatFilterValueForDisplay(
                                    filter.type,
                                    filter.operator,
                                    filter.values,
                                    config.options
                                )

                                return (
                                    <div
                                        key={filter.id}
                                        className="group flex items-center gap-2 p-2 rounded-md border bg-card/50 hover:bg-card transition-colors"
                                    >
                                        <div className="flex items-center justify-center w-6 h-6 rounded border bg-muted">
                                            <TypeIcon className="h-3 w-3" />
                                        </div>
                                        
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1">
                                                <span className="text-sm font-medium truncate">
                                                    {filter.label || filter.columnId}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {filter.operator}
                                                </span>
                                            </div>
                                            <div className="text-xs text-muted-foreground truncate">
                                                {displayValue || "No value"}
                                            </div>
                                        </div>

                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => advancedActions?.toggleFilter(filter.id)}
                                            className="h-6 w-6 p-0"
                                        >
                                            <div className={`w-3 h-3 rounded-sm border-2 transition-colors ${
                                                filter.isActive 
                                                    ? "bg-primary border-primary" 
                                                    : "border-muted-foreground/30"
                                            }`}>
                                                {filter.isActive && (
                                                    <div className="w-full h-full bg-primary-foreground rounded-sm scale-50" />
                                                )}
                                            </div>
                                        </Button>

                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => advancedActions?.removeFilter(filter.id)}
                                            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </div>
                                )
                            })}

                            {/* Legacy Filters */}
                            {!useAdvancedFilters && columnFilters.map((filter) => {
                                const column = columns.find(col => col.id === filter.id)
                                if (!column) return null

                                return (
                                    <div
                                        key={filter.id}
                                        className="group flex items-center gap-2 p-2 rounded-md border bg-card/50 hover:bg-card transition-colors"
                                    >
                                        <div className="flex items-center justify-center w-6 h-6 rounded border bg-muted">
                                            <Filter className="h-3 w-3" />
                                        </div>
                                        
                                        <div className="flex-1">
                                            <span className="text-sm font-medium">
                                                {column.label}
                                            </span>
                                        </div>

                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleToggleLegacyFilter(filter.id)}
                                            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </div>
                                )
                            })}
                        </div>

                        <Separator className="my-4" />
                    </div>
                )}

                {/* Available Columns */}
                <div>
                    <div className="mb-2 px-2 font-medium text-muted-foreground text-sm">
                        Add Filter ({filteredColumns.length} available)
                    </div>

                    <div className="space-y-1">
                        {filteredColumns.length === 0 ? (
                            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                                No columns found
                            </div>
                        ) : (
                            filteredColumns.map((column) => {
                                const hasLegacyFilter = columnFilters.some((f) => f.id === column.id)
                                const hasAdvancedFilter = useAdvancedFilters && 
                                    advancedFilters.some(f => f.columnId === column.id)
                                
                                const config = advancedColumnsConfig[column.id]
                                const TypeIcon = config ? typeIcons[config.type] : Filter
                                const isDisabled = hasLegacyFilter || hasAdvancedFilter

                                if (DEBUG) {
                                    console.log(`Column ${column.id}:`, { 
                                        hasConfig: !!config, 
                                        type: config?.type,
                                        isDisabled,
                                        hasLegacyFilter,
                                        hasAdvancedFilter
                                    })
                                }

                                return (
                                    <div
                                        key={column.id}
                                        className={`group flex items-center gap-2 p-2 rounded-md transition-colors ${
                                            isDisabled 
                                                ? "opacity-50 cursor-not-allowed" 
                                                : "hover:bg-accent cursor-pointer"
                                        }`}
                                        onClick={() => {
                                            console.log("🔥 CLICK EVENT - Column clicked:", column.id)
                                            console.log("🔥 CLICK EVENT - isDisabled:", isDisabled)
                                            console.log("🔥 CLICK EVENT - useAdvancedFilters:", useAdvancedFilters)
                                            console.log("🔥 CLICK EVENT - advancedActions:", !!advancedActions)
                                            console.log("🔥 CLICK EVENT - advancedColumnsConfig:", advancedColumnsConfig)
                                            
                                            if (!isDisabled) {
                                                if (useAdvancedFilters) {
                                                    console.log("🔥 CLICK EVENT - Calling handleAddAdvancedFilter")
                                                    handleAddAdvancedFilter(column.id)
                                                } else {
                                                    console.log("🔥 CLICK EVENT - Calling handleToggleLegacyFilter")
                                                    handleToggleLegacyFilter(column.id)
                                                }
                                            } else {
                                                console.log("🔥 CLICK EVENT - Disabled, not adding filter")
                                            }
                                        }}
                                    >
                                        <div className="flex items-center justify-center w-6 h-6 rounded border bg-muted">
                                            <TypeIcon className="h-3 w-3" />
                                        </div>
                                        
                                        <div className="flex-1">
                                            <div className="flex flex-col items-start">
                                                <span className="text-sm font-medium">{column.label}</span>
                                                {config && (
                                                    <span className="text-xs text-muted-foreground capitalize">
                                                        {config.type}
                                                    </span>
                                                )}
                                                {DEBUG && (
                                                    <span className="text-xs text-blue-500">
                                                        ID: {column.id}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-center w-6 h-6">
                                            {isDisabled ? (
                                                <div className="w-3 h-3 rounded-sm border border-current bg-current" />
                                            ) : (
                                                <Plus className="h-3 w-3 text-muted-foreground group-hover:text-foreground" />
                                            )}
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>
            </StackMenuContent>
        </StackMenuView>
    )
}
