/**
 * Advanced Faceted Filter - Phase 5
 * Intelligent faceted filtering with hierarchies, counts, and smart grouping
 */
"use client"

import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import {
    Search,
    ChevronDown,
    ChevronRight,
    Filter,
    TrendingUp,
    Clock,
    Star,
    Hash,
    CheckSquare,
    X,
    SortAsc,
    SortDesc,
    BarChart3,
    Sparkles,
    Target,
    Layers,
    ArrowUpDown,
    MoreHorizontal
} from "lucide-react"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"

import type { FacetedData, AdvancedColumnFilterConfig } from '../../types/advanced-filter-types'

export interface AdvancedFacetedFilterProps {
    /** Column ID */
    columnId: string
    /** Column configuration */
    config: AdvancedColumnFilterConfig
    /** Faceted data */
    facetedData: FacetedData[]
    /** Selected values */
    selectedValues: any[]
    /** Callback when selection changes */
    onSelectionChange: (values: any[]) => void
    /** Whether filter is disabled */
    disabled?: boolean
    /** Maximum height for the options list */
    maxHeight?: number
    /** Show search input */
    searchable?: boolean
    /** Show option counts */
    showCounts?: boolean
    /** Show percentages */
    showPercentages?: boolean
    /** Enable multi-select */
    multiSelect?: boolean
    /** Enable virtual scrolling for large datasets */
    virtualized?: boolean
    /** Custom className */
    className?: string
    /** Maximum visible options before scrolling */
    maxVisible?: number
    /** Whether to show "Select All" */
    showSelectAll?: boolean
    /** Whether to show statistics */
    showStats?: boolean
}

type SortBy = 'label' | 'count' | 'value' | 'trending'
type SortOrder = 'asc' | 'desc'

/**
 * Individual faceted option component
 */
function FacetedOption({
    option,
    isSelected,
    isDisabled,
    showCount = true,
    showPercentage = false,
    onToggle,
    multiSelect = true,
    level = 0
}: {
    option: FacetedData
    isSelected: boolean
    isDisabled: boolean
    showCount?: boolean
    showPercentage?: boolean
    onToggle: (value: any, selected: boolean) => void
    multiSelect?: boolean
    level?: number
}) {
    const [isExpanded, setIsExpanded] = useState(false)
    const hasChildren = option.children && option.children.length > 0

    const handleToggle = useCallback(() => {
        if (isDisabled) return
        onToggle(option.value, !isSelected)
    }, [option.value, isSelected, isDisabled, onToggle])

    const handleChildToggle = useCallback((childValue: any, selected: boolean) => {
        onToggle(childValue, selected)
    }, [onToggle])

    return (
        <div className="space-y-1">
            <div 
                className={cn(
                    "flex items-center gap-2 py-1 px-2 rounded-md hover:bg-accent/50 transition-colors",
                    level > 0 && "ml-4",
                    isDisabled && "opacity-50 cursor-not-allowed"
                )}
                style={{ paddingLeft: `${8 + level * 16}px` }}
            >
                {/* Expand/collapse for hierarchical options */}
                {hasChildren && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0"
                        onClick={() => setIsExpanded(!isExpanded)}
                    >
                        {isExpanded ? (
                            <ChevronDown className="h-3 w-3" />
                        ) : (
                            <ChevronRight className="h-3 w-3" />
                        )}
                    </Button>
                )}

                {/* Selection control */}
                <div className="flex items-center">
                    {multiSelect ? (
                        <Checkbox
                            checked={isSelected}
                            onCheckedChange={handleToggle}
                            disabled={isDisabled}
                            className="h-4 w-4"
                        />
                    ) : (
                        <input
                            type="radio"
                            checked={isSelected}
                            onChange={handleToggle}
                            disabled={isDisabled}
                            className="h-4 w-4"
                        />
                    )}
                </div>

                {/* Option content */}
                <div className="flex-1 min-w-0 flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-sm truncate">{option.label}</span>
                        
                        {/* Metadata indicators */}
                        <div className="flex items-center gap-1">
                            {option.metadata?.trending && (
                                <TrendingUp className="h-3 w-3 text-emerald-500" />
                            )}
                            {option.metadata?.new && (
                                <Sparkles className="h-3 w-3 text-blue-500" />
                            )}
                            {option.metadata?.priority === 1 && (
                                <Star className="h-3 w-3 text-amber-500" />
                            )}
                        </div>
                    </div>

                    {/* Count and percentage */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {showCount && (
                            <Badge variant="secondary" className="text-xs">
                                {option.count.toLocaleString()}
                            </Badge>
                        )}
                        {showPercentage && option.percentage > 0 && (
                            <span className="text-xs">
                                {option.percentage.toFixed(1)}%
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Children */}
            {hasChildren && isExpanded && (
                <Collapsible open={isExpanded}>
                    <CollapsibleContent className="space-y-1">
                        {option.children!.map((child) => (
                            <FacetedOption
                                key={child.value}
                                option={child}
                                isSelected={isSelected}
                                isDisabled={isDisabled}
                                showCount={showCount}
                                showPercentage={showPercentage}
                                onToggle={handleChildToggle}
                                multiSelect={multiSelect}
                                level={level + 1}
                            />
                        ))}
                    </CollapsibleContent>
                </Collapsible>
            )}
        </div>
    )
}

/**
 * Sort and filter controls
 */
function FilterControls({
    searchQuery,
    onSearchChange,
    sortBy,
    onSortByChange,
    sortOrder,
    onSortOrderChange,
    totalCount,
    selectedCount,
    onClear
}: {
    searchQuery: string
    onSearchChange: (query: string) => void
    sortBy: SortBy
    onSortByChange: (sort: SortBy) => void
    sortOrder: SortOrder
    onSortOrderChange: (order: SortOrder) => void
    totalCount: number
    selectedCount: number
    onClear: () => void
}) {
    return (
        <div className="space-y-3">
            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search options..."
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="pl-9"
                />
            </div>

            {/* Controls row */}
            <div className="flex items-center justify-between">
                {/* Sort controls */}
                <div className="flex items-center gap-2">
                    <select
                        value={sortBy}
                        onChange={(e) => onSortByChange(e.target.value as SortBy)}
                        className="text-xs border rounded px-2 py-1"
                    >
                        <option value="label">Sort by Label</option>
                        <option value="count">Sort by Count</option>
                        <option value="value">Sort by Value</option>
                        <option value="trending">Sort by Trending</option>
                    </select>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onSortOrderChange(sortOrder === 'asc' ? 'desc' : 'asc')}
                        className="h-6 w-6 p-0"
                    >
                        {sortOrder === 'asc' ? (
                            <SortAsc className="h-3 w-3" />
                        ) : (
                            <SortDesc className="h-3 w-3" />
                        )}
                    </Button>
                </div>

                {/* Selection info */}
                <div className="text-xs text-muted-foreground">
                    {selectedCount > 0 ? (
                        <div className="flex items-center gap-2">
                            <span>{selectedCount} of {totalCount} selected</span>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onClear}
                                className="h-4 w-4 p-0"
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        </div>
                    ) : (
                        <span>{totalCount} options</span>
                    )}
                </div>
            </div>
        </div>
    )
}

/**
 * Quick selection buttons
 */
function QuickSelection({
    options,
    onSelectAll,
    onSelectNone,
    onSelectTop,
    onSelectTrending
}: {
    options: FacetedData[]
    onSelectAll: () => void
    onSelectNone: () => void
    onSelectTop: () => void
    onSelectTrending: () => void
}) {
    const hasTrending = options.some(opt => opt.metadata?.trending)

    return (
        <div className="flex items-center gap-1 flex-wrap">
            <Button
                variant="outline"
                size="sm"
                onClick={onSelectAll}
                className="h-6 px-2 text-xs"
            >
                <CheckSquare className="h-3 w-3 mr-1" />
                All
            </Button>
            <Button
                variant="outline"
                size="sm"
                onClick={onSelectNone}
                className="h-6 px-2 text-xs"
            >
                <X className="h-3 w-3 mr-1" />
                None
            </Button>
            <Button
                variant="outline"
                size="sm"
                onClick={onSelectTop}
                className="h-6 px-2 text-xs"
            >
                <BarChart3 className="h-3 w-3 mr-1" />
                Top 5
            </Button>
            {hasTrending && (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={onSelectTrending}
                    className="h-6 px-2 text-xs"
                >
                    <TrendingUp className="h-3 w-3 mr-1" />
                    Trending
                </Button>
            )}
        </div>
    )
}

/**
 * Main advanced faceted filter component
 */
export function AdvancedFacetedFilter({
    columnId,
    config,
    facetedData,
    selectedValues = [],
    onSelectionChange,
    disabled = false,
    maxHeight = 300,
    searchable = true,
    showCounts = true,
    showPercentages = false,
    multiSelect = true,
    virtualized = false,
    className,
    maxVisible = 200,
    showSelectAll = true,
    showStats = true
}: AdvancedFacetedFilterProps) {
    // Local state
    const [searchQuery, setSearchQuery] = useState('')
    const [sortBy, setSortBy] = useState<SortBy>('count')
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
    const [isExpanded, setIsExpanded] = useState(false)

    // Memoized filtered and sorted options
    const processedOptions = useMemo(() => {
        let filtered = facetedData

        // Apply search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase()
            filtered = filtered.filter(option =>
                option.label.toLowerCase().includes(query) ||
                option.value.toString().toLowerCase().includes(query)
            )
        }

        // Apply sorting
        filtered.sort((a, b) => {
            let comparison = 0

            switch (sortBy) {
                case 'label':
                    comparison = a.label.localeCompare(b.label)
                    break
                case 'count':
                    comparison = a.count - b.count
                    break
                case 'value':
                    comparison = String(a.value).localeCompare(String(b.value))
                    break
                case 'trending':
                    const aTrending = a.metadata?.trending ? 1 : 0
                    const bTrending = b.metadata?.trending ? 1 : 0
                    comparison = aTrending - bTrending
                    break
            }

            return sortOrder === 'asc' ? comparison : -comparison
        })

        return filtered
    }, [facetedData, searchQuery, sortBy, sortOrder])

    // Handle selection changes
    const handleToggle = useCallback((value: any, selected: boolean) => {
        if (disabled) return

        let newSelection: any[]
        
        if (multiSelect) {
            if (selected) {
                newSelection = [...selectedValues, value]
            } else {
                newSelection = selectedValues.filter(v => v !== value)
            }
        } else {
            newSelection = selected ? [value] : []
        }

        onSelectionChange(newSelection)
    }, [selectedValues, onSelectionChange, disabled, multiSelect])

    // Quick selection handlers
    const handleSelectAll = useCallback(() => {
        if (disabled) return
        const allValues = processedOptions.map(opt => opt.value)
        onSelectionChange(allValues)
    }, [processedOptions, onSelectionChange, disabled])

    const handleSelectNone = useCallback(() => {
        if (disabled) return
        onSelectionChange([])
    }, [onSelectionChange, disabled])

    const handleSelectTop = useCallback(() => {
        if (disabled) return
        const topValues = processedOptions
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)
            .map(opt => opt.value)
        onSelectionChange(topValues)
    }, [processedOptions, onSelectionChange, disabled])

    const handleSelectTrending = useCallback(() => {
        if (disabled) return
        const trendingValues = processedOptions
            .filter(opt => opt.metadata?.trending)
            .map(opt => opt.value)
        onSelectionChange(trendingValues)
    }, [processedOptions, onSelectionChange, disabled])

    const selectedCount = selectedValues.length
    const totalCount = processedOptions.length

    // Compact mode for small spaces
    if (!isExpanded) {
        return (
            <Popover open={isExpanded} onOpenChange={setIsExpanded}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        className={cn(
                            "justify-between",
                            selectedCount > 0 && "border-primary",
                            disabled && "opacity-50",
                            className
                        )}
                        disabled={disabled}
                    >
                        <div className="flex items-center gap-2">
                            <Filter className="h-4 w-4" />
                            <span>
                                {config.label || columnId}
                                {selectedCount > 0 && ` (${selectedCount})`}
                            </span>
                        </div>
                        <ChevronDown className="h-4 w-4" />
                    </Button>
                </PopoverTrigger>
                
                <PopoverContent className="w-80 p-0" align="start">
                    <div className="p-4 space-y-4">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                            <h4 className="font-medium">{config.label || columnId}</h4>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Target className="h-3 w-3" />
                                <span>{totalCount} options</span>
                            </div>
                        </div>

                        {/* Controls */}
                        {searchable && (
                            <FilterControls
                                searchQuery={searchQuery}
                                onSearchChange={setSearchQuery}
                                sortBy={sortBy}
                                onSortByChange={setSortBy}
                                sortOrder={sortOrder}
                                onSortOrderChange={setSortOrder}
                                totalCount={totalCount}
                                selectedCount={selectedCount}
                                onClear={handleSelectNone}
                            />
                        )}

                        {/* Quick selection */}
                        {multiSelect && (
                            <QuickSelection
                                options={processedOptions}
                                onSelectAll={handleSelectAll}
                                onSelectNone={handleSelectNone}
                                onSelectTop={handleSelectTop}
                                onSelectTrending={handleSelectTrending}
                            />
                        )}

                        <Separator />

                        {/* Options list */}
                        <ScrollArea style={{ maxHeight: maxHeight }}>
                            {processedOptions.length === 0 ? (
                                <div className="text-center py-4 text-muted-foreground">
                                    <Search className="h-6 w-6 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">No options found</p>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {processedOptions.map((option) => (
                                        <FacetedOption
                                            key={option.value}
                                            option={option}
                                            isSelected={selectedValues.includes(option.value)}
                                            isDisabled={option.isDisabled}
                                            showCount={showCounts}
                                            showPercentage={showPercentages}
                                            onToggle={handleToggle}
                                            multiSelect={multiSelect}
                                        />
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    </div>
                </PopoverContent>
            </Popover>
        )
    }

    // Expanded mode for dedicated space
    return (
        <div className={cn("space-y-4 border rounded-lg p-4", className)}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="font-medium">{config.label || columnId}</h3>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsExpanded(false)}
                    className="h-6 w-6 p-0"
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>

            {/* Controls */}
            {searchable && (
                <FilterControls
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    sortBy={sortBy}
                    onSortByChange={setSortBy}
                    sortOrder={sortOrder}
                    onSortOrderChange={setSortOrder}
                    totalCount={totalCount}
                    selectedCount={selectedCount}
                    onClear={handleSelectNone}
                />
            )}

            {/* Quick selection */}
            {multiSelect && (
                <QuickSelection
                    options={processedOptions}
                    onSelectAll={handleSelectAll}
                    onSelectNone={handleSelectNone}
                    onSelectTop={handleSelectTop}
                    onSelectTrending={handleSelectTrending}
                />
            )}

            <Separator />

            {/* Options list */}
            <ScrollArea style={{ maxHeight: maxHeight }}>
                {processedOptions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <Search className="h-8 w-8 mx-auto mb-3 opacity-50" />
                        <h4 className="font-medium mb-1">No options found</h4>
                        <p className="text-sm">
                            {searchQuery 
                                ? 'Try a different search term' 
                                : 'No data available for this filter'
                            }
                        </p>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {processedOptions.map((option) => (
                            <FacetedOption
                                key={option.value}
                                option={option}
                                isSelected={selectedValues.includes(option.value)}
                                isDisabled={option.isDisabled}
                                showCount={showCounts}
                                showPercentage={showPercentages}
                                onToggle={handleToggle}
                                multiSelect={multiSelect}
                            />
                        ))}
                    </div>
                )}
            </ScrollArea>
        </div>
    )
}

/**
 * Statistics summary component
 */
function FacetedStats({
    data,
    selectedCount,
    totalCount
}: {
    data: FacetedData[]
    selectedCount: number
    totalCount: number
}) {
    const visibleOptions = data.filter(d => !d.isDisabled).length
    const totalRecords = data.reduce((sum, d) => sum + d.count, 0)
    const selectedRecords = data
        .filter(d => d.isSelected)
        .reduce((sum, d) => sum + d.count, 0)

    return (
        <div className="p-3 bg-muted/30 rounded-md">
            <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Statistics</span>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                    <div className="text-muted-foreground">Options</div>
                    <div className="font-medium">
                        {selectedCount} / {visibleOptions}
                    </div>
                </div>
                <div>
                    <div className="text-muted-foreground">Records</div>
                    <div className="font-medium">
                        {selectedRecords.toLocaleString()} / {totalRecords.toLocaleString()}
                    </div>
                </div>
            </div>

            {selectedCount > 0 && (
                <div className="mt-2 text-xs text-muted-foreground">
                    Coverage: {((selectedRecords / totalRecords) * 100).toFixed(1)}% of data
                </div>
            )}
        </div>
    )
}

/**
 * Compact variant for smaller spaces
 */
export function CompactFacetedFilter({
    columnId,
    selectedValues,
    facetedData,
    config,
    onSelectionChange,
    disabled = false,
    className
}: Omit<AdvancedFacetedFilterProps, 'maxHeight' | 'searchable' | 'showCounts' | 'showPercentages' | 'multiSelect' | 'virtualized' | 'maxVisible' | 'showSelectAll' | 'showStats'>) {
    const [isOpen, setIsOpen] = useState(false)
    const selectedCount = selectedValues.length

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    disabled={disabled}
                    className={cn("justify-between", className)}
                >
                    <span className="truncate">
                        {selectedCount > 0 
                            ? `${config.label || columnId} (${selectedCount})`
                            : config.label || columnId
                        }
                    </span>
                    <ChevronDown className="h-4 w-4 ml-2 shrink-0" />
                </Button>
            </PopoverTrigger>
            
            <PopoverContent className="w-80 p-0" align="start">
                <div className="p-4 space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <h4 className="font-medium">{config.label || columnId}</h4>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Target className="h-3 w-3" />
                            <span>{selectedCount} options</span>
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center justify-between">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onSelectionChange(facetedData.map(d => d.value))}
                            disabled={disabled || selectedCount === 0}
                            className="h-6 px-2 text-xs"
                        >
                            Select All ({facetedData.length})
                        </Button>
                        
                        {selectedCount > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onSelectionChange([])}
                                disabled={disabled}
                                className="h-6 px-2 text-xs text-muted-foreground"
                            >
                                Clear ({selectedCount})
                            </Button>
                        )}
                    </div>

                    <Separator />

                    {/* Options list */}
                    <ScrollArea style={{ maxHeight: 200 }}>
                        {facetedData.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <Search className="h-8 w-8 mx-auto mb-3 opacity-50" />
                                <h5 className="font-medium mb-1">No options available</h5>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {facetedData.map((option) => (
                                    <FacetedOption
                                        key={option.value}
                                        option={option}
                                        isSelected={selectedValues.includes(option.value)}
                                        isDisabled={option.isDisabled}
                                        onToggle={(value, selected) => onSelectionChange(selected ? [...selectedValues, value] : selectedValues.filter(v => v !== value))}
                                    />
                                ))}
                            </div>
                        )}
                    </ScrollArea>

                    {/* Statistics */}
                    <FacetedStats
                        data={facetedData}
                        selectedCount={selectedCount}
                        totalCount={facetedData.length}
                    />
                </div>
            </PopoverContent>
        </Popover>
    )
} 