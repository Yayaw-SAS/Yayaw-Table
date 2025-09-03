/**
 * Advanced filter panel component
 * Main interface for managing advanced filters with design inspired by bazza/ui and Linear
 */
'use client';

import { Filter, MoreHorizontal, Settings2, X } from 'lucide-react';
import { useCallback, useMemo, useState, useEffect } from 'react';
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
import { formatFilterValueForDisplay, createFilter } from '../../utils/advanced-filters';

import {
  FilterValueInput,
  getDefaultFilterOperator,
  getDefaultFilterValue,
} from './filter-value-input';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Star, Clock, Filter as FilterIcon, Plus, Type, Hash, Calendar, CheckSquare, List as ListIcon } from 'lucide-react';
// Replaced popover dropdown with inline panel to avoid nested popovers under StackMenu
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
  autoEdit = false,
}: {
  filter: AdvancedFilterModel;
  config: ColumnsFilterConfig[string];
  onUpdate: (updates: Partial<AdvancedFilterModel>) => void;
  onRemove: () => void;
  onToggle: () => void;
  disabled?: boolean;
  autoEdit?: boolean;
}) {
  const [isEditing, setIsEditing] = useState<boolean>(autoEdit);
  // Ensure auto open when requested
  useEffect(() => {
    if (autoEdit) {
      setIsEditing(true);
    }
  }, [autoEdit]);
  const [stagedOperator, setStagedOperator] = useState<
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
    | 'containsNone'
  >(filter.operator as any);
  const [stagedValues, setStagedValues] = useState<
    string | number | string[] | Date | [number, number] | [Date, Date]
  >(filter.values as any);

  const displayValue = useMemo(() => {
    return formatFilterValueForDisplay(
      filter.type,
      filter.operator,
      filter.values,
      config.options
    );
  }, [filter.type, filter.operator, filter.values, config.options]);

  const handleValueChange = useCallback((newValue: unknown) => {
    setStagedValues(
      newValue as
        | string
        | number
        | string[]
        | Date
        | [number, number]
        | [Date, Date]
    );
  }, []);

  const handleOperatorChange = useCallback((newOperator: unknown) => {
    setStagedOperator(
      newOperator as
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
        | 'containsNone'
    );
  }, []);

  const columnLabel = config.displayValueFn
    ? config.displayValueFn(filter.values)
    : filter.label || filter.columnId;

  return (
    <div className="w-full">
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

      {/* Value display or edit mode (inline, no popover) */}
      <button
        className="rounded px-1 py-0.5 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
        disabled={disabled}
        onClick={() => setIsEditing(true)}
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
      </div>

      {isEditing && (
        <div className="mt-2 ml-6 w-full max-w-full rounded-md border bg-background p-4 shadow-md">
          <div
            className="space-y-3"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onUpdate({ operator: stagedOperator as any, values: stagedValues as any });
                setIsEditing(false);
              }
            }}
          >
            <Label className="font-medium text-sm">Edit filter for {columnLabel}</Label>
            <FilterValueInput
              config={config}
              disabled={disabled}
              inline
              onOperatorChange={handleOperatorChange}
              onValueChange={handleValueChange}
              operator={stagedOperator as any}
              type={filter.type}
              value={stagedValues as any}
            />
            <div className="flex justify-end gap-2">
              <Button
                onClick={() => {
                  onUpdate({ operator: stagedOperator as any, values: stagedValues as any });
                  setIsEditing(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onUpdate({ operator: stagedOperator as any, values: stagedValues as any });
                    setIsEditing(false);
                  }
                }}
                size="sm"
                variant="outline"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* More actions & quick remove aligned with chip row */}
      <div className="mt-2 ml-6 flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="rounded p-1 transition-opacity hover:bg-accent"
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
        <button
          className="rounded p-1 transition-opacity hover:bg-destructive hover:text-destructive-foreground"
          disabled={disabled}
          onClick={onRemove}
          type="button"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
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
  const [draftFilters, setDraftFilters] = useState<AdvancedFilterModel[]>([]);
  const [isAddPanelOpen, setIsAddPanelOpen] = useState(false);

  const activeFilters = filters.filter((f) => f.isActive);
  const _inactiveFilters = filters.filter((f) => !f.isActive);

  const combinedFilters = [...draftFilters, ...filters];
  const visibleFilters = combinedFilters.slice(0, maxVisibleFilters);
  const hiddenFiltersCount = Math.max(0, combinedFilters.length - maxVisibleFilters);

  const handleAddFilter = useCallback(
    (columnId: string, type: ColumnDataType) => {
      const config = columnsConfig[columnId];
      if (!config) {
        return;
      }

      const operator = getDefaultFilterOperator(type);
      const value = getDefaultFilterValue(type, operator);

      const draft = createFilter(
        columnId,
        type as any,
        operator as any,
        value as any,
        { isActive: false, label: columnId }
      );
      setDraftFilters((prev) => [draft, ...prev]);
      setIsAddPanelOpen(true);
    },
    [columnsConfig]
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

  // Handle empty state (include drafts)
  if (combinedFilters.length === 0) {
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
          <div className="space-y-2 rounded-lg border border-muted bg-muted/20 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 shrink-0 text-muted-foreground opacity-50" />
                <span className="text-muted-foreground text-sm">No filters applied</span>
              </div>
              <Button
                className="h-8 px-3"
                disabled={disabled}
                onClick={() => setIsAddPanelOpen((v) => !v)}
                size="sm"
                variant="outline"
              >
                Add filter...
              </Button>
            </div>
            {isAddPanelOpen && (
              <InlineAddFilterPanel
                columnsConfig={columnsConfig}
                disabled={disabled}
                onAddFilter={handleAddFilter}
                popularColumns={popularColumns}
                recentColumns={recentColumns}
              />
            )}
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

                const isDraft = draftFilters.some((d) => d.id === filter.id);
                return (
                  <div
                    className={cn(
                      enableAnimations && 'transition-all duration-150'
                    )}
                    key={filter.id}
                  >
                    {isDraft ? (
                      <FilterChip
                        config={config}
                        disabled={disabled}
                        filter={filter}
                        autoEdit
                        onRemove={() =>
                          setDraftFilters((prev) =>
                            prev.filter((d) => d.id !== filter.id)
                          )
                        }
                        onToggle={() =>
                          setDraftFilters((prev) =>
                            prev.map((d) =>
                              d.id === filter.id
                                ? { ...d, isActive: !d.isActive }
                                : d
                            )
                          )
                        }
                        onUpdate={(updates) => {
                          actions.addFilter({
                            columnId: filter.columnId,
                            type: filter.type,
                            operator:
                              (updates.operator as any) || (filter.operator as any),
                            values:
                              (updates.values as any) || (filter.values as any),
                            isActive: true,
                          });
                          setDraftFilters((prev) =>
                            prev.filter((d) => d.id !== filter.id)
                          );
                        }}
                      />
                    ) : (
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
                    )}
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
                <div className="w-full">
                  <Button
                    className="h-8 px-3 text-muted-foreground text-xs hover:text-foreground"
                    disabled={disabled}
                    onClick={() => setIsAddPanelOpen((v) => !v)}
                    size="sm"
                    variant="ghost"
                  >
                    Add filter...
                  </Button>
                  {isAddPanelOpen && (
                    <InlineAddFilterPanel
                      columnsConfig={columnsConfig}
                      disabled={disabled}
                      onAddFilter={handleAddFilter}
                      popularColumns={popularColumns}
                      recentColumns={recentColumns}
                    />
                  )}
                </div>
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

// Inline Add Filter Panel (search + tabs) rendered inside StackMenu content
function InlineAddFilterPanel({
  columnsConfig,
  onAddFilter,
  recentColumns = [],
  popularColumns = [],
  disabled = false,
}: {
  columnsConfig: ColumnsFilterConfig;
  onAddFilter: (columnId: string, type: ColumnDataType) => void;
  recentColumns?: string[];
  popularColumns?: string[];
  disabled?: boolean;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'popular' | 'recent' | 'all'>(
    'popular'
  );

  const options = useMemo(() => {
    return Object.entries(columnsConfig)
      .filter(([_, cfg]) => cfg.filterable !== false)
      .map(([id, cfg]) => ({
        id,
        label: id,
        type: cfg.type,
        description: cfg.placeholder,
        isRecent: recentColumns.includes(id),
        isPopular: popularColumns.includes(id),
      }));
  }, [columnsConfig, recentColumns, popularColumns]);

  const filtered = useMemo(() => {
    const lower = searchTerm.toLowerCase();
    const list = options.filter(
      (o) =>
        !searchTerm ||
        o.label.toLowerCase().includes(lower) ||
        (o.description || '').toLowerCase().includes(lower)
    );

    const popular = list.filter((o) => o.isPopular).slice(0, 6);
    const recent = list.filter((o) => o.isRecent && !o.isPopular).slice(0, 6);

    const grouped: Record<string, typeof options> = {};
    for (const o of list) {
      const key = o.type === 'multiOption' ? 'option' : o.type;
      if (!grouped[key]) grouped[key] = [] as typeof options;
      grouped[key].push(o);
    }

    return { popular, recent, all: grouped, search: list };
  }, [options, searchTerm]);

  const typeIcon: Record<string, React.ComponentType<{ className?: string }>> = {
    text: Type,
    number: Hash,
    date: Calendar,
    option: CheckSquare,
    multiOption: ListIcon,
  } as const;

  return (
    <div className="w-72 rounded-md border bg-background">
      <div className="border-border border-b p-3">
        <div className="flex items-center gap-2">
          <FilterIcon className="h-4 w-4 text-muted-foreground" />
          <Input
            className="h-auto border-none p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search columns..."
            value={searchTerm}
          />
        </div>
      </div>

      {searchTerm ? (
        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.search.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground text-sm">
              No columns found
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.search.map((o) => {
                const Icon = typeIcon[o.type] || Type;
                return (
                  <button
                    key={o.id}
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-accent/50"
                    disabled={disabled}
                    onClick={() => onAddFilter(o.id, o.type)}
                    type="button"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-md border bg-muted">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium text-sm">{o.label}</span>
                      </div>
                      {o.description && (
                        <p className="truncate text-muted-foreground text-xs">{o.description}</p>
                      )}
                    </div>
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className="border-border border-b px-3">
            <Tabs
              className="w-full"
              onValueChange={(v) => setActiveTab(v as typeof activeTab)}
              value={activeTab}
            >
              <TabsList className="grid h-8 w-full grid-cols-3">
                <TabsTrigger className="text-xs" value="popular">
                  <Star className="mr-1 h-3 w-3" /> Popular
                </TabsTrigger>
                <TabsTrigger className="text-xs" value="recent">
                  <Clock className="mr-1 h-3 w-3" /> Recent
                </TabsTrigger>
                <TabsTrigger className="text-xs" value="all">
                  <FilterIcon className="mr-1 h-3 w-3" /> All
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="max-h-80 overflow-y-auto">
            <Tabs className="w-full" value={activeTab}>
              <TabsContent className="m-0 p-2" value="popular">
                {filtered.popular.length === 0 ? (
                  <div className="py-6 text-center text-muted-foreground text-sm">
                    No popular filters
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filtered.popular.map((o) => {
                      const Icon = typeIcon[o.type] || Type;
                      return (
                        <button
                          key={o.id}
                          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-accent/50"
                          disabled={disabled}
                          onClick={() => onAddFilter(o.id, o.type)}
                          type="button"
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-md border bg-muted">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="truncate font-medium text-sm">{o.label}</span>
                          </div>
                          <Plus className="h-4 w-4 text-muted-foreground" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              <TabsContent className="m-0 p-2" value="recent">
                {filtered.recent.length === 0 ? (
                  <div className="py-6 text-center text-muted-foreground text-sm">
                    No recent filters
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filtered.recent.map((o) => {
                      const Icon = typeIcon[o.type] || Type;
                      return (
                        <button
                          key={o.id}
                          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-accent/50"
                          disabled={disabled}
                          onClick={() => onAddFilter(o.id, o.type)}
                          type="button"
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-md border bg-muted">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="truncate font-medium text-sm">{o.label}</span>
                          </div>
                          <Plus className="h-4 w-4 text-muted-foreground" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              <TabsContent className="m-0 p-2" value="all">
                <div className="space-y-3">
                  {Object.entries(filtered.all).map(([group, list]) => (
                    <div key={group}>
                      <div className="mb-2 flex items-center gap-2 px-2 py-1 text-muted-foreground text-xs font-medium">
                        {group}
                        <span className="ml-1 rounded-md bg-muted px-1 text-[10px]">{list.length}</span>
                      </div>
                      <div className="space-y-1">
                        {list.map((o) => {
                          const Icon = typeIcon[o.type] || Type;
                          return (
                            <button
                              key={o.id}
                              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-accent/50"
                              disabled={disabled}
                              onClick={() => onAddFilter(o.id, o.type)}
                              type="button"
                            >
                              <div className="flex h-8 w-8 items-center justify-center rounded-md border bg-muted">
                                <Icon className="h-4 w-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <span className="truncate font-medium text-sm">{o.label}</span>
                              </div>
                              <Plus className="h-4 w-4 text-muted-foreground" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      )}
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
  const [showInlineAdd, setShowInlineAdd] = useState(false);
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
              <Button
                className="h-7 px-2 text-xs"
                disabled={disabled}
                onClick={() => setShowInlineAdd((v) => !v)}
                size="sm"
                variant="outline"
              >
                Add filter...
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Add filters to narrow down results</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {showInlineAdd && (
          <div className="mt-2">
            <InlineAddFilterPanel
              columnsConfig={columnsConfig}
              disabled={disabled}
              onAddFilter={(columnId, type) => {
                const operator = getDefaultFilterOperator(type);
                const value = getDefaultFilterValue(type, operator) as
                  | string
                  | number
                  | [number, number]
                  | Date
                  | [Date, Date]
                  | string[];
                actions.addFilter({
                  columnId,
                  type,
                  operator,
                  values: value,
                  isActive: true,
                });
                setShowInlineAdd(false);
              }}
            />
          </div>
        )}
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

          <InlineAddFilterPanel
            columnsConfig={columnsConfig}
            disabled={disabled}
            onAddFilter={(columnId, type) => {
              const operator = getDefaultFilterOperator(type);
              const value = getDefaultFilterValue(type, operator) as
                | string
                | number
                | [number, number]
                | Date
                | [Date, Date]
                | string[];
              actions.addFilter({
                columnId,
                type,
                operator,
                values: value,
                isActive: true,
              });
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
