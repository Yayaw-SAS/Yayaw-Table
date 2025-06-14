/**
 * Advanced filter panel component
 * Main interface for managing advanced filters with design inspired by bazza/ui and Linear
 */
"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList
} from "@/components/ui/command"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import {
    Popover,
    PopoverContent,
    PopoverTrigger
} from "@/components/ui/popover"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from "@/components/ui/tooltip"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { ChevronDown, Filter, MoreHorizontal, Plus, X, Settings2, Zap } from "lucide-react"
import { useCallback, useMemo, useState, useEffect } from "react"
import type {
    AdvancedFiltersState,
    AdvancedFilterModel,
    ColumnsFilterConfig,
    FilterActions,
    ColumnDataType
} from "../../types/filter-types"
import { formatFilterValueForDisplay } from "../../utils/advanced-filters"

import {
    FilterValueInput,
    getDefaultFilterOperator,
    getDefaultFilterValue
} from "./filter-value-input"
import { ModernAddFilterDropdown } from "./modern-add-filter-dropdown"
import { 
    FilterLoadingState, 
    FilterEmptyState, 
    FilterSuccessState,
    FilterPerformanceIndicator 
} from "./modern-filter-states"

export interface AdvancedFilterPanelProps {
    /** Current filters state */
    filters: AdvancedFiltersState
    /** Available columns configuration */
    columnsConfig: ColumnsFilterConfig
    /** Filter actions */
    actions: FilterActions
    /** Whether the panel is disabled */
    disabled?: boolean
    /** Maximum number of visible filter chips before showing count */
    maxVisibleFilters?: number
    /** Whether to show the "Add filter" button */
    showAddButton?: boolean
    /** Whether to show the "Clear all" button */
    showClearButton?: boolean
    /** Custom className */
    className?: string
    /** Loading state */
    isLoading?: boolean
    /** Error state */
    error?: string | null
    /** Filter performance metrics */
    performance?: {
        filterTime: number
        isOptimized: boolean
        resultCount?: number
    }
    /** Variant style */
    variant?: 'default' | 'modern' | 'compact' | 'minimal'
    /** Recently used columns for quick access */
    recentColumns?: string[]
    /** Popular columns for suggestions */
    popularColumns?: string[]
    /** Whether to show filter performance */
    showPerformance?: boolean
    /** Whether to animate filter changes */
    enableAnimations?: boolean
}

/**
 * Individual filter chip component
 */
function FilterChip({
    filter,
    config,
    onUpdate,
    onRemove,
    onToggle,
    disabled = false
}: {
    filter: AdvancedFilterModel
    config: ColumnsFilterConfig[string]
    onUpdate: (updates: Partial<AdvancedFilterModel>) => void
    onRemove: () => void
    onToggle: () => void
    disabled?: boolean
}) {
    const [isEditing, setIsEditing] = useState(false)

    const displayValue = useMemo(() => {
        return formatFilterValueForDisplay(
            filter.type,
            filter.operator,
            filter.values,
            config.options
        )
    }, [filter.type, filter.operator, filter.values, config.options])

    const handleValueChange = useCallback((newValue: any) => {
        onUpdate({ values: newValue })
    }, [onUpdate])

    const handleOperatorChange = useCallback((newOperator: any) => {
        onUpdate({ operator: newOperator })
    }, [onUpdate])

    const columnLabel = config.displayValueFn 
        ? config.displayValueFn(filter.values)
        : filter.label || filter.columnId

    return (
        <div 
            className={cn(
                "group flex items-center gap-1 bg-background border rounded-md px-2 py-1 text-sm transition-colors",
                filter.isActive ? "border-border" : "border-muted bg-muted/50",
                disabled && "opacity-50 cursor-not-allowed"
            )}
        >
            {/* Toggle active/inactive */}
            <button
                onClick={onToggle}
                disabled={disabled}
                className={cn(
                    "w-3 h-3 rounded-sm border-2 flex items-center justify-center transition-colors",
                    filter.isActive 
                        ? "bg-primary border-primary" 
                        : "border-muted-foreground/30 hover:border-muted-foreground/50"
                )}
            >
                {filter.isActive && (
                    <div className="w-1.5 h-1.5 bg-primary-foreground rounded-sm" />
                )}
            </button>

            {/* Column name */}
            <span className="font-medium text-foreground">
                {columnLabel}
            </span>

            {/* Operator - only show if not editing */}
            {!isEditing && (
                <span className="text-muted-foreground text-xs">
                    {filter.operator}
                </span>
            )}

            {/* Value display or edit mode */}
            <Popover open={isEditing} onOpenChange={setIsEditing}>
                <PopoverTrigger asChild>
                    <button 
                        className="text-left hover:bg-accent hover:text-accent-foreground rounded px-1 py-0.5 transition-colors"
                        disabled={disabled}
                    >
                        {isEditing ? (
                            <span className="text-muted-foreground text-xs">Editing...</span>
                        ) : (
                            <span className="text-xs">
                                {displayValue || <span className="text-muted-foreground">No value</span>}
                            </span>
                        )}
                    </button>
                </PopoverTrigger>
                <PopoverContent className="min-w-80 max-w-96 w-auto p-4" align="start">
                    <div className="space-y-3">
                        <Label className="text-sm font-medium">
                            Edit filter for {columnLabel}
                        </Label>
                        <FilterValueInput
                            type={filter.type}
                            value={filter.values}
                            operator={filter.operator}
                            config={config}
                            onValueChange={handleValueChange}
                            onOperatorChange={handleOperatorChange}
                            disabled={disabled}
                        />
                        <div className="flex justify-end gap-2">
                            <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => setIsEditing(false)}
                            >
                                Done
                            </Button>
                        </div>
                    </div>
                </PopoverContent>
            </Popover>

            {/* More actions menu */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button 
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-accent rounded transition-opacity"
                        disabled={disabled}
                    >
                        <MoreHorizontal className="h-3 w-3" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={onToggle}>
                        {filter.isActive ? 'Disable' : 'Enable'} filter
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                        onClick={onRemove}
                        className="text-destructive focus:text-destructive"
                    >
                        Remove filter
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Quick remove button */}
            <button
                onClick={onRemove}
                disabled={disabled}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive hover:text-destructive-foreground rounded transition-opacity"
            >
                <X className="h-3 w-3" />
            </button>
        </div>
    )
}

/**
 * Modern Advanced filter panel component
 */
export function AdvancedFilterPanel({
    filters,
    columnsConfig,
    actions,
    disabled = false,
    maxVisibleFilters = 3,
    showAddButton = true,
    showClearButton = true,
    className,
    isLoading = false,
    error = null,
    performance,
    variant = 'modern',
    recentColumns = [],
    popularColumns = [],
    showPerformance = false,
    enableAnimations = true
}: AdvancedFilterPanelProps) {
    const [editingFilterId, setEditingFilterId] = useState<string | null>(null)
    
    const activeFilters = filters.filter(f => f.isActive)
    const inactiveFilters = filters.filter(f => !f.isActive)
    
    const visibleFilters = filters.slice(0, maxVisibleFilters)
    const hiddenFiltersCount = Math.max(0, filters.length - maxVisibleFilters)

    const handleAddFilter = useCallback((columnId: string, type: ColumnDataType) => {
        const config = columnsConfig[columnId]
        if (!config) return

        const operator = getDefaultFilterOperator(type)
        const value = getDefaultFilterValue(type, operator)

        actions.addFilter({
            columnId,
            type,
            operator,
            values: value,
            isActive: true
        })
    }, [columnsConfig, actions])

    const handleUpdateFilter = useCallback((filterId: string, updates: Partial<AdvancedFilterModel>) => {
        actions.updateFilter(filterId, updates)
    }, [actions])

    // Show loading state
    if (isLoading) {
        return <FilterLoadingState className={className} count={3} />
    }

    // Show error state
    if (error) {
        return (
            <div className={cn("rounded-lg border border-destructive/20 bg-destructive/5 p-3", className)}>
                <p className="text-sm text-destructive">{error}</p>
            </div>
        )
    }

    // Handle empty state
    if (filters.length === 0) {
        if (!showAddButton) return null
        
        return (
            <div className={cn("space-y-3", className)}>
                {variant === 'minimal' ? (
                    <FilterEmptyState 
                        variant="minimal"
                        onAddFilter={() => {
                            // Get first available column
                            const firstColumn = Object.keys(columnsConfig)[0]
                            if (firstColumn) {
                                handleAddFilter(firstColumn, columnsConfig[firstColumn].type)
                            }
                        }}
                    />
                ) : (
                    <div className="flex items-center justify-between p-3 rounded-lg border border-dashed border-muted bg-muted/20">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                                <Filter className="h-4 w-4 text-muted-foreground opacity-50 shrink-0" />
                                <span className="text-sm text-muted-foreground">
                                    No filters applied
                                </span>
                            </div>
                        </div>
                        <ModernAddFilterDropdown
                            columnsConfig={columnsConfig}
                            onAddFilter={handleAddFilter}
                            recentColumns={recentColumns}
                            popularColumns={popularColumns}
                            disabled={disabled}
                            placeholder="Add filter..."
                        />
                    </div>
                )}
                
                {showPerformance && performance && (
                    <FilterPerformanceIndicator
                        filterTime={performance.filterTime}
                        isOptimized={performance.isOptimized}
                    />
                )}
            </div>
        )
    }

    // Render filters based on variant
    const renderContent = () => {
        switch (variant) {
            case 'minimal':
                return (
                    <div className="flex items-center gap-1 flex-wrap">
                        {visibleFilters.map((filter) => {
                            const config = columnsConfig[filter.columnId]
                            if (!config) return null

                            return (
                                <FilterChip
                                    key={filter.id}
                                    filter={filter}
                                    config={config}
                                    onUpdate={(updates) => handleUpdateFilter(filter.id, updates)}
                                    onRemove={() => actions.removeFilter(filter.id)}
                                    onToggle={() => actions.toggleFilter(filter.id)}
                                    disabled={disabled}
                                />
                            )
                        })}
                        
                        {hiddenFiltersCount > 0 && (
                            <Badge variant="secondary" className="text-xs h-6">
                                +{hiddenFiltersCount}
                            </Badge>
                        )}
                    </div>
                )

            case 'compact':
                return (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <FilterSuccessState
                                activeFiltersCount={activeFilters.length}
                                totalResults={performance?.resultCount}
                                onClearAll={showClearButton ? actions.clearFilters : undefined}
                            />
                        </div>
                        
                        <div className="flex items-center gap-2 flex-wrap">
                            {visibleFilters.map((filter) => {
                                const config = columnsConfig[filter.columnId]
                                if (!config) return null

                                return (
                                    <FilterChip
                                        key={filter.id}
                                        filter={filter}
                                        config={config}
                                        onUpdate={(updates) => handleUpdateFilter(filter.id, updates)}
                                        onRemove={() => actions.removeFilter(filter.id)}
                                        onToggle={() => actions.toggleFilter(filter.id)}
                                        disabled={disabled}
                                    />
                                )
                            })}
                        </div>
                    </div>
                )

            default: // modern
                return (
                    <div className="space-y-3">
                        {/* Header with status */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                    <Settings2 className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-medium text-sm">Filters</span>
                                </div>
                                
                                <FilterSuccessState
                                    activeFiltersCount={activeFilters.length}
                                    totalResults={performance?.resultCount}
                                />
                            </div>

                            {showClearButton && filters.length > 0 && (
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={actions.clearFilters}
                                    disabled={disabled}
                                    className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                                >
                                    Clear all
                                </Button>
                            )}
                        </div>

                        {/* Filter chips */}
                        <div className={cn(
                            "flex items-center gap-2 flex-wrap",
                            enableAnimations && "transition-all duration-200"
                        )}>
                            {visibleFilters.map((filter, index) => {
                                const config = columnsConfig[filter.columnId]
                                if (!config) return null

                                return (
                                    <div 
                                        key={filter.id}
                                        className={cn(
                                            enableAnimations && "transition-all duration-150"
                                        )}
                                    >
                                        <FilterChip
                                            filter={filter}
                                            config={config}
                                            onUpdate={(updates) => handleUpdateFilter(filter.id, updates)}
                                            onRemove={() => actions.removeFilter(filter.id)}
                                            onToggle={() => actions.toggleFilter(filter.id)}
                                            disabled={disabled}
                                        />
                                    </div>
                                )
                            })}

                            {/* Hidden filters indicator */}
                            {hiddenFiltersCount > 0 && (
                                <Badge variant="secondary" className="text-xs">
                                    +{hiddenFiltersCount} more
                                </Badge>
                            )}

                            {/* Add filter button */}
                            {showAddButton && (
                                <ModernAddFilterDropdown
                                    columnsConfig={columnsConfig}
                                    onAddFilter={handleAddFilter}
                                    recentColumns={recentColumns}
                                    popularColumns={popularColumns}
                                    disabled={disabled}
                                    placeholder="Add filter..."
                                />
                            )}
                        </div>

                        {/* Performance indicator */}
                        {showPerformance && performance && (
                            <FilterPerformanceIndicator
                                filterTime={performance.filterTime}
                                isOptimized={performance.isOptimized}
                            />
                        )}
                    </div>
                )
        }
    }

    return (
        <div className={cn(
            "w-full",
            variant === 'modern' && "rounded-lg border bg-card/50 p-3",
            variant === 'compact' && "rounded-md bg-muted/30 p-2",
            className
        )}>
            {renderContent()}
        </div>
    )
}

/**
 * Compact filter panel for smaller spaces
 */
export function CompactFilterPanel({
    filters,
    columnsConfig,
    actions,
    disabled = false
}: Pick<AdvancedFilterPanelProps, 'filters' | 'columnsConfig' | 'actions' | 'disabled'>) {
    const [isExpanded, setIsExpanded] = useState(false)
    const activeFiltersCount = filters.filter(f => f.isActive).length

    if (filters.length === 0) {
        return (
            <div className="flex items-center justify-between gap-3 p-2 rounded-md border border-dashed border-muted bg-muted/10">
                <div className="flex items-center gap-2">
                    <Filter className="h-3 w-3 text-muted-foreground opacity-50 shrink-0" />
                    <span className="text-xs text-muted-foreground">
                        No filters
                    </span>
                </div>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div>
                                <ModernAddFilterDropdown
                                    columnsConfig={columnsConfig}
                                    onAddFilter={(columnId, type) => {
                                        const config = columnsConfig[columnId]
                                        if (!config) return

                                        const operator = getDefaultFilterOperator(type)
                                        const value = getDefaultFilterValue(type, operator)

                                        actions.addFilter({
                                            columnId,
                                            type,
                                            operator,
                                            values: value,
                                            isActive: true
                                        })
                                    }}
                                    disabled={disabled}
                                    placeholder="Add filter..."
                                    size="sm"
                                />
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Add filters to narrow down results</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
        )
    }

    return (
        <Popover open={isExpanded} onOpenChange={setIsExpanded}>
            <PopoverTrigger asChild>
                <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-7 gap-1"
                    disabled={disabled}
                >
                    <Filter className="h-3 w-3" />
                    {activeFiltersCount > 0 ? `${activeFiltersCount} filters` : 'Filter'}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="min-w-96 max-w-screen-sm w-auto p-4" align="start">
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <Label className="font-medium">Filters</Label>
                        {filters.length > 0 && (
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={actions.clearFilters}
                                className="h-6 text-xs"
                            >
                                Clear all
                            </Button>
                        )}
                    </div>
                    
                    <div className="max-h-80 overflow-y-auto">
                        <div className="space-y-2">
                            {filters.map((filter) => {
                                const config = columnsConfig[filter.columnId]
                                if (!config) return null

                                return (
                                    <FilterChip
                                        key={filter.id}
                                        filter={filter}
                                        config={config}
                                        onUpdate={(updates) => actions.updateFilter(filter.id, updates)}
                                        onRemove={() => actions.removeFilter(filter.id)}
                                        onToggle={() => actions.toggleFilter(filter.id)}
                                        disabled={disabled}
                                    />
                                )
                            })}
                        </div>
                    </div>

                    <Separator />

                    <ModernAddFilterDropdown
                        columnsConfig={columnsConfig}
                        onAddFilter={(columnId, type) => {
                            const config = columnsConfig[columnId]
                            if (!config) return

                            const operator = getDefaultFilterOperator(type)
                            const value = getDefaultFilterValue(type, operator)

                            actions.addFilter({
                                columnId,
                                type,
                                operator,
                                values: value,
                                isActive: true
                            })
                        }}
                        disabled={disabled}
                        placeholder="Add filter..."
                    />
                </div>
            </PopoverContent>
        </Popover>
    )
} 