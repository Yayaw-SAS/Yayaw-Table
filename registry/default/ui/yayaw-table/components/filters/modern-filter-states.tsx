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
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useTranslations } from "../../providers/table-provider";
import { translateWithFallback } from "./i18n-utils";

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
  title,
  description,
  onAddFilter,
  showAddButton = true,
  variant = "default",
}: FilterEmptyStateProps) {
  const { t } = useTranslations();
  const resolvedTitle = title ?? t("filters.noFilters");
  const resolvedDescription =
    description ??
    translateWithFallback(
      t,
      "filters.advanced.empty_description",
      "Add filters to narrow down your results and find exactly what you're looking for."
    );

  if (variant === "compact") {
    return (
      <div className={cn("flex items-center justify-center py-4", className)}>
        <div className="text-center">
          <Filter className="mx-auto mb-2 h-6 w-6 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground text-sm">{resolvedTitle}</p>
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
        <span className="text-sm">{resolvedTitle}</span>
        {showAddButton && onAddFilter && (
          <Button
            className="h-6 px-2 text-primary text-xs hover:text-primary"
            onClick={onAddFilter}
            size="sm"
            variant="ghost"
          >
            <Plus className="mr-1 h-3 w-3" />
            {t("filters.add")}
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
          <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 opacity-70" />
        </div>
        <div className="relative">
          <Filter className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <Sparkles className="absolute -top-1 -right-1 h-4 w-4 animate-bounce text-primary" />
        </div>
      </div>

      {/* Content */}
      <h3 className="mb-2 font-semibold text-foreground text-lg">
        {resolvedTitle}
      </h3>
      <p className="mx-auto mb-6 max-w-md text-muted-foreground text-sm">
        {resolvedDescription}
      </p>

      {/* Actions */}
      {showAddButton && onAddFilter && (
        <div className="space-y-3">
          <Button onClick={onAddFilter}>
            <Plus className="mr-2 h-4 w-4" />
            {translateWithFallback(
              t,
              "filters.advanced.add_first_filter",
              "Add your first filter"
            )}
          </Button>

          {/* Quick suggestions */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="text-muted-foreground text-xs">
              {translateWithFallback(
                t,
                "filters.advanced.quick_start",
                "Quick start:"
              )}
            </span>
            {[
              translateWithFallback(
                t,
                "filters.advanced.quick_start_search",
                "Search"
              ),
              translateWithFallback(
                t,
                "filters.advanced.quick_start_status",
                "Status"
              ),
              translateWithFallback(
                t,
                "filters.advanced.quick_start_date",
                "Date"
              ),
            ].map((suggestion) => (
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
  title,
  description,
  onRetry,
  showRetryButton = true,
}: FilterErrorStateProps) {
  const { t } = useTranslations();
  const resolvedTitle =
    title ??
    translateWithFallback(
      t,
      "filters.advanced.load_error_title",
      "Failed to load filters"
    );
  const resolvedDescription =
    description ??
    translateWithFallback(
      t,
      "filters.advanced.load_error_description",
      "Something went wrong while loading the filters. Please try again."
    );

  return (
    <div className={cn("py-6 text-center", className)}>
      {/* Error Icon */}
      <div className="relative mb-4">
        <AlertCircle className="mx-auto mb-2 h-8 w-8 text-destructive" />
        <div className="absolute inset-0 mx-auto h-8 w-8 animate-ping rounded-full border-2 border-destructive/20" />
      </div>

      {/* Content */}
      <h3 className="mb-2 font-medium text-base text-foreground">
        {resolvedTitle}
      </h3>
      <p className="mx-auto mb-4 max-w-sm text-muted-foreground text-sm">
        {resolvedDescription}
      </p>

      {/* Actions */}
      {showRetryButton && onRetry && (
        <Button className="text-sm" onClick={onRetry} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          {translateWithFallback(t, "filters.advanced.retry", "Try again")}
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
  const { t } = useTranslations();
  return (
    <div className={cn("flex items-center gap-3 text-sm", className)}>
      {/* Success indicator */}
      <div className="flex items-center gap-2 text-emerald-600">
        <Target className="h-4 w-4" />
        <span className="font-medium">
          {t("filters.active_count", { count: activeFiltersCount })}
        </span>
      </div>

      {/* Results count */}
      {totalResults !== undefined && (
        <div className="flex items-center gap-1 text-muted-foreground">
          <TrendingUp className="h-3 w-3" />
          <span>
            {translateWithFallback(
              t,
              "filters.advanced.results_count",
              "{count} results",
              { count: totalResults.toLocaleString() }
            )}
          </span>
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
          {t("filters.clear")}
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
  const { t } = useTranslations();
  const noResultsWithSearch = translateWithFallback(
    t,
    "filters.advanced.no_results_with_search",
    'No items match "{search}" with the current filters.',
    { search: searchTerm ?? "" }
  );

  return (
    <div className={cn("py-8 text-center", className)}>
      {/* No results icon */}
      <div className="relative mb-4">
        <Search className="mx-auto mb-2 h-8 w-8 text-muted-foreground opacity-50" />
        <div className="absolute inset-0 mx-auto h-12 w-12 rounded-full border border-muted-foreground/20 border-dashed" />
      </div>

      {/* Content */}
      <h3 className="mb-2 font-medium text-foreground text-lg">
        {t("table.no_results")}
      </h3>
      <p className="mx-auto mb-6 max-w-md text-muted-foreground text-sm">
        {searchTerm
          ? noResultsWithSearch
          : translateWithFallback(
              t,
              "filters.advanced.no_results_description",
              "No items match the current filter criteria."
            )}
        <br />
        {translateWithFallback(
          t,
          "filters.advanced.adjust_filters_hint",
          "Try adjusting your filters or search terms."
        )}
      </p>

      {/* Actions */}
      <div className="flex items-center justify-center gap-3">
        {onClearFilters && (
          <Button onClick={onClearFilters} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("filters.clear")}
          </Button>
        )}
        {onModifyFilters && (
          <Button onClick={onModifyFilters}>
            <Zap className="mr-2 h-4 w-4" />
            {translateWithFallback(
              t,
              "filters.advanced.modify_filters",
              "Modify filters"
            )}
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
  const { t } = useTranslations();
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
      <span>
        {translateWithFallback(
          t,
          "filters.advanced.filtered_in",
          "Filtered in {time}",
          { time: displayTime }
        )}
      </span>
      {isOptimized && <span className="font-medium text-emerald-600">⚡</span>}
    </div>
  );
}
