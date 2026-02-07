/**
 * Modern Filter States Components
 * Loading, empty, and error states with beautiful animations
 */
"use client";

import {
  AlertCircle,
  Filter,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/ui/shadcn/button";
import { Skeleton } from "@/ui/shadcn/skeleton";

interface FilterLoadingStateProps {
  className?: string;
  count?: number;
  showTitle?: boolean;
}

interface FilterEmptyStateProps {
  className?: string;
  title?: string;
  description?: string;
  onAddFilter?: () => void;
  showAddButton?: boolean;
  variant?: "default" | "compact" | "minimal";
}

interface FilterErrorStateProps {
  className?: string;
  title?: string;
  description?: string;
  onRetry?: () => void;
  showRetryButton?: boolean;
}

/**
 * Loading state with skeleton chips
 */
export function FilterLoadingState({
  className,
  count = 3,
  showTitle = true,
}: FilterLoadingStateProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {showTitle && (
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-24" />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {Array.from({ length: count }, (_, i) => i).map((index) => (
          <Skeleton
            className={cn(
              "h-8 rounded-full",
              index === 0 && "w-24",
              index === 1 && "w-32",
              index === 2 && "w-20",
              index > 2 && "w-28"
            )}
            key={`skeleton-${count}-${index}`}
          />
        ))}

        {/* Loading add button */}
        <Skeleton className="h-8 w-20 rounded-md" />
      </div>
    </div>
  );
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
  variant = "default",
}: FilterEmptyStateProps) {
  if (variant === "compact") {
    return (
      <div className={cn("flex items-center justify-center py-4", className)}>
        <div className="text-center">
          <Filter className="mx-auto mb-2 h-6 w-6 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground text-sm">{title}</p>
        </div>
      </div>
    );
  }

  if (variant === "minimal") {
    return (
      <div
        className={cn(
          "flex items-center gap-2 text-muted-foreground",
          className
        )}
      >
        <Filter className="h-4 w-4 opacity-50" />
        <span className="text-sm">{title}</span>
        {showAddButton && onAddFilter && (
          <Button
            className="h-6 px-2 text-primary text-xs hover:text-primary"
            onClick={onAddFilter}
            size="sm"
            variant="ghost"
          >
            <Plus className="mr-1 h-3 w-3" />
            Add filter
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={cn("py-8 text-center", className)}>
      {/* Animated Icon */}
      <div className="relative mb-4">
        <div className="absolute inset-0 animate-pulse">
          <div className="mx-auto h-16 w-16 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 opacity-50" />
        </div>
        <div className="relative">
          <Filter className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <Sparkles className="absolute -top-1 -right-1 h-4 w-4 animate-bounce text-blue-400" />
        </div>
      </div>

      {/* Content */}
      <h3 className="mb-2 font-semibold text-foreground text-lg">{title}</h3>
      <p className="mx-auto mb-6 max-w-md text-muted-foreground text-sm">
        {description}
      </p>

      {/* Actions */}
      {showAddButton && onAddFilter && (
        <div className="space-y-3">
          <Button
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            onClick={onAddFilter}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add your first filter
          </Button>

          {/* Quick suggestions */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="text-muted-foreground text-xs">Quick start:</span>
            {["Search", "Status", "Date"].map((suggestion) => (
              <Button
                className="h-6 px-2 text-xs"
                key={suggestion}
                onClick={onAddFilter}
                size="sm"
                variant="outline"
              >
                {suggestion}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Error state when filter loading fails
 */
export function FilterErrorState({
  className,
  title = "Failed to load filters",
  description = "Something went wrong while loading the filters. Please try again.",
  onRetry,
  showRetryButton = true,
}: FilterErrorStateProps) {
  return (
    <div className={cn("py-6 text-center", className)}>
      {/* Error Icon */}
      <div className="relative mb-4">
        <AlertCircle className="mx-auto mb-2 h-8 w-8 text-destructive" />
        <div className="absolute inset-0 mx-auto h-8 w-8 animate-ping rounded-full border-2 border-destructive/20" />
      </div>

      {/* Content */}
      <h3 className="mb-2 font-medium text-base text-foreground">{title}</h3>
      <p className="mx-auto mb-4 max-w-sm text-muted-foreground text-sm">
        {description}
      </p>

      {/* Actions */}
      {showRetryButton && onRetry && (
        <Button className="text-sm" onClick={onRetry} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Try again
        </Button>
      )}
    </div>
  );
}

/**
 * Success state when filters are working well
 */
export function FilterSuccessState({
  className,
  activeFiltersCount,
  totalResults,
  onClearAll,
}: {
  className?: string;
  activeFiltersCount: number;
  totalResults?: number;
  onClearAll?: () => void;
}) {
  return (
    <div className={cn("flex items-center gap-3 text-sm", className)}>
      {/* Success indicator */}
      <div className="flex items-center gap-2 text-emerald-600">
        <Target className="h-4 w-4" />
        <span className="font-medium">
          {activeFiltersCount} filter{activeFiltersCount !== 1 ? "s" : ""}{" "}
          active
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
          className="h-6 px-2 text-muted-foreground text-xs hover:text-foreground"
          onClick={onClearAll}
          size="sm"
          variant="ghost"
        >
          Clear all
        </Button>
      )}
    </div>
  );
}

/**
 * No results state when filters return empty
 */
export function FilterNoResultsState({
  className,
  searchTerm,
  onClearFilters,
  onModifyFilters,
}: {
  className?: string;
  searchTerm?: string;
  onClearFilters?: () => void;
  onModifyFilters?: () => void;
}) {
  return (
    <div className={cn("py-8 text-center", className)}>
      {/* No results icon */}
      <div className="relative mb-4">
        <Search className="mx-auto mb-2 h-8 w-8 text-muted-foreground opacity-50" />
        <div className="absolute inset-0 mx-auto h-12 w-12 rounded-full border border-muted-foreground/20 border-dashed" />
      </div>

      {/* Content */}
      <h3 className="mb-2 font-medium text-foreground text-lg">
        No results found
      </h3>
      <p className="mx-auto mb-6 max-w-md text-muted-foreground text-sm">
        {searchTerm
          ? `No items match "${searchTerm}" with the current filters.`
          : "No items match the current filter criteria."}
        <br />
        Try adjusting your filters or search terms.
      </p>

      {/* Actions */}
      <div className="flex items-center justify-center gap-3">
        {onClearFilters && (
          <Button onClick={onClearFilters} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Clear filters
          </Button>
        )}
        {onModifyFilters && (
          <Button onClick={onModifyFilters}>
            <Zap className="mr-2 h-4 w-4" />
            Modify filters
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Filter performance indicator
 */
export function FilterPerformanceIndicator({
  className,
  filterTime,
  isOptimized = true,
}: {
  className?: string;
  filterTime?: number;
  isOptimized?: boolean;
}) {
  if (!filterTime) {
    return null;
  }

  const isSlowQuery = filterTime > 1000;
  const displayTime =
    filterTime < 1000
      ? `${filterTime}ms`
      : `${(filterTime / 1000).toFixed(1)}s`;

  return (
    <div
      className={cn(
        "flex items-center gap-1 text-xs",
        isSlowQuery ? "text-amber-600" : "text-muted-foreground",
        className
      )}
    >
      <Zap
        className={cn(
          "h-3 w-3",
          isOptimized && "text-emerald-500",
          !isOptimized && isSlowQuery && "text-amber-500"
        )}
      />
      <span>Filtered in {displayTime}</span>
      {isOptimized && <span className="font-medium text-emerald-600">⚡</span>}
    </div>
  );
}
