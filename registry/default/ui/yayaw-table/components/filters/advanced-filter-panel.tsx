/**
 * Advanced filter panel component
 * Main interface for managing advanced filters with design inspired by bazza/ui and Linear
 */
"use client";

import {
  Filter,
  MoreHorizontal,
  Pencil,
  Plus,
  Power,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useLocale, useTranslations } from "../../providers/table-provider";
import {
  type AdvancedFilterModel,
  type AdvancedFiltersState,
  type ColumnDataType,
  type ColumnsFilterConfig,
  FILTER_OPERATORS_LABELS,
  type FilterActions,
  type FilterOperators,
  type FilterValues,
} from "../../types/filter-types";
import {
  createFilter,
  formatFilterValueForDisplay,
} from "../../utils/advanced-filters";
import { ColumnIcon } from "../../utils/column-icons";
import {
  FilterValueInput,
  getDefaultFilterOperator,
  getDefaultFilterValue,
} from "./filter-value-input";
import {
  getTranslatedOperatorLabel,
  translateWithFallback,
} from "./i18n-utils";
// Replaced popover dropdown with inline panel to avoid nested popovers under StackMenu
import {
  FilterEmptyState,
  FilterLoadingState,
  FilterSuccessState,
} from "./modern-filter-states";

const EMPTY_COLUMNS: never[] = [];

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
  variant?: "default" | "modern" | "compact" | "minimal";
  /** Recently used columns for quick access */
  recentColumns?: string[];
  /** Popular columns for suggestions */
  popularColumns?: string[];
  /** Whether to show filter performance */
  showPerformance?: boolean;
  /** Whether to animate filter changes */
  enableAnimations?: boolean;
  /** When set, open the add-filter flow for this column (e.g. from column header Filter click) */
  openFilterForColumnId?: string;
  /** Called after the panel has opened the filter for openFilterForColumnId */
  onOpenFilterConsumed?: () => void;
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
  const { t } = useTranslations();
  const locale = useLocale();
  const [isEditing, setIsEditing] = useState<boolean>(autoEdit);
  const [prevAutoEdit, setPrevAutoEdit] = useState(autoEdit);
  if (autoEdit && autoEdit !== prevAutoEdit) {
    setPrevAutoEdit(autoEdit);
    setIsEditing(true);
  }
  if (!autoEdit && prevAutoEdit) {
    setPrevAutoEdit(autoEdit);
  }
  const [stagedOperator, setStagedOperator] = useState<
    | "contains"
    | "equals"
    | "startsWith"
    | "endsWith"
    | "notContains"
    | "isEmpty"
    | "isNotEmpty"
    | "greaterThan"
    | "lessThan"
    | "greaterThanOrEqual"
    | "lessThanOrEqual"
    | "between"
    | "notEquals"
    | "before"
    | "after"
    | "is"
    | "isNot"
    | "isAnyOf"
    | "isNoneOf"
    | "containsAll"
    | "containsNone"
  >(filter.operator);
  const [stagedValues, setStagedValues] = useState<
    string | number | string[] | Date | [number, number] | [Date, Date]
  >(
    filter.values as
      | string
      | number
      | string[]
      | Date
      | [number, number]
      | [Date, Date]
  );

  const displayValue = useMemo(() => {
    return formatFilterValueForDisplay(
      filter.type,
      filter.operator,
      filter.values,
      config.options,
      {
        dateDisplayPreset: config.dateDisplayPreset,
        dateFormat: config.dateFormat,
        locale,
      }
    );
  }, [
    filter.type,
    filter.operator,
    filter.values,
    config.options,
    config.dateDisplayPreset,
    config.dateFormat,
    locale,
  ]);

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
        | "contains"
        | "equals"
        | "startsWith"
        | "endsWith"
        | "notContains"
        | "isEmpty"
        | "isNotEmpty"
        | "greaterThan"
        | "lessThan"
        | "greaterThanOrEqual"
        | "lessThanOrEqual"
        | "between"
        | "notEquals"
        | "before"
        | "after"
        | "is"
        | "isNot"
        | "isAnyOf"
        | "isNoneOf"
        | "containsAll"
        | "containsNone"
    );
  }, []);

  const columnLabel = config.label || filter.label || filter.columnId;

  const handleEdit = useCallback(() => {
    setIsEditing(true);
  }, []);

  const actionsBar = (
    <div className="flex shrink-0 items-center gap-0.5">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={translateWithFallback(
                t,
                "filters.advanced.filter_options",
                "Filter options"
              )}
              className="h-7 w-7 rounded-md p-0 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              disabled={disabled}
              size="icon"
              type="button"
              variant="ghost"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleEdit}>
            <Pencil className="mr-2 h-4 w-4" />
            {translateWithFallback(
              t,
              "filters.advanced.edit_filter",
              "Edit filter"
            )}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onToggle}>
            <Power className="mr-2 h-4 w-4" />
            {filter.isActive
              ? translateWithFallback(
                  t,
                  "filters.advanced.disable_filter",
                  "Disable filter"
                )
              : translateWithFallback(
                  t,
                  "filters.advanced.enable_filter",
                  "Enable filter"
                )}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {translateWithFallback(t, "filters.remove", "Remove filter")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        className="h-7 w-7 rounded-md p-0 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        disabled={disabled}
        onClick={onRemove}
        size="icon"
        type="button"
        variant="ghost"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );

  const operatorLabel = getTranslatedOperatorLabel(
    t,
    filter.operator,
    FILTER_OPERATORS_LABELS[filter.type]?.[filter.operator] ?? filter.operator
  );
  const valueLabel =
    displayValue || translateWithFallback(t, "filters.value", "Set value");

  return (
    <div className="w-full space-y-3">
      {/* Chip: left accent + field operator value + actions */}
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border border-border py-2 pr-2 pl-2 text-sm transition-colors",
          "bg-muted/20",
          filter.isActive && "border-l-4 border-l-primary bg-muted/30",
          !filter.isActive && "border-l-4 border-l-transparent opacity-80",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        <button
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md text-left transition-colors hover:bg-muted/40 disabled:hover:bg-transparent"
          disabled={disabled}
          onClick={() => setIsEditing(true)}
          type="button"
        >
          <span className="min-w-0 max-w-[7rem] truncate font-medium text-foreground sm:max-w-[10rem]">
            {columnLabel}
          </span>
          {isEditing ? (
            <span className="text-muted-foreground text-xs">
              {translateWithFallback(
                t,
                "filters.advanced.editing",
                "Editing..."
              )}
            </span>
          ) : (
            <>
              <span
                aria-hidden
                className="shrink-0 text-muted-foreground text-xs"
              >
                •
              </span>
              <span
                className="min-w-0 max-w-[5.5rem] truncate text-muted-foreground text-xs sm:max-w-[7rem]"
                title={operatorLabel}
              >
                {operatorLabel}
              </span>
              <span
                aria-hidden
                className="shrink-0 text-muted-foreground text-xs"
              >
                •
              </span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <span
                      className={cn(
                        "inline-block min-w-0 max-w-[8.5rem] truncate rounded-md px-2 py-0.5 text-xs sm:max-w-[10rem]",
                        displayValue
                          ? "bg-primary/10 font-medium text-foreground"
                          : "text-muted-foreground"
                      )}
                    >
                      {valueLabel}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs break-words">{valueLabel}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          )}
        </button>

        {actionsBar}
      </div>

      {isEditing && (
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <fieldset className="space-y-4 border-0 p-0">
            <legend className="sr-only">
              {translateWithFallback(
                t,
                "filters.advanced.edit_filter_for",
                "Edit filter for {column}",
                { column: columnLabel }
              )}
            </legend>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                onUpdate({
                  operator: stagedOperator,
                  values: stagedValues,
                });
                setIsEditing(false);
              }}
            >
              <Label
                className="font-medium text-muted-foreground text-xs uppercase tracking-wider"
                htmlFor={`filter-${filter.id}-value`}
              >
                {translateWithFallback(
                  t,
                  "filters.advanced.edit_filter_for",
                  "Edit filter for {column}",
                  { column: columnLabel }
                )}
              </Label>
              <FilterValueInput
                config={config}
                disabled={disabled}
                inline
                onOperatorChange={handleOperatorChange}
                onValueChange={handleValueChange}
                operator={stagedOperator}
                type={filter.type}
                value={stagedValues}
              />
              <div className="flex justify-end border-border border-t pt-3">
                <Button
                  className="rounded-lg"
                  size="sm"
                  type="submit"
                  variant="secondary"
                >
                  {translateWithFallback(t, "filters.advanced.done", "Done")}
                </Button>
              </div>
            </form>
          </fieldset>
        </div>
      )}
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
  variant = "modern",
  recentColumns: _recentColumns = EMPTY_COLUMNS,
  popularColumns: _popularColumns = EMPTY_COLUMNS,
  showPerformance: _showPerformance = false,
  enableAnimations = true,
  openFilterForColumnId,
  onOpenFilterConsumed,
}: AdvancedFilterPanelProps) {
  const [_editingFilterId, _setEditingFilterId] = useState<string | null>(null);
  const [draftFilters, setDraftFilters] = useState<AdvancedFilterModel[]>([]);
  // Always show the add-filter panel (GroupPicker-like UX)
  const _isAddPanelOpen = true;

  const activeFilters = filters.filter((f) => f.isActive);
  const _inactiveFilters = filters.filter((f) => !f.isActive);

  const combinedFilters = [...draftFilters, ...filters];
  const visibleFilters = combinedFilters.slice(0, maxVisibleFilters);
  const hiddenFiltersCount = Math.max(
    0,
    combinedFilters.length - maxVisibleFilters
  );

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
        type,
        operator as FilterOperators[ColumnDataType],
        value as FilterValues<ColumnDataType>,
        { isActive: false, label: config.label || columnId }
      );
      setDraftFilters((prev) => [draft, ...prev]);
    },
    [columnsConfig]
  );

  const handleUpdateFilter = useCallback(
    (filterId: string, updates: Partial<AdvancedFilterModel>) => {
      actions.updateFilter(filterId, updates);
    },
    [actions]
  );

  const openFilterConsumedRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      !(openFilterForColumnId && columnsConfig[openFilterForColumnId]) ||
      openFilterConsumedRef.current === openFilterForColumnId
    ) {
      return;
    }
    const config = columnsConfig[openFilterForColumnId];
    const operator = getDefaultFilterOperator(config.type);
    const value = getDefaultFilterValue(config.type, operator);
    const draft = createFilter(
      openFilterForColumnId,
      config.type,
      operator as FilterOperators[ColumnDataType],
      value as FilterValues<ColumnDataType>,
      { isActive: false, label: config.label || openFilterForColumnId }
    );
    setDraftFilters((prev) => [draft, ...prev]);
    openFilterConsumedRef.current = openFilterForColumnId;
    onOpenFilterConsumed?.();
  }, [openFilterForColumnId, columnsConfig, onOpenFilterConsumed]);

  useEffect(() => {
    if (!openFilterForColumnId) {
      openFilterConsumedRef.current = null;
    }
  }, [openFilterForColumnId]);

  // Show loading state
  if (isLoading) {
    return <FilterLoadingState className={className} count={3} />;
  }

  // Show error state
  if (error) {
    return (
      <div
        className={cn(
          "rounded-lg border border-destructive/20 bg-destructive/5 p-3",
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
      <div className={cn("space-y-3", className)}>
        {variant === "minimal" ? (
          <FilterEmptyState
            onAddFilter={() => {
              const firstColumn = Object.keys(columnsConfig)[0];
              if (firstColumn) {
                handleAddFilter(firstColumn, columnsConfig[firstColumn].type);
              }
            }}
            variant="minimal"
          />
        ) : (
          <InlineAddFilterPanel
            activeFiltersCount={0}
            columnsConfig={columnsConfig}
            disabled={disabled}
            onAddFilter={handleAddFilter}
          />
        )}
      </div>
    );
  }

  // Render filters based on variant
  const renderContent = () => {
    switch (variant) {
      case "minimal":
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

      case "compact":
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
          <div className="space-y-4">
            {/* Filter chips */}
            <div
              className={cn(
                "flex flex-wrap items-start gap-3",
                enableAnimations && "transition-all duration-200"
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
                      "min-w-0 flex-1 basis-full",
                      enableAnimations && "transition-all duration-150"
                    )}
                    key={filter.id}
                  >
                    {isDraft ? (
                      <FilterChip
                        autoEdit
                        config={config}
                        disabled={disabled}
                        filter={filter}
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
                            operator: updates.operator ?? filter.operator,
                            values: updates.values ?? filter.values,
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
            </div>

            {/* Add filter section – separate block for clearer hierarchy */}
            {showAddButton && (
              <div className="border-border border-t pt-4">
                <InlineAddFilterPanel
                  activeFiltersCount={activeFilters.length}
                  columnsConfig={columnsConfig}
                  disabled={disabled}
                  onAddFilter={handleAddFilter}
                  onReset={
                    showClearButton !== false ? actions.clearFilters : undefined
                  }
                />
              </div>
            )}
          </div>
        );
    }
  };

  return (
    <div
      className={cn(
        "w-full",
        variant === "modern" && "p-0",
        variant === "compact" && "rounded-md bg-muted/30 p-2",
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
  onReset,
  activeFiltersCount = 0,
  disabled = false,
}: {
  columnsConfig: ColumnsFilterConfig;
  onAddFilter: (columnId: string, type: ColumnDataType) => void;
  onReset?: () => void;
  activeFiltersCount?: number;
  disabled?: boolean;
}) {
  const { t } = useTranslations();
  const options = useMemo(
    () =>
      Object.entries(columnsConfig)
        .filter(([_, cfg]) => cfg.filterable !== false)
        .map(([id, cfg]) => ({ id, label: cfg.label || id, type: cfg.type })),
    [columnsConfig]
  );

  return (
    <div className="w-full space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
          {t("menu.select_column")}
        </span>
        <Button
          aria-label={translateWithFallback(
            t,
            "filters.advanced.reset_filters",
            "Reset filters"
          )}
          className="h-8 w-8 shrink-0 rounded-lg p-0"
          disabled={disabled || activeFiltersCount === 0 || !onReset}
          onClick={onReset}
          size="icon"
          type="button"
          variant="outline"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="rounded-lg bg-muted/20 p-1">
        <div className="space-y-0.5">
          {options.map((o) => {
            return (
              <Button
                className="group h-auto w-full justify-start gap-2.5 rounded-md py-2.5 pr-3 pl-2.5 text-left transition-colors hover:bg-muted/60"
                disabled={disabled}
                key={o.id}
                onClick={() => onAddFilter(o.id, o.type)}
                size="sm"
                type="button"
                variant="ghost"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted/60 text-muted-foreground transition-colors group-hover:bg-muted">
                  <ColumnIcon
                    className="h-3.5 w-3.5"
                    columnId={o.id}
                    columnType={o.type}
                  />
                </span>
                <span className="min-w-0 flex-1 truncate text-left font-medium text-foreground text-sm">
                  {o.label}
                </span>
                <Plus
                  aria-hidden
                  className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-70 transition-opacity group-hover:opacity-100"
                />
              </Button>
            );
          })}
        </div>
      </div>
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
  "filters" | "columnsConfig" | "actions" | "disabled"
>) {
  const { t } = useTranslations();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showInlineAdd, setShowInlineAdd] = useState(false);
  const activeFiltersCount = filters.filter((f) => f.isActive).length;

  if (filters.length === 0) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border border-muted border-dashed bg-muted/10 p-2">
        <div className="flex items-center gap-2">
          <Filter className="h-3 w-3 shrink-0 text-muted-foreground opacity-50" />
          <span className="text-muted-foreground text-xs">
            {t("filters.noFilters")}
          </span>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Button
                className="h-7 px-2 text-xs"
                disabled={disabled}
                onClick={() => setShowInlineAdd((v) => !v)}
                size="sm"
                variant="outline"
              >
                {translateWithFallback(t, "filters.add", "Add filter")}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {translateWithFallback(
                  t,
                  "filters.advanced.empty_description",
                  "Add filters to narrow down results."
                )}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {showInlineAdd && (
          <div className="mt-2">
            <InlineAddFilterPanel
              activeFiltersCount={0}
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
      <PopoverTrigger>
        <Button
          className="h-7 gap-1"
          disabled={disabled}
          size="sm"
          variant="outline"
        >
          <Filter className="h-3 w-3" />
          {activeFiltersCount > 0
            ? t("filters.active_count", { count: activeFiltersCount })
            : t("menu.filter")}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto min-w-96 max-w-screen-sm p-4"
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="font-medium">{t("filters.title")}</Label>
            {filters.length > 0 && (
              <Button
                className="h-6 text-xs"
                onClick={actions.clearFilters}
                size="sm"
                variant="ghost"
              >
                {t("filters.clear")}
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
            activeFiltersCount={filters.filter((f) => f.isActive).length}
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
            onReset={actions.clearFilters}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
