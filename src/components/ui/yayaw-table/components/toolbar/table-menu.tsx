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
import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/src/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/src/components/ui/tooltip";
import {
  StackMenu,
  StackMenuContent,
  StackMenuItem,
  StackMenuSection,
  StackMenuView,
} from "@/components/ui/custom/stack-menu";
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

export interface TableMenuProps {
  actionsAsIcons?: boolean;
  columns: TableColumn[];
  enableColumnFilters?: boolean;
  enableGrouping?: boolean;
  enableSorting?: boolean;
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

interface MenuSectionState {
  canShowColumnsSection: boolean;
  canShowFiltersSection: boolean;
  canShowGroupSection: boolean;
  canShowSortSection: boolean;
  effectiveActiveFiltersCount: number;
  effectiveActiveSortCount: number;
  hasAnyMenuSection: boolean;
  hasAnythingToReset: boolean;
  menuBadgeCount: number;
}

const buildMenuSectionState = ({
  activeFiltersCount,
  activeGroupingCount,
  activeSortCount,
  enableColumnFilters,
  enableGrouping,
  enableSorting,
  filterableColumnsCount,
  groupableColumnsCount,
  hasHiddenColumns,
  hideableColumnsCount,
  sortableColumnsCount,
  useAdvancedFilters,
}: {
  activeFiltersCount: number;
  activeGroupingCount: number;
  activeSortCount: number;
  enableColumnFilters: boolean;
  enableGrouping: boolean;
  enableSorting: boolean;
  filterableColumnsCount: number;
  groupableColumnsCount: number;
  hasHiddenColumns: boolean;
  hideableColumnsCount: number;
  sortableColumnsCount: number;
  useAdvancedFilters: boolean;
}): MenuSectionState => {
  const canShowColumnsSection = hideableColumnsCount > 0 || hasHiddenColumns;
  const canShowFiltersSection =
    enableColumnFilters &&
    (useAdvancedFilters ||
      filterableColumnsCount > 0 ||
      activeFiltersCount > 0);
  const canShowSortSection =
    enableSorting && (sortableColumnsCount > 0 || activeSortCount > 0);
  const canShowGroupSection =
    enableGrouping && (groupableColumnsCount > 0 || activeGroupingCount > 0);

  const effectiveActiveFiltersCount = canShowFiltersSection
    ? activeFiltersCount
    : 0;
  const effectiveActiveSortCount = canShowSortSection ? activeSortCount : 0;

  return {
    canShowColumnsSection,
    canShowFiltersSection,
    canShowGroupSection,
    canShowSortSection,
    effectiveActiveFiltersCount,
    effectiveActiveSortCount,
    hasAnyMenuSection:
      canShowColumnsSection ||
      canShowFiltersSection ||
      canShowSortSection ||
      canShowGroupSection,
    hasAnythingToReset:
      effectiveActiveFiltersCount > 0 ||
      effectiveActiveSortCount > 0 ||
      (canShowGroupSection && activeGroupingCount > 0) ||
      hasHiddenColumns,
    menuBadgeCount: effectiveActiveFiltersCount + effectiveActiveSortCount,
  };
};

interface OptionsMenuTriggerProps {
  actionsAsIcons: boolean;
  badgeCount: number;
  className?: string;
  disabled?: boolean;
  label: string;
}

const OptionsMenuTrigger = forwardRef<
  HTMLButtonElement,
  OptionsMenuTriggerProps
>(function OptionsMenuTrigger(
  { actionsAsIcons, badgeCount, className, disabled = false, label, ...props },
  ref
) {
  const hasBadge = badgeCount > 0;
  const button = (
    <Button
      aria-label={actionsAsIcons ? label : undefined}
      className={cn(
        actionsAsIcons ? "relative h-8 w-8" : "h-8 gap-2 px-3",
        className
      )}
      disabled={disabled}
      ref={ref}
      size={actionsAsIcons ? "icon-sm" : "sm"}
      title={actionsAsIcons ? label : undefined}
      type="button"
      variant="outline"
      {...props}
    >
      <SlidersHorizontal className="h-4 w-4" />
      {!actionsAsIcons && <span>{label}</span>}
      {hasBadge && (
        <span
          className={cn(
            "flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground",
            actionsAsIcons ? "absolute -top-1 -right-1" : "ml-1"
          )}
        >
          {badgeCount}
        </span>
      )}
    </Button>
  );

  if (!actionsAsIcons) {
    return button;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={button} />
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

function renderMainMenuView({
  activeGroupingCount,
  displayVisibleCount,
  sectionState,
  t,
}: {
  activeGroupingCount: number;
  displayVisibleCount: number;
  sectionState: MenuSectionState;
  t: ReturnType<typeof useTranslations>["t"];
}) {
  return (
    <StackMenuView name="main">
      <StackMenuContent>
        <StackMenuSection>
          {sectionState.canShowColumnsSection && (
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
          )}

          {sectionState.canShowFiltersSection && (
            <StackMenuItem
              description={
                sectionState.effectiveActiveFiltersCount > 0
                  ? t("filters.active_count", {
                      count: sectionState.effectiveActiveFiltersCount,
                    })
                  : undefined
              }
              endIcon={
                sectionState.effectiveActiveFiltersCount > 0 ? (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                    {sectionState.effectiveActiveFiltersCount}
                  </span>
                ) : undefined
              }
              icon={<ListFilter className="h-4 w-4" />}
              navigateTitle={getNavigationTitle("filters", t)}
              navigateTo="filters"
            >
              {t("menu.filter")}
            </StackMenuItem>
          )}

          {sectionState.canShowSortSection && (
            <StackMenuItem
              description={
                sectionState.effectiveActiveSortCount > 0
                  ? t("filters.active_count", {
                      count: sectionState.effectiveActiveSortCount,
                    })
                  : undefined
              }
              endIcon={
                sectionState.effectiveActiveSortCount > 0 ? (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                    {sectionState.effectiveActiveSortCount}
                  </span>
                ) : undefined
              }
              icon={<ArrowUpDown className="h-4 w-4" />}
              navigateTitle={getNavigationTitle("sort", t)}
              navigateTo="sort"
            >
              {t("menu.sort")}
            </StackMenuItem>
          )}

          {sectionState.canShowGroupSection && (
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
          )}
        </StackMenuSection>
      </StackMenuContent>
    </StackMenuView>
  );
}

export function TableMenu({
  actionsAsIcons = false,
  columns = [],
  enableColumnFilters = true,
  enableGrouping = true,
  enableSorting = true,
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
  const filterableColumnsCount = columns.filter(
    (col) => col.canFilter !== false
  ).length;
  const sortableColumnsCount = columns.filter(
    (col) => col.canSort !== false
  ).length;
  const groupableColumnsCount = columns.filter(
    (col) =>
      col.id !== "actions" && col.id !== "select" && col.canGroup !== false
  ).length;

  const hasHiddenColumns = columns.some(
    (col) => state.columnVisibility[col.id] === false
  );
  const sectionState = useMemo(
    () =>
      buildMenuSectionState({
        activeFiltersCount,
        activeGroupingCount,
        activeSortCount,
        enableColumnFilters,
        enableGrouping,
        enableSorting,
        filterableColumnsCount,
        groupableColumnsCount,
        hasHiddenColumns,
        hideableColumnsCount: hideableColumns.length,
        sortableColumnsCount,
        useAdvancedFilters,
      }),
    [
      activeFiltersCount,
      activeGroupingCount,
      activeSortCount,
      enableColumnFilters,
      enableGrouping,
      enableSorting,
      filterableColumnsCount,
      groupableColumnsCount,
      hasHiddenColumns,
      hideableColumns.length,
      sortableColumnsCount,
      useAdvancedFilters,
    ]
  );

  const hasMenuBadgeCount =
    sectionState.effectiveActiveFiltersCount > 0 ||
    sectionState.effectiveActiveSortCount > 0;
  const optionsLabel = useMemo(() => {
    const translated = t("menu.options");
    return translated === "menu.options" ? "Options" : translated;
  }, [t]);

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
      disabled={!sectionState.hasAnythingToReset}
      onClick={handleResetAll}
      size="sm"
      title={t("menu.reset_all_description")}
      type="button"
      variant="ghost"
    >
      <RotateCcw className="h-4 w-4" />
    </Button>
  );

  // Hide options button entirely if nothing is available
  if (!sectionState.hasAnyMenuSection) {
    return null;
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
        <OptionsMenuTrigger
          actionsAsIcons={actionsAsIcons}
          badgeCount={hasMenuBadgeCount ? sectionState.menuBadgeCount : 0}
          label={optionsLabel}
        />
      }
    >
      {renderMainMenuView({
        activeGroupingCount,
        displayVisibleCount,
        sectionState,
        t,
      })}

      {sectionState.canShowColumnsSection && (
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
      )}

      {sectionState.canShowFiltersSection && (
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
      )}

      {sectionState.canShowSortSection && (
        <StackMenuView name="sort">
          <TableSortMenu
            columns={adaptToTanstackColumns(columns)}
            invalidateTable={invalidateTable}
            setSorting={setSorting}
            sorting={state.sorting}
            tableId={tableId}
          />
        </StackMenuView>
      )}

      {sectionState.canShowGroupSection && (
        <StackMenuView name="group">
          <TableGroupingMenu
            columns={columns}
            grouping={finalGrouping}
            invalidateTable={invalidateTable}
            setGrouping={finalSetGrouping}
            tableId={tableId}
          />
        </StackMenuView>
      )}

      {/* Subgroup view removed - grouping handled directly in group view */}
    </StackMenu>
  );
}
