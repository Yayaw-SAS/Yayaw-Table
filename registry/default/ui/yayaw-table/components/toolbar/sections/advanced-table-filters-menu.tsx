/**
 * Advanced table filters menu
 * Modern replacement for TableFiltersMenu using advanced filtering system
 */
"use client";

import type { ColumnFiltersState } from "@tanstack/react-table";
import { Filter, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { StackMenuContent, StackMenuView } from "../../../ui-custom/stack-menu";
import { useTranslations } from "../../../providers/table-provider";
import type {
  AdvancedFiltersState,
  ColumnDataType,
  ColumnsFilterConfig,
  FilterActions,
} from "../../../types/filter-types";
import { CompactFilterPanel } from "../../filters/advanced-filter-panel";
import { translateWithFallback } from "../../filters/i18n-utils";

export interface AdvancedTableFiltersMenuProps {
  /** Legacy column filters for backward compatibility */
  columnFilters: ColumnFiltersState;
  /** Available columns */
  columns: {
    canFilter?: boolean;
    canGroup?: boolean;
    canHide?: boolean;
    canSort?: boolean;
    id: string;
    label: string;
  }[];
  /** Advanced filters state */
  advancedFilters?: AdvancedFiltersState;
  /** Advanced filters actions */
  advancedActions?: FilterActions;
  /** Advanced columns configuration */
  advancedColumnsConfig?: ColumnsFilterConfig;
  /** Whether to use advanced filtering mode */
  useAdvancedFilters?: boolean;
  /** Callback to convert legacy filter to advanced */
  onConvertToAdvanced?: (columnId: string, type: ColumnDataType) => void;
  /** Legacy setColumnFilters for backward compatibility */
  setColumnFilters: (state: ColumnFiltersState) => void;
  /** Table invalidation function */
  invalidateTable: () => Promise<void>;
  /** Table identifier */
  tableId: string;
}

/**
 * Legacy filter item component for backward compatibility
 */
function LegacyFilterItem({
  column,
  isActive,
  onToggle,
  onConvertToAdvanced,
}: {
  column: { id: string; label: string };
  isActive: boolean;
  onToggle: () => void;
  onConvertToAdvanced?: (columnId: string, type: ColumnDataType) => void;
}) {
  const { t } = useTranslations();
  const [showConvertOptions, setShowConvertOptions] = useState(false);

  const handleConvert = useCallback(
    (type: ColumnDataType) => {
      onConvertToAdvanced?.(column.id, type);
      setShowConvertOptions(false);
    },
    [column.id, onConvertToAdvanced]
  );

  return (
    <div className="flex items-center justify-between rounded-lg p-2 hover:bg-accent">
      <div className="flex items-center gap-3">
        <Button
          className="flex h-4 w-4 items-center justify-center rounded-sm border border-current p-0"
          onClick={onToggle}
          size="icon"
          type="button"
          variant="ghost"
        >
          {isActive && <div className="h-2 w-2 rounded-sm bg-current" />}
        </Button>
        <Filter className="h-4 w-4 text-muted-foreground" />
        <span>{column.label}</span>
      </div>

      {onConvertToAdvanced && (
        <div className="flex items-center gap-2">
          {showConvertOptions ? (
            <div className="flex gap-1">
              <Button
                className="h-6 px-2 text-xs"
                onClick={() => handleConvert("text")}
                size="sm"
                variant="outline"
              >
                {translateWithFallback(t, "filters.types.text", "Text")}
              </Button>
              <Button
                className="h-6 px-2 text-xs"
                onClick={() => handleConvert("number")}
                size="sm"
                variant="outline"
              >
                {translateWithFallback(t, "filters.types.number", "Number")}
              </Button>
              <Button
                className="h-6 px-2 text-xs"
                onClick={() => handleConvert("date")}
                size="sm"
                variant="outline"
              >
                {translateWithFallback(t, "filters.types.date", "Date")}
              </Button>
              <Button
                className="h-6 px-2 text-xs"
                onClick={() => handleConvert("select")}
                size="sm"
                variant="outline"
              >
                {translateWithFallback(t, "filters.types.select", "Select")}
              </Button>
              <Button
                className="h-6 px-2 text-xs"
                onClick={() => setShowConvertOptions(false)}
                size="sm"
                variant="ghost"
              >
                {t("actions.cancel")}
              </Button>
            </div>
          ) : (
            <Button
              className="h-6 px-2 text-primary text-xs"
              onClick={() => setShowConvertOptions(true)}
              size="sm"
              variant="ghost"
            >
              {translateWithFallback(
                t,
                "filters.advanced.convert_to_advanced",
                "Upgrade"
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Advanced table filters menu component
 */
export function AdvancedTableFiltersMenu({
  columnFilters,
  columns,
  advancedFilters = [],
  advancedActions,
  advancedColumnsConfig = {},
  useAdvancedFilters = false,
  onConvertToAdvanced,
  setColumnFilters,
  invalidateTable: _invalidateTable,
  tableId: _tableId,
}: AdvancedTableFiltersMenuProps) {
  const { t } = useTranslations();

  // Get filterable columns
  const filterableColumns = useMemo(
    () => columns.filter((col) => col.canFilter !== false),
    [columns]
  );

  // Calculate legacy and advanced filter stats
  const legacyFiltersCount = columnFilters.length;
  const advancedFiltersCount = advancedFilters.filter((f) => f.isActive).length;
  const totalFiltersCount = legacyFiltersCount + advancedFiltersCount;

  // Handle legacy filter toggle
  const handleLegacyToggle = useCallback(
    (columnId: string) => {
      const existingFilter = columnFilters.find((f) => f.id === columnId);
      if (existingFilter) {
        setColumnFilters(columnFilters.filter((f) => f.id !== columnId));
      } else {
        setColumnFilters([...columnFilters, { id: columnId, value: "" }]);
      }
    },
    [columnFilters, setColumnFilters]
  );

  // Handle clear all filters
  const handleClearAll = useCallback(() => {
    setColumnFilters([]);
    advancedActions?.clearFilters();
  }, [setColumnFilters, advancedActions]);

  // Skip rendering if no filterable columns
  if (filterableColumns.length === 0) {
    return null;
  }

  return (
    <StackMenuView name="filters">
      <StackMenuContent>
        <ScrollArea className="max-h-96">
          <div className="space-y-4">
            {/* Advanced Filters Section */}
            {useAdvancedFilters &&
              advancedActions &&
              Object.keys(advancedColumnsConfig).length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-foreground text-sm">
                      {translateWithFallback(
                        t,
                        "filters.advanced.title",
                        "Advanced filters"
                      )}
                    </h4>
                    {advancedFiltersCount > 0 && (
                      <Badge className="text-xs" variant="default">
                        {t("filters.active_count", {
                          count: advancedFiltersCount,
                        })}
                      </Badge>
                    )}
                  </div>

                  <CompactFilterPanel
                    actions={advancedActions}
                    columnsConfig={advancedColumnsConfig}
                    filters={advancedFilters}
                  />

                  {(legacyFiltersCount > 0 || filterableColumns.length > 0) && (
                    <Separator className="my-3" />
                  )}
                </div>
              )}

            {/* Legacy Filters Section */}
            {filterableColumns.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-foreground text-sm">
                    {useAdvancedFilters
                      ? translateWithFallback(
                          t,
                          "filters.advanced.basic_title",
                          "Basic filters"
                        )
                      : t("filters.title")}
                  </h4>
                  {legacyFiltersCount > 0 && (
                    <Badge className="text-xs" variant="secondary">
                      {t("filters.active_count", { count: legacyFiltersCount })}
                    </Badge>
                  )}
                </div>

                <div className="space-y-2">
                  {filterableColumns.map((column) => {
                    const isActive = columnFilters.some(
                      (f) => f.id === column.id
                    );

                    return (
                      <LegacyFilterItem
                        column={column}
                        isActive={isActive}
                        key={column.id}
                        onConvertToAdvanced={
                          useAdvancedFilters && onConvertToAdvanced
                            ? onConvertToAdvanced
                            : undefined
                        }
                        onToggle={() => handleLegacyToggle(column.id)}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Clear All Section */}
            {totalFiltersCount > 0 && (
              <>
                <Separator className="my-3" />
                <Button
                  className="w-full justify-start"
                  onClick={handleClearAll}
                  variant="ghost"
                >
                  <X className="mr-2 h-4 w-4" />
                  {t("filters.clear")} ({totalFiltersCount})
                </Button>
              </>
            )}

            {/* No Filters State */}
            {totalFiltersCount === 0 && (
              <div className="py-6 text-center text-muted-foreground">
                <Filter className="mx-auto mb-2 h-8 w-8 opacity-50" />
                <p className="text-sm">{t("filters.noFilters")}</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </StackMenuContent>
    </StackMenuView>
  );
}

/**
 * Simple wrapper for backward compatibility with existing TableFiltersMenu
 */
export function TableFiltersMenuAdvanced(
  props: Omit<
    AdvancedTableFiltersMenuProps,
    | "advancedFilters"
    | "advancedActions"
    | "advancedColumnsConfig"
    | "useAdvancedFilters"
    | "onConvertToAdvanced"
  >
) {
  return <AdvancedTableFiltersMenu {...props} useAdvancedFilters={false} />;
}
