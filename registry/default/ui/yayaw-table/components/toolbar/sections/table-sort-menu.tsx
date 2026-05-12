"use client";

import type { SortingState } from "@tanstack/react-table";
import { ArrowDownAZ, ArrowUpAZ, ArrowUpDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDataTable } from "../../../hooks/use-data-table";
import { useTranslations } from "../../../providers/table-provider";
import {
  StackMenuContent,
  StackMenuItem,
  StackMenuView,
  useStackMenu,
} from "../../../ui-custom/stack-menu";

export interface TableSortMenuProps {
  columns: Array<{
    canSort?: boolean;
    getCanSort: () => boolean;
    id: string;
    label: string;
  }>;
  invalidateTable: () => Promise<void>;
  setSorting: (state: SortingState) => void;
  sorting: SortingState;
  tableId: string;
  tableType?: string;
}

export function TableSortMenu({
  columns,
  invalidateTable: _invalidateTable,
  setSorting,
  sorting,
  tableId,
  tableType,
}: TableSortMenuProps) {
  const { t } = useTranslations();
  const stackMenu = useStackMenu();

  // Get table configuration to access column headers with translations
  const { config } = useDataTable({
    tableId,
    tableType: tableType || tableId,
  });

  // Get sortable columns
  const sortableColumns = columns.filter((col) => {
    const canSort =
      typeof col.getCanSort === "function"
        ? col.getCanSort()
        : col.canSort !== false;
    return canSort;
  });

  // Skip rendering if no sortable columns
  if (sortableColumns.length === 0) {
    return null;
  }

  // Split into active and inactive to show active first
  const activeSortIds = new Set((sorting || []).map((s) => s.id));
  const activeColumns = sortableColumns.filter((c) => activeSortIds.has(c.id));
  const inactiveColumns = sortableColumns.filter(
    (c) => !activeSortIds.has(c.id)
  );

  return (
    <StackMenuView name="sort">
      <StackMenuContent>
        <div className="mb-2 flex items-center justify-between">
          <div className="px-2 font-medium text-foreground text-sm">
            {sorting.length > 0
              ? t("sorting.current")
              : t("sorting.choose_column")}
          </div>
          <Button
            disabled={sorting.length === 0}
            onClick={() => setSorting([])}
            size="sm"
            variant="outline"
          >
            {t("common.reset")}
          </Button>
        </div>

        {/* Active sorts */}
        {activeColumns.map((column) => {
          const columnId = column.id;
          const sortOrder = sorting.find((sort) => sort.id === columnId)?.desc;
          const isActiveSorted = sortOrder !== undefined;

          // Get column configuration from table config to get proper translated header
          const columnConfig = config?.columns?.definitions?.find(
            (def: { id: string; header?: string }) => def.id === columnId
          );

          // Use translated header from config, with fallbacks
          let columnLabel: string;
          if (columnId === "actions") {
            columnLabel = t("actions.title");
          } else if (columnConfig?.header) {
            // Try to translate the header from config
            columnLabel = t(columnConfig.header);
          } else {
            // Fallback to the label from the column or columnId
            columnLabel = column.label || columnId;
          }

          return (
            <StackMenuItem
              className={`h-7 gap-2 px-2 text-sm ${isActiveSorted ? "bg-accent font-medium" : ""}`}
              endIcon={
                isActiveSorted ? undefined : <Plus className="h-3.5 w-3.5" />
              }
              icon={(() => {
                if (sortOrder === undefined) {
                  return (
                    <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                  );
                }
                if (sortOrder) {
                  return (
                    <ArrowDownAZ className="h-3.5 w-3.5 text-foreground" />
                  );
                }
                return <ArrowUpAZ className="h-3.5 w-3.5 text-foreground" />;
              })()}
              key={columnId}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (sortOrder === undefined) {
                  // First click: ascending
                  setSorting([{ desc: false, id: columnId }]);
                } else if (sortOrder) {
                  // Third click: remove sort
                  setSorting([]);
                } else {
                  // Second click: descending
                  setSorting([{ desc: true, id: columnId }]);
                }
                // Keep menu open after updating sorting
                stackMenu.onOpenChange?.(true);
              }}
            >
              <span className={isActiveSorted ? "font-medium" : ""}>
                {columnLabel}
              </span>
            </StackMenuItem>
          );
        })}

        {/* Inactive sorts */}
        {inactiveColumns.map((column) => {
          const columnId = column.id;
          const sortOrder = sorting.find((sort) => sort.id === columnId)?.desc;
          const isActiveSorted = sortOrder !== undefined;

          const columnConfig = config?.columns?.definitions?.find(
            (def: { id: string; header?: string }) => def.id === columnId
          );

          let columnLabel: string;
          if (columnId === "actions") {
            columnLabel = t("actions.title");
          } else if (columnConfig?.header) {
            columnLabel = t(columnConfig.header);
          } else {
            columnLabel = column.label || columnId;
          }

          return (
            <StackMenuItem
              className={`h-7 gap-2 px-2 text-sm ${isActiveSorted ? "bg-accent font-medium" : ""}`}
              endIcon={<Plus className="h-3.5 w-3.5" />}
              icon={
                <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
              }
              key={columnId}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setSorting([{ desc: false, id: columnId }]);
                stackMenu.onOpenChange?.(true);
              }}
            >
              <span>{columnLabel}</span>
            </StackMenuItem>
          );
        })}
      </StackMenuContent>
    </StackMenuView>
  );
}
