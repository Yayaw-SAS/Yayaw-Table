"use client";

import type { TableState } from "@tanstack/react-table";
import { useAtomValue, useSetAtom } from "jotai";
import {
  ArrowUpDown,
  Layers,
  List,
  ListFilter,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  StackMenu,
  StackMenuContent,
  StackMenuItem,
  StackMenuSection,
  StackMenuView,
  useStackMenu,
} from "@/ui/custom/stack-menu";
import { Button } from "@/ui/shadcn/button";
import {
  tableMenuOpenFilterColumnIdAtom,
  tableMenuOpenToViewAtom,
} from "../../atoms/table-atoms";
import { useTableUrlState } from "../../hooks/use-table-url-state";
import { useTranslations } from "../../providers/table-provider";
import type { ColumnDataType } from "../../types";
import type {
  AdvancedFiltersState,
  ColumnsFilterConfig,
  FilterActions,
} from "../../types/filter-types";
import { TableColumnsMenu } from "./sections/table-columns-menu";
import { TableFiltersMenu } from "./sections/table-filters-menu";
import { TableGroupingMenu } from "./sections/table-grouping-menu";
import { TableSortMenu } from "./sections/table-sort-menu";

const DEBUG = false;

export interface TableMenuProps {
  columns: TableColumn[];
  invalidateTable: () => Promise<void>;
  setColumnFilters: (state: TableState["columnFilters"]) => void;
  setColumnVisibility: (state: TableState["columnVisibility"]) => void;
  setGrouping: (state: TableState["grouping"]) => void;
  setSorting: (state: TableState["sorting"]) => void;
  state: TableState;
  tableId: string;
  /** Whether to use advanced filters menu */
  useAdvancedFilters?: boolean;
  /** Advanced filters configuration */
  advancedFiltersConfig?: {
    filters: AdvancedFiltersState;
    actions: FilterActions;
    columnsConfig: ColumnsFilterConfig;
    onConvertToAdvanced?: (columnId: string, type: ColumnDataType) => void;
  };
}

/**
 * Interface for table column definition
 */
interface TableColumn {
  canFilter?: boolean;
  canGroup?: boolean;
  canHide?: boolean;
  canSort?: boolean;
  id: string;
  label: string;
} // ordre déjà correct ici

// Add this adapter function before the TableMenu component
const adaptToTanstackColumns = (
  columns: TableColumn[]
): Array<{
  canHide?: boolean;
  canSort?: boolean;
  getCanSort: () => boolean;
  id: string;
  label: string;
}> => {
  return columns.map((col) => ({
    canHide: col.canHide,
    canSort: col.canSort,
    getCanSort: () => col.canSort !== false,
    id: col.id,
    label: col.label,
  }));
};

export function TableMenu({
  columns = [],
  invalidateTable,
  setColumnFilters,
  setColumnVisibility,
  setGrouping,
  setSorting,
  state,
  tableId,
  useAdvancedFilters = false,
  advancedFiltersConfig,
}: TableMenuProps) {
  const { t } = useTranslations();
  const stackMenuContext = useStackMenu();
  const { activeView: _activeView } = stackMenuContext;
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const openToView = useAtomValue(tableMenuOpenToViewAtom(tableId));
  const setOpenToView = useSetAtom(tableMenuOpenToViewAtom(tableId));
  const setOpenFilterColumnId = useSetAtom(
    tableMenuOpenFilterColumnIdAtom(tableId)
  );

  useEffect(() => {
    if (openToView) {
      setOpen(true);
    }
  }, [openToView]);
  const [_visibleCount, _setVisibleCount] = useState(0);

  // URL-state fallback to avoid stale grouping passed from parents
  const { groupingParam: urlGrouping, setGroupingFromUI } = useTableUrlState({
    tableId,
  });

  const finalGrouping = (
    state?.grouping?.length ? state.grouping : urlGrouping || []
  ) as string[];
  const finalSetGrouping = useCallback(
    (next: TableState["grouping"]) => {
      try {
        if (setGrouping) {
          setGrouping(next);
        } else {
          setGroupingFromUI(next as string[]);
        }
      } catch {
        // ignore
      }
    },
    [setGrouping, setGroupingFromUI]
  );

  if (DEBUG) {
    // Debug log for visible count
  }
  // Keep menu open when advanced filters change (selection inside add panel)
  useEffect(() => {
    if (useAdvancedFilters && open) {
      setOpen(true);
    }
  }, [useAdvancedFilters, open]);

  // Calculate visible columns count
  const hideableColumns = columns.filter((col) => col.canHide !== false);
  const visibleColumnsCount = hideableColumns.filter(
    (col) => state.columnVisibility[col.id] !== false
  ).length;

  // Track visible columns count for main menu display
  const [displayVisibleCount, setDisplayVisibleCount] =
    useState(visibleColumnsCount);

  const handleVisibleCountChange = useCallback((count: number) => {
    setDisplayVisibleCount(count);
  }, []);

  // Effect to log active view changes
  useEffect(() => {
    if (DEBUG) {
      // Debug log for active view changes
    }
  }, []);

  // Compute active filters count depending on filter mode (must be before early return for hooks order)
  const activeFiltersCount = useAdvancedFilters
    ? (advancedFiltersConfig?.filters || []).filter((f) => f.isActive).length
    : state.columnFilters.length;
  const activeGroupingCount = finalGrouping.length;
  const activeSortCount = state.sorting.length;

  const hasHiddenColumns =
    columns?.some((col) => state.columnVisibility?.[col.id] === false) ?? false;
  const hasAnythingToReset =
    activeFiltersCount > 0 ||
    activeSortCount > 0 ||
    activeGroupingCount > 0 ||
    hasHiddenColumns;

  const handleResetAll = useCallback(() => {
    setColumnFilters([]);
    if (useAdvancedFilters && advancedFiltersConfig?.actions?.clearFilters) {
      advancedFiltersConfig.actions.clearFilters();
    }
    setSorting([]);
    finalSetGrouping([]);
    setColumnVisibility({});
  }, [
    setColumnFilters,
    useAdvancedFilters,
    advancedFiltersConfig?.actions,
    setSorting,
    finalSetGrouping,
    setColumnVisibility,
  ]);

  // Navigation titles for different views
  const getNavigationTitle = (viewName: string) => {
    switch (viewName) {
      case "columns":
        return t("menu.properties");
      case "filters":
        return t("menu.filters");
      case "group":
        return t("menu.group");
      case "sort":
        return t("menu.sort");
      default:
        return t("menu.options");
    }
  };

  const resetAllButton = (
    <Button
      aria-label={t("menu.reset_all")}
      className="h-8 w-8 shrink-0 p-0 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
      disabled={!hasAnythingToReset}
      onClick={handleResetAll}
      size="sm"
      title={t("menu.reset_all_description")}
      type="button"
      variant="ghost"
    >
      <RotateCcw className="h-4 w-4" />
    </Button>
  );

  // Early return if no columns (after all hooks)
  if (!columns || columns.length === 0) {
    return (
      <Button
        className="ml-auto h-8 gap-1"
        disabled
        size="sm"
        type="button"
        variant="outline"
      >
        <List className="h-3.5 w-3.5" />
        <span>{t("menu.options")}</span>
      </Button>
    );
  }

  return (
    <StackMenu
      asDropdown
      defaultView="main"
      headerEndContent={resetAllButton}
      onOpenChange={(isOpen) => {
        if (DEBUG) {
          // Debug log for open change
        }
        setOpen(isOpen);
        if (!isOpen) {
          setOpenToView(null);
          setOpenFilterColumnId(null);
        }
      }}
      open={open}
      openToView={openToView ?? undefined}
      ref={menuRef}
      trigger={
        <Button
          className="h-8 gap-2 px-3"
          size="sm"
          type="button"
          variant="outline"
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span>{t("menu.options")}</span>
          {(activeFiltersCount > 0 || activeSortCount > 0) && (
            <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
              {activeFiltersCount + activeSortCount}
            </span>
          )}
        </Button>
      }
    >
      <StackMenuView name="main">
        <StackMenuContent>
          <StackMenuSection>
            <StackMenuItem
              description={t("menu.columns_visible", {
                count: displayVisibleCount,
              })}
              endIcon={
                displayVisibleCount > 0 ? (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                    {displayVisibleCount}
                  </span>
                ) : undefined
              }
              icon={<List className="h-4 w-4" />}
              navigateTitle={getNavigationTitle("columns")}
              navigateTo="columns"
            >
              {t("menu.properties")}
            </StackMenuItem>

            <StackMenuItem
              description={
                activeFiltersCount > 0
                  ? t("filters.active_count", { count: activeFiltersCount })
                  : undefined
              }
              endIcon={
                activeFiltersCount > 0 ? (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                    {activeFiltersCount}
                  </span>
                ) : undefined
              }
              icon={<ListFilter className="h-4 w-4" />}
              navigateTitle={getNavigationTitle("filters")}
              navigateTo="filters"
            >
              {t("menu.filter")}
            </StackMenuItem>

            <StackMenuItem
              description={
                activeSortCount > 0
                  ? t("filters.active_count", { count: activeSortCount })
                  : undefined
              }
              endIcon={
                activeSortCount > 0 ? (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                    {activeSortCount}
                  </span>
                ) : undefined
              }
              icon={<ArrowUpDown className="h-4 w-4" />}
              navigateTitle={getNavigationTitle("sort")}
              navigateTo="sort"
            >
              {t("menu.sort")}
            </StackMenuItem>

            <StackMenuItem
              description={
                activeGroupingCount > 0
                  ? t("menu.active_groups", { count: activeGroupingCount })
                  : undefined
              }
              endIcon={
                activeGroupingCount > 0 ? (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                    {activeGroupingCount}
                  </span>
                ) : undefined
              }
              icon={<Layers className="h-4 w-4" />}
              navigateTitle={getNavigationTitle("group")}
              navigateTo="group"
            >
              {t("menu.group")}
            </StackMenuItem>
          </StackMenuSection>
        </StackMenuContent>
      </StackMenuView>

      <StackMenuView name="columns">
        <TableColumnsMenu
          columns={adaptToTanstackColumns(columns)}
          columnVisibility={state.columnVisibility}
          onVisibleCountChange={(count) => {
            if (DEBUG) {
              // Debug log for visible count change
            }
            handleVisibleCountChange(count);
          }}
          setColumnVisibility={(value) => {
            if (DEBUG) {
              // Debug log for column visibility change
            }
            try {
              const newVisibility = { ...value };
              setColumnVisibility(newVisibility);
            } catch (_error) {
              // Ignore column visibility errors
            }
          }}
          tableId={tableId}
        />
      </StackMenuView>

      <StackMenuView name="filters">
        <TableFiltersMenu
          advancedActions={
            useAdvancedFilters ? advancedFiltersConfig?.actions : undefined
          }
          advancedColumnsConfig={
            useAdvancedFilters
              ? advancedFiltersConfig?.columnsConfig
              : undefined
          }
          advancedFilters={
            useAdvancedFilters ? advancedFiltersConfig?.filters : undefined
          }
          columnFilters={state.columnFilters}
          columns={columns}
          invalidateTable={invalidateTable}
          setColumnFilters={setColumnFilters}
          tableId={tableId}
          useAdvancedFilters={useAdvancedFilters}
        />
      </StackMenuView>

      <StackMenuView name="sort">
        <TableSortMenu
          columns={adaptToTanstackColumns(columns)}
          invalidateTable={invalidateTable}
          setSorting={setSorting}
          sorting={state.sorting}
          tableId={tableId}
        />
      </StackMenuView>

      <StackMenuView name="group">
        <TableGroupingMenu
          columns={columns}
          grouping={finalGrouping}
          invalidateTable={invalidateTable}
          setGrouping={finalSetGrouping}
          tableId={tableId}
        />
      </StackMenuView>

      {/* Subgroup view removed - grouping handled directly in group view */}
    </StackMenu>
  );
}
