/**
 * Modern Filter States Components
 * Loading, empty, and error states with beautiful animations
 */
"use client"

import React from 'react'
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { 
    Filter, 
    Plus, 
    RefreshCw, 
    AlertCircle, 
    Search,
    Sparkles,
    Zap,
    Target,
    TrendingUp
} from "lucide-react"

interface FilterLoadingStateProps {
    className?: string
    count?: number
    showTitle?: boolean
}

interface FilterEmptyStateProps {
    className?: string
    title?: string
    description?: string
    onAddFilter?: () => void
    showAddButton?: boolean
    variant?: 'default' | 'compact' | 'minimal'
}

interface FilterErrorStateProps {
    className?: string
    title?: string
    description?: string
    onRetry?: () => void
    showRetryButton?: boolean
}

/**
 * Loading state with skeleton chips
 */
export function FilterLoadingState({ 
    className, 
    count = 3, 
    showTitle = true 
}: FilterLoadingStateProps) {
    return (
        <div className={cn("space-y-3", className)}>
            {showTitle && (
                <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 rounded" />
                    <Skeleton className="h-4 w-24" />
                </div>
            )}
            
            <div className="flex items-center gap-2 flex-wrap">
                {Array.from({ length: count }).map((_, i) => (
                    <Skeleton 
                        key={i}
                        className={cn(
                            "h-8 rounded-full",
                            i === 0 && "w-24",
                            i === 1 && "w-32", 
                            i === 2 && "w-20",
                            i > 2 && "w-28"
                        )}
                    />
                ))}
                
                {/* Loading add button */}
                <Skeleton className="h-8 w-20 rounded-md" />
            </div>
        </div>
    )
}

/**
 * Empty state when no filters are applied
 */
export function FilterEmptyState({
    className,
    title = "No filters applied",
    description = "Add filters to narrow down your results and find exactly what you're looking for.",
    onAddFilter,
    showAddButton = true,
    variant = 'default'
}: FilterEmptyStateProps) {
    if (variant === 'compact') {
        return (
            <div className={cn("flex items-center justify-center py-4", className)}>
                <div className="text-center">
                    <Filter className="h-6 w-6 mx-auto mb-2 text-muted-foreground opacity-50" />
                    <p className="text-sm text-muted-foreground">{title}</p>
                </div>
            </div>
        )
    }

    if (variant === 'minimal') {
        return (
            <div className={cn("flex items-center gap-2 text-muted-foreground", className)}>
                <Filter className="h-4 w-4 opacity-50" />
                <span className="text-sm">{title}</span>
                {showAddButton && onAddFilter && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onAddFilter}
                        className="h-6 px-2 text-xs text-primary hover:text-primary"
                    >
                        <Plus className="h-3 w-3 mr-1" />
                        Add filter
                    </Button>
                )}
            </div>
        )
    }

    return (
        <div className={cn("text-center py-8", className)}>
            {/* Animated Icon */}
            <div className="relative mb-4">
                <div className="absolute inset-0 animate-pulse">
                    <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-blue-100 to-purple-100 opacity-50" />
                </div>
                <div className="relative">
                    <Filter className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <Sparkles className="h-4 w-4 absolute -top-1 -right-1 text-blue-400 animate-bounce" />
                </div>
            </div>

            {/* Content */}
            <h3 className="text-lg font-semibold text-foreground mb-2">
                {title}
            </h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
                {description}
            </p>

            {/* Actions */}
            {showAddButton && onAddFilter && (
                <div className="space-y-3">
                    <Button 
                        onClick={onAddFilter}
                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Add your first filter
                    </Button>
                    
                    {/* Quick suggestions */}
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground">Quick start:</span>
                        {['Search', 'Status', 'Date'].map((suggestion) => (
                            <Button
                                key={suggestion}
                                variant="outline"
                                size="sm"
                                onClick={onAddFilter}
                                className="h-6 px-2 text-xs"
                            >
                                {suggestion}
                            </Button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

/**
 * Error state when filter loading fails
 */
export function FilterErrorState({
    className,
    title = "Failed to load filters",
    description = "Something went wrong while loading the filters. Please try again.",
    onRetry,
    showRetryButton = true
}: FilterErrorStateProps) {
    return (
        <div className={cn("text-center py-6", className)}>
            {/* Error Icon */}
            <div className="relative mb-4">
                <AlertCircle className="h-8 w-8 mx-auto text-destructive mb-2" />
                <div className="absolute inset-0 w-8 h-8 mx-auto rounded-full border-2 border-destructive/20 animate-ping" />
            </div>

            {/* Content */}
            <h3 className="text-base font-medium text-foreground mb-2">
                {title}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-4">
                {description}
            </p>

            {/* Actions */}
            {showRetryButton && onRetry && (
                <Button 
                    variant="outline" 
                    onClick={onRetry}
                    className="text-sm"
                >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Try again
                </Button>
            )}
        </div>
    )
}

/**
 * Success state when filters are working well
 */
export function FilterSuccessState({
    className,
    activeFiltersCount,
    totalResults,
    onClearAll
}: {
    className?: string
    activeFiltersCount: number
    totalResults?: number
    onClearAll?: () => void
}) {
    return (
        <div className={cn("flex items-center gap-3 text-sm", className)}>
            {/* Success indicator */}
            <div className="flex items-center gap-2 text-emerald-600">
                <Target className="h-4 w-4" />
                <span className="font-medium">
                    {activeFiltersCount} filter{activeFiltersCount !== 1 ? 's' : ''} active
                </span>
            </div>

            {/* Results count */}
            {totalResults !== undefined && (
                <div className="flex items-center gap-1 text-muted-foreground">
                    <TrendingUp className="h-3 w-3" />
                    <span>{totalResults.toLocaleString()} results</span>
                </div>
            )}

            {/* Clear action */}
            {onClearAll && activeFiltersCount > 0 && (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClearAll}
                    className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                    Clear all
                </Button>
            )}
        </div>
    )
}

/**
 * No results state when filters return empty
 */
export function FilterNoResultsState({
    className,
    searchTerm,
    onClearFilters,
    onModifyFilters
}: {
    className?: string
    searchTerm?: string
    onClearFilters?: () => void
    onModifyFilters?: () => void
}) {
    return (
        <div className={cn("text-center py-8", className)}>
            {/* No results icon */}
            <div className="relative mb-4">
                <Search className="h-8 w-8 mx-auto text-muted-foreground mb-2 opacity-50" />
                <div className="absolute inset-0 w-12 h-12 mx-auto rounded-full border border-dashed border-muted-foreground/20" />
            </div>

            {/* Content */}
            <h3 className="text-lg font-medium text-foreground mb-2">
                No results found
            </h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
                {searchTerm 
                    ? `No items match "${searchTerm}" with the current filters.`
                    : "No items match the current filter criteria."
                }
                <br />
                Try adjusting your filters or search terms.
            </p>

            {/* Actions */}
            <div className="flex items-center justify-center gap-3">
                {onClearFilters && (
                    <Button variant="outline" onClick={onClearFilters}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Clear filters
                    </Button>
                )}
                {onModifyFilters && (
                    <Button onClick={onModifyFilters}>
                        <Zap className="h-4 w-4 mr-2" />
                        Modify filters
                    </Button>
                )}
            </div>
        </div>
    )
}

/**
 * Filter performance indicator
 */
export function FilterPerformanceIndicator({
    className,
    filterTime,
    isOptimized = true
}: {
    className?: string
    filterTime?: number
    isOptimized?: boolean
}) {
    if (!filterTime) return null

    const isSlowQuery = filterTime > 1000
    const displayTime = filterTime < 1000 
        ? `${filterTime}ms` 
        : `${(filterTime / 1000).toFixed(1)}s`

    return (
        <div className={cn(
            "flex items-center gap-1 text-xs",
            isSlowQuery ? "text-amber-600" : "text-muted-foreground",
            className
        )}>
            <Zap className={cn(
                "h-3 w-3",
                isOptimized && "text-emerald-500",
                !isOptimized && isSlowQuery && "text-amber-500"
            )} />
            <span>Filtered in {displayTime}</span>
            {isOptimized && (
                <span className="text-emerald-600 font-medium">⚡</span>
            )}
        </div>
    )
} 