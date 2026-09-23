"use client";

import type { SortingState } from "@/components/ui/yayaw-table/tanstack";
import {
  ArrowDownAZ,
  ArrowUpAZ,
  ArrowUpDown,
  GripVertical,
  Plus,
} from "lucide-react";
import { Button } from "@/src/components/ui/button";
import {
  StackMenuContent,
  StackMenuItem,
  StackMenuView,
  useStackMenu,
} from "@/components/ui/custom/stack-menu";
import { useDataTable } from "../../../hooks/use-data-table";
import {
  useTableActions,
  useTranslations,
} from "../../../providers/table-provider";
import {
  isManualOrder,
  MANUAL_ORDER_SORT_ID,
  manualOrderSorting,
} from "../../../utils/manual-order";
import { translateWithFallback } from "../../filters/i18n-utils";

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

/**
 * Clicking a column adds it as the lowest-priority sort, then switches it to
 * descending, then removes it; the other sorts keep their order.
 */
export function cycleColumnSort(
  sorting: SortingState,
  columnId: string
): SortingState {
  const current = sorting.find((sort) => sort.id === columnId);
  if (!current) {
    // A view's manual order cannot be combined with column sorts.
    const columnSorts = sorting.filter(
      (sort) => sort.id !== MANUAL_ORDER_SORT_ID
    );
    return [...columnSorts, { desc: false, id: columnId }];
  }
  if (current.desc) {
    return sorting.filter((sort) => sort.id !== columnId);
  }
  return sorting.map((sort) =>
    sort.id === columnId ? { ...sort, desc: true } : sort
  );
}

function sortIcon(desc: boolean | undefined) {
  if (desc === undefined) {
    return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />;
  }
  return desc ? (
    <ArrowDownAZ className="h-3.5 w-3.5 text-foreground" />
  ) : (
    <ArrowUpAZ className="h-3.5 w-3.5 text-foreground" />
  );
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
  const getTableActions = useTableActions();
  const canSortManually =
    config?.table?.manualOrder === true &&
    typeof getTableActions?.(tableType || tableId)?.reorder === "function";
  const manualActive = isManualOrder(sorting);

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

  const columnLabel = (column: { id: string; label: string }): string => {
    if (column.id === "actions") {
      return t("actions.title");
    }
    const header = config?.columns?.definitions?.find(
      (definition: { id: string; header?: string }) =>
        definition.id === column.id
    )?.header;
    return header ? t(header) : column.label || column.id;
  };
  // Active sorts first, in priority order, then the remaining sortable columns.
  const orderedColumns = [
    ...sorting.flatMap((sort) =>
      sortableColumns.filter((column) => column.id === sort.id)
    ),
    ...sortableColumns.filter(
      (column) => !sorting.some((sort) => sort.id === column.id)
    ),
  ];

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

        {canSortManually && (
          <StackMenuItem
            className={`h-7 gap-2 px-2 text-sm ${manualActive ? "bg-accent font-medium" : ""}`}
            icon={
              <GripVertical
                className={`h-3.5 w-3.5 ${manualActive ? "text-foreground" : "text-muted-foreground"}`}
              />
            }
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setSorting(manualActive ? [] : manualOrderSorting());
              stackMenu.onOpenChange?.(true);
            }}
          >
            <span>
              {translateWithFallback(t, "sorting.manual", "Manual order")}
            </span>
          </StackMenuItem>
        )}
        {orderedColumns.map((column) => {
          const priority = sorting.findIndex((sort) => sort.id === column.id);
          const sortOrder = sorting[priority]?.desc;
          const isActiveSorted = sortOrder !== undefined;
          return (
            <StackMenuItem
              className={`h-7 gap-2 px-2 text-sm ${isActiveSorted ? "bg-accent font-medium" : ""}`}
              endIcon={
                isActiveSorted ? (
                  sorting.length > 1 && (
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {priority + 1}
                    </span>
                  )
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )
              }
              icon={sortIcon(sortOrder)}
              key={column.id}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setSorting(cycleColumnSort(sorting, column.id));
                // Keep menu open after updating sorting
                stackMenu.onOpenChange?.(true);
              }}
            >
              <span className={isActiveSorted ? "font-medium" : ""}>
                {columnLabel(column)}
              </span>
            </StackMenuItem>
          );
        })}
      </StackMenuContent>
    </StackMenuView>
  );
}
