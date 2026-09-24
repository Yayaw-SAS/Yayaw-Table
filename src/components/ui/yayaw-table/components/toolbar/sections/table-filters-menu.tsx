"use client";

import type { ColumnFiltersState } from "@/components/ui/yayaw-table/tanstack";
import { useAtomValue, useSetAtom } from "jotai";
import { Filter, X } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/src/components/ui/button";
import { Separator } from "@/src/components/ui/separator";
import {
  StackMenuContent,
  StackMenuView,
} from "@/components/ui/custom/stack-menu";
import { tableMenuOpenFilterColumnIdAtom } from "../../../atoms/table-atoms";
import { useTranslations } from "../../../providers/table-provider";
import type {
  AdvancedFiltersState,
  ColumnsFilterConfig,
  FilterActions,
} from "../../../types/filter-types";
import { useTableConfig } from "../../../hooks/use-table-config";
import { filterBarColumns } from "../../../utils/filter-bar";
import { fieldText } from "../../../utils/table-contracts";
import { TableFilterBar } from "../../filters/table-filter-bar";
import { AdvancedFilterPanel } from "../../filters/advanced-filter-panel";

// Debug flag - activated for debugging advanced filters
const DEBUG = false;

const EMPTY_FILTERS: never[] = [];
const EMPTY_COLUMNS_CONFIG: Record<string, never> = {};

export interface TableFiltersMenuProps {
  columnFilters: ColumnFiltersState;
  columns: {
    canFilter?: boolean;
    canGroup?: boolean;
    canHide?: boolean;
    canSort?: boolean;
    id: string;
    label: string;
  }[];
  invalidateTable: () => Promise<void>;
  setColumnFilters: (state: ColumnFiltersState) => void;
  tableId: string;
  tableType?: string;
  // Props pour filtres avancés (optionnels)
  advancedFilters?: AdvancedFiltersState;
  advancedActions?: FilterActions;
  advancedColumnsConfig?: ColumnsFilterConfig;
  useAdvancedFilters?: boolean;
}

export function TableFiltersMenu({
  columnFilters,
  columns: _columns,
  invalidateTable: _invalidateTable,
  setColumnFilters,
  tableId,
  tableType,
  advancedFilters = EMPTY_FILTERS,
  advancedActions,
  advancedColumnsConfig = EMPTY_COLUMNS_CONFIG,
  useAdvancedFilters = false,
}: TableFiltersMenuProps) {
  const { t, locale } = useTranslations();
  const { config } = useTableConfig(tableType ?? tableId);
  // Active filters read like the column: its header, option labels and formats.
  const columnOf = (id: string) =>
    config.columns.definitions.find((column) => column.id === id);
  const quickColumns = filterBarColumns(
    config.columns.definitions,
    config.table.filterBarColumns
  );
  const openFilterForColumnId = useAtomValue(
    tableMenuOpenFilterColumnIdAtom(tableId)
  );
  const setOpenFilterColumnId = useSetAtom(
    tableMenuOpenFilterColumnIdAtom(tableId)
  );

  const customFilters = (config.columns.definitions.filter(column => column.enableFiltering !== false && column.filterRenderer).map(column => <div key={column.id}>{column.filterRenderer?.({ value: columnFilters.find(filter => filter.id === column.id)?.value, onChange: value => { const rest = columnFilters.filter(filter => filter.id !== column.id); setColumnFilters(value === undefined || value === "" || (Array.isArray(value) && !value.length) ? rest : [...rest, { id: column.id, value }]); } })}</div>) );

  // Debug logs
  useEffect(() => {
    if (DEBUG) {
      // DEBUG: Filters menu effect triggered
    }
  }, []);

  // Use advanced filters if enabled and we have the proper setup
  const hasAdvancedConfig =
    advancedColumnsConfig && Object.keys(advancedColumnsConfig).length > 0;
  if (useAdvancedFilters && advancedActions && hasAdvancedConfig) {
    return (
      <StackMenuView name="filters">
        <StackMenuContent>
          {customFilters}
          <AdvancedFilterPanel
            actions={advancedActions}
            className="border-0"
            columnsConfig={advancedColumnsConfig}
            enableAnimations={true}
            filters={advancedFilters}
            maxVisibleFilters={Number.POSITIVE_INFINITY}
            onOpenFilterConsumed={() => setOpenFilterColumnId(null)}
            openFilterForColumnId={openFilterForColumnId ?? undefined}
            popularColumns={["name", "status", "category"]}
            recentColumns={[]}
            showAddButton={true}
            showClearButton={false}
            showPerformance={false}
            variant="modern"
          />
        </StackMenuContent>
      </StackMenuView>
    );
  }

  // Fallback to legacy filter interface
  return (
    <StackMenuView name="filters">
      <StackMenuContent>
        <div className="space-y-4">
          {customFilters}
          <TableFilterBar tableId={tableId} tableType={tableType ?? tableId} />
          {!quickColumns.length && !customFilters.length && (
            <div className="py-8 text-center text-muted-foreground">
              <Filter className="mx-auto mb-2 h-8 w-8 opacity-50" />
              <p className="text-sm">{t("filters.noFilters")}</p>
              <p className="text-xs">{t("filters.noResults")}</p>
            </div>
          )}

          {/* Show legacy column filters if any exist */}
          {columnFilters.length > 0 && (
            <div className="space-y-2">
              <Separator />
              <h4 className="font-medium text-sm">{t("filters.title")}</h4>
              {columnFilters.map((filter) => (
                <div
                  className="flex items-center gap-2 rounded-md border p-2"
                  key={filter.id}
                >
                  <span className="font-medium text-sm">
                    {columnOf(filter.id)?.header ?? filter.id}
                  </span>
                  <span className="text-muted-foreground text-xs">:</span>
                  <span className="text-sm">
                    {fieldText(filter.value, columnOf(filter.id), locale) ||
                      String(filter.value)}
                  </span>
                  <Button
                    className="ml-auto h-6 w-6 p-0"
                    onClick={() => {
                      const newFilters = columnFilters.filter(
                        (f) => f.id !== filter.id
                      );
                      setColumnFilters(newFilters);
                    }}
                    size="sm"
                    variant="ghost"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </StackMenuContent>
    </StackMenuView>
  );
}
