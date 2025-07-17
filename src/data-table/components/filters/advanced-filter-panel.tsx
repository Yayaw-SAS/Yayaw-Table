/**
 * Advanced filter panel component
 * Main interface for managing advanced filters with design inspired by bazza/ui and Linear
 */
'use client';

import { Filter, MoreHorizontal, Settings2, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type {
  AdvancedFilterModel,
  AdvancedFiltersState,
  ColumnDataType,
  ColumnsFilterConfig,
  FilterActions,
} from '../../types/filter-types';
import { formatFilterValueForDisplay } from '../../utils/advanced-filters';

import {
  FilterValueInput,
  getDefaultFilterOperator,
  getDefaultFilterValue,
} from './filter-value-input';
import { ModernAddFilterDropdown } from './modern-add-filter-dropdown';
import {
  FilterEmptyState,
  FilterLoadingState,
  FilterPerformanceIndicator,
  FilterSuccessState,
} from './modern-filter-states';

export interface AdvancedFilterPanelProps {
  /** Current filters state */
  filters: AdvancedFiltersState;
  /** Available columns configuration */
  columnsConfig: ColumnsFilterConfig;
  /** Filter actions */
  actions: FilterActions;
  /** Whether the panel is disabled */
  disabled?: boolean;
  /** Maximum number of visible filter chips before showing count */
  maxVisibleFilters?: number;
  /** Whether to show the "Add filter" button */
  showAddButton?: boolean;
  /** Whether to show the "Clear all" button */
  showClearButton?: boolean;
  /** Custom className */
  className?: string;
  /** Loading state */
  isLoading?: boolean;
  /** Error state */
  error?: string | null;
  /** Filter performance metrics */
  performance?: {
    filterTime: number;
    isOptimized: boolean;
    resultCount?: number;
  };
  /** Variant style */
  variant?: 'default' | 'modern' | 'compact' | 'minimal';
  /** Recently used columns for quick access */
  recentColumns?: string[];
  /** Popular columns for suggestions */
  popularColumns?: string[];
  /** Whether to show filter performance */
  showPerformance?: boolean;
  /** Whether to animate filter changes */
  enableAnimations?: boolean;
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
  disabled = false,
}: {
  filter: AdvancedFilterModel;
  config: ColumnsFilterConfig[string];
  onUpdate: (updates: Partial<AdvancedFilterModel>) => void;
  onRemove: () => void;
  onToggle: () => void;
  disabled?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);

  const displayValue = useMemo(() => {
    return formatFilterValueForDisplay(
      filter.type,
      filter.operator,
      filter.values,
      config.options
    );
  }, [filter.type, filter.operator, filter.values, config.options]);

  const handleValueChange = useCallback(
    (newValue: unknown) => {
      onUpdate({
        values: newValue as
          | string
          | number
          | string[]
          | Date
          | [number, number]
          | [Date, Date],
      });
    },
    [onUpdate]
  );

  const handleOperatorChange = useCallback(
    (newOperator: unknown) => {
      onUpdate({
        operator: newOperator as
          | 'contains'
          | 'equals'
          | 'startsWith'
          | 'endsWith'
          | 'notContains'
          | 'isEmpty'
          | 'isNotEmpty'
          | 'greaterThan'
          | 'lessThan'
          | 'greaterThanOrEqual'
          | 'lessThanOrEqual'
          | 'between'
          | 'notEquals'
          | 'before'
          | 'after'
          | 'is'
          | 'isNot'
          | 'isAnyOf'
          | 'isNoneOf'
          | 'containsAll'
          | 'containsNone',
      });
    },
    [onUpdate]
  );

  const columnLabel = config.displayValueFn
    ? config.displayValueFn(filter.values)
    : filter.label || filter.columnId;

  return (
    <div
      className={cn(
        'group flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-sm transition-colors',
        filter.isActive ? 'border-border' : 'border-muted bg-muted/50',
        disabled && 'cursor-not-allowed opacity-50'
      )}
    >
      {/* Toggle active/inactive */}
      <button
        className={cn(
          'flex h-3 w-3 items-center justify-center rounded-sm border-2 transition-colors',
          filter.isActive
            ? 'border-primary bg-primary'
            : 'border-muted-foreground/30 hover:border-muted-foreground/50'
        )}
        disabled={disabled}
        onClick={onToggle}
        type="button"
      >
        {filter.isActive && (
          <div className="h-1.5 w-1.5 rounded-sm bg-primary-foreground" />
        )}
      </button>

      {/* Column name */}
      <span className="font-medium text-foreground">{columnLabel}</span>

      {/* Operator - only show if not editing */}
      {!isEditing && (
        <span className="text-muted-foreground text-xs">{filter.operator}</span>
      )}

      {/* Value display or edit mode */}
      <Popover onOpenChange={setIsEditing} open={isEditing}>
        <PopoverTrigger asChild>
          <button
            className="rounded px-1 py-0.5 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
            disabled={disabled}
            type="button"
          >
            {isEditing ? (
              <span className="text-muted-foreground text-xs">Editing...</span>
            ) : (
              <span className="text-xs">
                {displayValue || (
                  <span className="text-muted-foreground">No value</span>
                )}
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto min-w-80 max-w-96 p-4">
          <div className="space-y-3">
            <Label className="font-medium text-sm">
              Edit filter for {columnLabel}
            </Label>
            <FilterValueInput
              config={config}
              disabled={disabled}
              onOperatorChange={handleOperatorChange}
              onValueChange={handleValueChange}
              operator={filter.operator}
              type={filter.type}
              value={filter.values}
            />
            <div className="flex justify-end gap-2">
              <Button
                onClick={() => setIsEditing(false)}
                size="sm"
                variant="outline"
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
            className="rounded p-1 opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100"
            disabled={disabled}
            type="button"
          >
            <MoreHorizontal className="h-3 w-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onToggle}>
            {filter.isActive ? 'Disable' : 'Enable'} filter
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={onRemove}
          >
            Remove filter
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Quick remove button */}
      <button
        className="rounded p-1 opacity-0 transition-opacity hover:bg-destructive hover:text-destructive-foreground group-hover:opacity-100"
        disabled={disabled}
        onClick={onRemove}
        type="button"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
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
  enableAnimations = true,
}: AdvancedFilterPanelProps) {
  const [_editingFilterId, _setEditingFilterId] = useState<string | null>(null);

  const activeFilters = filters.filter((f) => f.isActive);
  const _inactiveFilters = filters.filter((f) => !f.isActive);

  const visibleFilters = filters.slice(0, maxVisibleFilters);
  const hiddenFiltersCount = Math.max(0, filters.length - maxVisibleFilters);

  const handleAddFilter = useCallback(
    (columnId: string, type: ColumnDataType) => {
      const config = columnsConfig[columnId];
      if (!config) {
        return;
      }

      const operator = getDefaultFilterOperator(type);
      const value = getDefaultFilterValue(type, operator);

      actions.addFilter({
        columnId,
        type,
        operator,
        values: value,
        isActive: true,
      });
    },
    [columnsConfig, actions]
  );

  const handleUpdateFilter = useCallback(
    (filterId: string, updates: Partial<AdvancedFilterModel>) => {
      actions.updateFilter(filterId, updates);
    },
    [actions]
  );

  // Show loading state
  if (isLoading) {
    return <FilterLoadingState className={className} count={3} />;
  }

  // Show error state
  if (error) {
    return (
      <div
        className={cn(
          'rounded-lg border border-destructive/20 bg-destructive/5 p-3',
          className
        )}
      >
        <p className="text-destructive text-sm">{error}</p>
      </div>
    );
  }

  // Handle empty state
  if (filters.length === 0) {
    if (!showAddButton) {
      return null;
    }

    return (
      <div className={cn('space-y-3', className)}>
        {variant === 'minimal' ? (
          <FilterEmptyState
            onAddFilter={() => {
              // Get first available column
              const firstColumn = Object.keys(columnsConfig)[0];
              if (firstColumn) {
                handleAddFilter(firstColumn, columnsConfig[firstColumn].type);
              }
            }}
            variant="minimal"
          />
        ) : (
          <div className="flex items-center justify-between rounded-lg border border-muted border-dashed bg-muted/20 p-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 shrink-0 text-muted-foreground opacity-50" />
                <span className="text-muted-foreground text-sm">
                  No filters applied
                </span>
              </div>
            </div>
            <ModernAddFilterDropdown
              columnsConfig={columnsConfig}
              disabled={disabled}
              onAddFilter={handleAddFilter}
              placeholder="Add filter..."
              popularColumns={popularColumns}
              recentColumns={recentColumns}
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
    );
  }

  // Render filters based on variant
  const renderContent = () => {
    switch (variant) {
      case 'minimal':
        return (
          <div className="flex flex-wrap items-center gap-1">
            {visibleFilters.map((filter) => {
              const config = columnsConfig[filter.columnId];
              if (!config) {
                return null;
              }

              return (
                <FilterChip
                  config={config}
                  disabled={disabled}
                  filter={filter}
                  key={filter.id}
                  onRemove={() => actions.removeFilter(filter.id)}
                  onToggle={() => actions.toggleFilter(filter.id)}
                  onUpdate={(updates) => handleUpdateFilter(filter.id, updates)}
                />
              );
            })}

            {hiddenFiltersCount > 0 && (
              <Badge className="h-6 text-xs" variant="secondary">
                +{hiddenFiltersCount}
              </Badge>
            )}
          </div>
        );

      case 'compact':
        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <FilterSuccessState
                activeFiltersCount={activeFilters.length}
                onClearAll={showClearButton ? actions.clearFilters : undefined}
                totalResults={performance?.resultCount}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {visibleFilters.map((filter) => {
                const config = columnsConfig[filter.columnId];
                if (!config) {
                  return null;
                }

                return (
                  <FilterChip
                    config={config}
                    disabled={disabled}
                    filter={filter}
                    key={filter.id}
                    onRemove={() => actions.removeFilter(filter.id)}
                    onToggle={() => actions.toggleFilter(filter.id)}
                    onUpdate={(updates) =>
                      handleUpdateFilter(filter.id, updates)
                    }
                  />
                );
              })}
            </div>
          </div>
        );

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
                  className="h-6 px-2 text-muted-foreground text-xs hover:text-foreground"
                  disabled={disabled}
                  onClick={actions.clearFilters}
                  size="sm"
                  variant="ghost"
                >
                  Clear all
                </Button>
              )}
            </div>

            {/* Filter chips */}
            <div
              className={cn(
                'flex flex-wrap items-center gap-2',
                enableAnimations && 'transition-all duration-200'
              )}
            >
              {visibleFilters.map((filter, _index) => {
                const config = columnsConfig[filter.columnId];
                if (!config) {
                  return null;
                }

                return (
                  <div
                    className={cn(
                      enableAnimations && 'transition-all duration-150'
                    )}
                    key={filter.id}
                  >
                    <FilterChip
                      config={config}
                      disabled={disabled}
                      filter={filter}
                      onRemove={() => actions.removeFilter(filter.id)}
                      onToggle={() => actions.toggleFilter(filter.id)}
                      onUpdate={(updates) =>
                        handleUpdateFilter(filter.id, updates)
                      }
                    />
                  </div>
                );
              })}

              {/* Hidden filters indicator */}
              {hiddenFiltersCount > 0 && (
                <Badge className="text-xs" variant="secondary">
                  +{hiddenFiltersCount} more
                </Badge>
              )}

              {/* Add filter button */}
              {showAddButton && (
                <ModernAddFilterDropdown
                  columnsConfig={columnsConfig}
                  disabled={disabled}
                  onAddFilter={handleAddFilter}
                  placeholder="Add filter..."
                  popularColumns={popularColumns}
                  recentColumns={recentColumns}
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
        );
    }
  };

  return (
    <div
      className={cn(
        'w-full',
        variant === 'modern' && 'rounded-lg border bg-card/50 p-3',
        variant === 'compact' && 'rounded-md bg-muted/30 p-2',
        className
      )}
    >
      {renderContent()}
    </div>
  );
}

/**
 * Compact filter panel for smaller spaces
 */
export function CompactFilterPanel({
  filters,
  columnsConfig,
  actions,
  disabled = false,
}: Pick<
  AdvancedFilterPanelProps,
  'filters' | 'columnsConfig' | 'actions' | 'disabled'
>) {
  const [isExpanded, setIsExpanded] = useState(false);
  const activeFiltersCount = filters.filter((f) => f.isActive).length;

  if (filters.length === 0) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border border-muted border-dashed bg-muted/10 p-2">
        <div className="flex items-center gap-2">
          <Filter className="h-3 w-3 shrink-0 text-muted-foreground opacity-50" />
          <span className="text-muted-foreground text-xs">No filters</span>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <ModernAddFilterDropdown
                  columnsConfig={columnsConfig}
                  disabled={disabled}
                  onAddFilter={(columnId, type) => {
                    const config = columnsConfig[columnId];
                    if (!config) {
                      return;
                    }

                    const operator = getDefaultFilterOperator(type);
                    const value = getDefaultFilterValue(type, operator);

                    actions.addFilter({
                      columnId,
                      type,
                      operator,
                      values: value,
                      isActive: true,
                    });
                  }}
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
    );
  }

  return (
    <Popover onOpenChange={setIsExpanded} open={isExpanded}>
      <PopoverTrigger asChild>
        <Button
          className="h-7 gap-1"
          disabled={disabled}
          size="sm"
          variant="outline"
        >
          <Filter className="h-3 w-3" />
          {activeFiltersCount > 0 ? `${activeFiltersCount} filters` : 'Filter'}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto min-w-96 max-w-screen-sm p-4"
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="font-medium">Filters</Label>
            {filters.length > 0 && (
              <Button
                className="h-6 text-xs"
                onClick={actions.clearFilters}
                size="sm"
                variant="ghost"
              >
                Clear all
              </Button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            <div className="space-y-2">
              {filters.map((filter) => {
                const config = columnsConfig[filter.columnId];
                if (!config) {
                  return null;
                }

                return (
                  <FilterChip
                    config={config}
                    disabled={disabled}
                    filter={filter}
                    key={filter.id}
                    onRemove={() => actions.removeFilter(filter.id)}
                    onToggle={() => actions.toggleFilter(filter.id)}
                    onUpdate={(updates) =>
                      actions.updateFilter(filter.id, updates)
                    }
                  />
                );
              })}
            </div>
          </div>

          <Separator />

          <ModernAddFilterDropdown
            columnsConfig={columnsConfig}
            disabled={disabled}
            onAddFilter={(columnId, type) => {
              const config = columnsConfig[columnId];
              if (!config) {
                return;
              }

              const operator = getDefaultFilterOperator(type);
              const value = getDefaultFilterValue(type, operator);

              actions.addFilter({
                columnId,
                type,
                operator,
                values: value,
                isActive: true,
              });
            }}
            placeholder="Add filter..."
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
