/**
 * Advanced Faceted Filter - Phase 5
 * Intelligent faceted filtering with hierarchies, counts, and smart grouping
 */
'use client'

import {
    BarChart3,
    CheckSquare,
    ChevronDown,
    ChevronRight,
    Filter,
    Search,
    SortAsc,
    SortDesc,
    Sparkles,
    Star,
    Target,
    TrendingUp,
    X
} from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

import type { AdvancedColumnFilterConfig, FacetedData } from '../../types/advanced-filter-types'

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
        if (isDisabled) {
            return
        }
        onToggle(option.value, !isSelected)
    }, [option.value, isSelected, isDisabled, onToggle])

    const handleChildToggle = useCallback(
        (childValue: any, selected: boolean) => {
            onToggle(childValue, selected)
        },
        [onToggle]
    )

    return (
        <div className="space-y-1">
            <div
                className={cn(
                    'flex items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-accent/50',
                    level > 0 && 'ml-4',
                    isDisabled && 'cursor-not-allowed opacity-50'
                )}
                style={{ paddingLeft: `${8 + level * 16}px` }}
            >
                {/* Expand/collapse for hierarchical options */}
                {hasChildren && (
                    <Button
                        className="h-4 w-4 p-0"
                        onClick={() => setIsExpanded(!isExpanded)}
                        size="sm"
                        variant="ghost"
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
                            className="h-4 w-4"
                            disabled={isDisabled}
                            onCheckedChange={handleToggle}
                        />
                    ) : (
                        <input
                            checked={isSelected}
                            className="h-4 w-4"
                            disabled={isDisabled}
                            onChange={handleToggle}
                            type="radio"
                        />
                    )}
                </div>

                {/* Option content */}
                <div className="flex min-w-0 flex-1 items-center justify-between">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="truncate text-sm">{option.label}</span>

                        {/* Metadata indicators */}
                        <div className="flex items-center gap-1">
                            {option.metadata?.trending && (
                                <TrendingUp className="h-3 w-3 text-emerald-500" />
                            )}
                            {option.metadata?.new && <Sparkles className="h-3 w-3 text-blue-500" />}
                            {option.metadata?.priority === 1 && (
                                <Star className="h-3 w-3 text-amber-500" />
                            )}
                        </div>
                    </div>

                    {/* Count and percentage */}
                    <div className="flex items-center gap-2 text-muted-foreground text-xs">
                        {showCount && (
                            <Badge className="text-xs" variant="secondary">
                                {option.count.toLocaleString()}
                            </Badge>
                        )}
                        {showPercentage && option.percentage > 0 && (
                            <span className="text-xs">{option.percentage.toFixed(1)}%</span>
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
                                isDisabled={isDisabled}
                                isSelected={isSelected}
                                key={child.value}
                                level={level + 1}
                                multiSelect={multiSelect}
                                onToggle={handleChildToggle}
                                option={child}
                                showCount={showCount}
                                showPercentage={showPercentage}
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
                <Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 transform text-muted-foreground" />
                <Input
                    className="pl-9"
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder="Search options..."
                    value={searchQuery}
                />
            </div>

            {/* Controls row */}
            <div className="flex items-center justify-between">
                {/* Sort controls */}
                <div className="flex items-center gap-2">
                    <select
                        className="rounded border px-2 py-1 text-xs"
                        onChange={(e) => onSortByChange(e.target.value as SortBy)}
                        value={sortBy}
                    >
                        <option value="label">Sort by Label</option>
                        <option value="count">Sort by Count</option>
                        <option value="value">Sort by Value</option>
                        <option value="trending">Sort by Trending</option>
                    </select>

                    <Button
                        className="h-6 w-6 p-0"
                        onClick={() => onSortOrderChange(sortOrder === 'asc' ? 'desc' : 'asc')}
                        size="sm"
                        variant="outline"
                    >
                        {sortOrder === 'asc' ? (
                            <SortAsc className="h-3 w-3" />
                        ) : (
                            <SortDesc className="h-3 w-3" />
                        )}
                    </Button>
                </div>

                {/* Selection info */}
                <div className="text-muted-foreground text-xs">
                    {selectedCount > 0 ? (
                        <div className="flex items-center gap-2">
                            <span>
                                {selectedCount} of {totalCount} selected
                            </span>
                            <Button
                                className="h-4 w-4 p-0"
                                onClick={onClear}
                                size="sm"
                                variant="ghost"
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
    const hasTrending = options.some((opt) => opt.metadata?.trending)

    return (
        <div className="flex flex-wrap items-center gap-1">
            <Button className="h-6 px-2 text-xs" onClick={onSelectAll} size="sm" variant="outline">
                <CheckSquare className="mr-1 h-3 w-3" />
                All
            </Button>
            <Button className="h-6 px-2 text-xs" onClick={onSelectNone} size="sm" variant="outline">
                <X className="mr-1 h-3 w-3" />
                None
            </Button>
            <Button className="h-6 px-2 text-xs" onClick={onSelectTop} size="sm" variant="outline">
                <BarChart3 className="mr-1 h-3 w-3" />
                Top 5
            </Button>
            {hasTrending && (
                <Button
                    className="h-6 px-2 text-xs"
                    onClick={onSelectTrending}
                    size="sm"
                    variant="outline"
                >
                    <TrendingUp className="mr-1 h-3 w-3" />
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
            filtered = filtered.filter(
                (option) =>
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
                case 'trending': {
                    const aTrending = a.metadata?.trending ? 1 : 0
                    const bTrending = b.metadata?.trending ? 1 : 0
                    comparison = aTrending - bTrending
                    break
                }
            }

            return sortOrder === 'asc' ? comparison : -comparison
        })

        return filtered
    }, [facetedData, searchQuery, sortBy, sortOrder])

    // Handle selection changes
    const handleToggle = useCallback(
        (value: any, selected: boolean) => {
            if (disabled) {
                return
            }

            let newSelection: any[]

            if (multiSelect) {
                if (selected) {
                    newSelection = [...selectedValues, value]
                } else {
                    newSelection = selectedValues.filter((v) => v !== value)
                }
            } else {
                newSelection = selected ? [value] : []
            }

            onSelectionChange(newSelection)
        },
        [selectedValues, onSelectionChange, disabled, multiSelect]
    )

    // Quick selection handlers
    const handleSelectAll = useCallback(() => {
        if (disabled) {
            return
        }
        const allValues = processedOptions.map((opt) => opt.value)
        onSelectionChange(allValues)
    }, [processedOptions, onSelectionChange, disabled])

    const handleSelectNone = useCallback(() => {
        if (disabled) {
            return
        }
        onSelectionChange([])
    }, [onSelectionChange, disabled])

    const handleSelectTop = useCallback(() => {
        if (disabled) {
            return
        }
        const topValues = processedOptions
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)
            .map((opt) => opt.value)
        onSelectionChange(topValues)
    }, [processedOptions, onSelectionChange, disabled])

    const handleSelectTrending = useCallback(() => {
        if (disabled) {
            return
        }
        const trendingValues = processedOptions
            .filter((opt) => opt.metadata?.trending)
            .map((opt) => opt.value)
        onSelectionChange(trendingValues)
    }, [processedOptions, onSelectionChange, disabled])

    const selectedCount = selectedValues.length
    const totalCount = processedOptions.length

    // Compact mode for small spaces
    if (!isExpanded) {
        return (
            <Popover onOpenChange={setIsExpanded} open={isExpanded}>
                <PopoverTrigger asChild>
                    <Button
                        className={cn(
                            'justify-between',
                            selectedCount > 0 && 'border-primary',
                            disabled && 'opacity-50',
                            className
                        )}
                        disabled={disabled}
                        variant="outline"
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

                <PopoverContent align="start" className="w-80 p-0">
                    <div className="space-y-4 p-4">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                            <h4 className="font-medium">{config.label || columnId}</h4>
                            <div className="flex items-center gap-1 text-muted-foreground text-xs">
                                <Target className="h-3 w-3" />
                                <span>{totalCount} options</span>
                            </div>
                        </div>

                        {/* Controls */}
                        {searchable && (
                            <FilterControls
                                onClear={handleSelectNone}
                                onSearchChange={setSearchQuery}
                                onSortByChange={setSortBy}
                                onSortOrderChange={setSortOrder}
                                searchQuery={searchQuery}
                                selectedCount={selectedCount}
                                sortBy={sortBy}
                                sortOrder={sortOrder}
                                totalCount={totalCount}
                            />
                        )}

                        {/* Quick selection */}
                        {multiSelect && (
                            <QuickSelection
                                onSelectAll={handleSelectAll}
                                onSelectNone={handleSelectNone}
                                onSelectTop={handleSelectTop}
                                onSelectTrending={handleSelectTrending}
                                options={processedOptions}
                            />
                        )}

                        <Separator />

                        {/* Options list */}
                        <div
                            className="max-h-80 overflow-y-auto"
                            style={{ maxHeight: Math.min(maxHeight, 320) }}
                        >
                            {processedOptions.length === 0 ? (
                                <div className="py-4 text-center text-muted-foreground">
                                    <Search className="mx-auto mb-2 h-6 w-6 opacity-50" />
                                    <p className="text-sm">No options found</p>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {processedOptions.map((option) => (
                                        <FacetedOption
                                            isDisabled={option.isDisabled}
                                            isSelected={selectedValues.includes(option.value)}
                                            key={option.value}
                                            multiSelect={multiSelect}
                                            onToggle={handleToggle}
                                            option={option}
                                            showCount={showCounts}
                                            showPercentage={showPercentages}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        )
    }

    // Expanded mode for dedicated space
    return (
        <div className={cn('space-y-4 rounded-lg border p-4', className)}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="font-medium">{config.label || columnId}</h3>
                <Button
                    className="h-6 w-6 p-0"
                    onClick={() => setIsExpanded(false)}
                    size="sm"
                    variant="ghost"
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>

            {/* Controls */}
            {searchable && (
                <FilterControls
                    onClear={handleSelectNone}
                    onSearchChange={setSearchQuery}
                    onSortByChange={setSortBy}
                    onSortOrderChange={setSortOrder}
                    searchQuery={searchQuery}
                    selectedCount={selectedCount}
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    totalCount={totalCount}
                />
            )}

            {/* Quick selection */}
            {multiSelect && (
                <QuickSelection
                    onSelectAll={handleSelectAll}
                    onSelectNone={handleSelectNone}
                    onSelectTop={handleSelectTop}
                    onSelectTrending={handleSelectTrending}
                    options={processedOptions}
                />
            )}

            <Separator />

            {/* Options list */}
            <ScrollArea style={{ maxHeight }}>
                {processedOptions.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">
                        <Search className="mx-auto mb-3 h-8 w-8 opacity-50" />
                        <h4 className="mb-1 font-medium">No options found</h4>
                        <p className="text-sm">
                            {searchQuery
                                ? 'Try a different search term'
                                : 'No data available for this filter'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {processedOptions.map((option) => (
                            <FacetedOption
                                isDisabled={option.isDisabled}
                                isSelected={selectedValues.includes(option.value)}
                                key={option.value}
                                multiSelect={multiSelect}
                                onToggle={handleToggle}
                                option={option}
                                showCount={showCounts}
                                showPercentage={showPercentages}
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
    const visibleOptions = data.filter((d) => !d.isDisabled).length
    const totalRecords = data.reduce((sum, d) => sum + d.count, 0)
    const selectedRecords = data.filter((d) => d.isSelected).reduce((sum, d) => sum + d.count, 0)

    return (
        <div className="rounded-md bg-muted/30 p-3">
            <div className="mb-2 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">Statistics</span>
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
                <div className="mt-2 text-muted-foreground text-xs">
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
}: Omit<
    AdvancedFacetedFilterProps,
    | 'maxHeight'
    | 'searchable'
    | 'showCounts'
    | 'showPercentages'
    | 'multiSelect'
    | 'virtualized'
    | 'maxVisible'
    | 'showSelectAll'
    | 'showStats'
>) {
    const [isOpen, setIsOpen] = useState(false)
    const selectedCount = selectedValues.length

    return (
        <Popover onOpenChange={setIsOpen} open={isOpen}>
            <PopoverTrigger asChild>
                <Button
                    className={cn('justify-between', className)}
                    disabled={disabled}
                    size="sm"
                    variant="outline"
                >
                    <span className="truncate">
                        {selectedCount > 0
                            ? `${config.label || columnId} (${selectedCount})`
                            : config.label || columnId}
                    </span>
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0" />
                </Button>
            </PopoverTrigger>

            <PopoverContent align="start" className="w-80 p-0">
                <div className="space-y-4 p-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <h4 className="font-medium">{config.label || columnId}</h4>
                        <div className="flex items-center gap-1 text-muted-foreground text-xs">
                            <Target className="h-3 w-3" />
                            <span>{selectedCount} options</span>
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center justify-between">
                        <Button
                            className="h-6 px-2 text-xs"
                            disabled={disabled || selectedCount === 0}
                            onClick={() => onSelectionChange(facetedData.map((d) => d.value))}
                            size="sm"
                            variant="ghost"
                        >
                            Select All ({facetedData.length})
                        </Button>

                        {selectedCount > 0 && (
                            <Button
                                className="h-6 px-2 text-muted-foreground text-xs"
                                disabled={disabled}
                                onClick={() => onSelectionChange([])}
                                size="sm"
                                variant="ghost"
                            >
                                Clear ({selectedCount})
                            </Button>
                        )}
                    </div>

                    <Separator />

                    {/* Options list */}
                    <div className="max-h-60 overflow-y-auto">
                        {facetedData.length === 0 ? (
                            <div className="py-8 text-center text-muted-foreground">
                                <Search className="mx-auto mb-3 h-8 w-8 opacity-50" />
                                <h5 className="mb-1 font-medium">No options available</h5>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {facetedData.map((option) => (
                                    <FacetedOption
                                        isDisabled={option.isDisabled}
                                        isSelected={selectedValues.includes(option.value)}
                                        key={option.value}
                                        onToggle={(value, selected) =>
                                            onSelectionChange(
                                                selected
                                                    ? [...selectedValues, value]
                                                    : selectedValues.filter((v) => v !== value)
                                            )
                                        }
                                        option={option}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

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
