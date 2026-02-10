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
import { Button } from "@/components/ui/button";
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
import {
  StackMenu,
  StackMenuContent,
  StackMenuItem,
  StackMenuSection,
  StackMenuView,
} from "../../ui-custom/stack-menu";
import { TableColumnsMenu } from "./sections/table-columns-menu";
import { TableFiltersMenu } from "./sections/table-filters-menu";
import { TableGroupingMenu } from "./sections/table-grouping-menu";
import { TableSortMenu } from "./sections/table-sort-menu";

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

const NAVIGATION_TITLE_KEYS = {
  columns: "menu.properties",
  filters: "menu.filters",
  group: "menu.group",
  sort: "menu.sort",
} as const;

type NavigationViewName = keyof typeof NAVIGATION_TITLE_KEYS;

const getNavigationTitle = (
  viewName: string,
  t: ReturnType<typeof useTranslations>["t"]
) => {
  const titleKey = NAVIGATION_TITLE_KEYS[viewName as NavigationViewName];
  return titleKey ? t(titleKey) : t("menu.options");
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

  // URL-state fallback to avoid stale grouping passed from parents
  const { groupingParam: urlGrouping, setGroupingFromUI } = useTableUrlState({
    tableId,
  });

  const finalGrouping = (
    state?.grouping?.length ? state.grouping : urlGrouping || []
  ) as string[];
  const finalSetGrouping = useCallback(
    (next: TableState["grouping"]) => {
      setGrouping(next);
      setGroupingFromUI(next as string[]);
    },
    [setGrouping, setGroupingFromUI]
  );

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

  // Compute active filters count depending on filter mode (must be before early return for hooks order)
  const activeFiltersCount = useAdvancedFilters
    ? (advancedFiltersConfig?.filters || []).filter((f) => f.isActive).length
    : state.columnFilters.length;
  const activeGroupingCount = finalGrouping.length;
  const activeSortCount = state.sorting.length;
  const hasMenuBadgeCount = activeFiltersCount > 0 || activeSortCount > 0;

  const hasHiddenColumns = columns.some(
    (col) => state.columnVisibility[col.id] === false
  );
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
  if (columns.length === 0) {
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
          {hasMenuBadgeCount && (
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
              navigateTitle={getNavigationTitle("columns", t)}
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
              navigateTitle={getNavigationTitle("filters", t)}
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
              navigateTitle={getNavigationTitle("sort", t)}
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
              navigateTitle={getNavigationTitle("group", t)}
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
          onVisibleCountChange={handleVisibleCountChange}
          setColumnVisibility={(value) => {
            setColumnVisibility({ ...value });
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
