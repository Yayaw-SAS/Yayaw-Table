"use client";

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  ArrowUpDown,
  Calculator,
  Layers,
  List,
  ListFilter,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import {
  forwardRef,
  type ReactNode,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  StackMenu,
  StackMenuContent,
  StackMenuItem,
  StackMenuSection,
  StackMenuView,
} from "@/components/ui/custom/stack-menu";
import type { TableState } from "@/components/ui/yayaw-table/tanstack";
import { cn } from "@/lib/utils";
import { Button } from "@/src/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/src/components/ui/tooltip";
import {
  footerVisibleAtom,
  tableMenuOpenFilterColumnIdAtom,
  tableMenuOpenToViewAtom,
} from "../../atoms";
import { useTableUrlState } from "../../hooks/use-table-url-state";
import { planningLabelOverrides } from "../../planning/labels";
import { ganttSettingsLabels } from "../../planning/settings";
import { useTableDefaultSorting } from "../../providers/table-state-sync-provider";
import { useLocale, useTranslations } from "../../providers/table-provider";
import type { ColumnDataType } from "../../types";
import type { TableDisplayMode } from "../../types/display-types";
import type {
  AdvancedFiltersState,
  ColumnsFilterConfig,
  FilterActions,
} from "../../types/filter-types";
import { formLabel } from "../../utils/form-view";
import { TableTooltip } from "../../utils/table-tooltip";
import { getDisplayModeGrouping } from "../../utils/table-view-state";
import { translateWithFallback } from "../filters/i18n-utils";
import { getViewModeCapabilities } from "../../utils/view-menu";
import { TableColumnsMenu } from "./sections/table-columns-menu";
import { TableFiltersMenu } from "./sections/table-filters-menu";
import { TableGroupingMenu } from "./sections/table-grouping-menu";
import { TableSortMenu } from "./sections/table-sort-menu";
import type { ViewMenuParts } from "./table-view-manager";

const EMPTY_COLUMNS: never[] = [];

export interface SettingsScreen {
  id: string;
  label: string;
  icon: ReactNode;
  value: string;
  content: ReactNode;
}

export interface TableMenuProps {
  compact?: boolean;
  viewMenu?: ViewMenuParts;
  /** Export, share and application actions, listed under "Data". */
  dataActions?: ReactNode;
  /**
   * Settings shown as a row with their value that opens a screen of choices,
   * e.g. layout and density in touch drawers.
   */
  screens?: SettingsScreen[];
  /** Screens opened from the "Data" section, such as the export options. */
  dataScreens?: { name: string; title: string; content: ReactNode }[];
  modeSettings?: ReactNode;
  cardSettings?: ReactNode;
  filterExtras?: ReactNode;
  actionsAsIcons?: boolean;
  columns: TableColumn[];
  defaultDisplayMode?: TableDisplayMode;
  enableColumnFilters?: boolean;
  enableCalculations?: boolean;
  enableGrouping?: boolean;
  enableSorting?: boolean;
  invalidateTable: () => Promise<void>;
  setColumnFilters: (state: TableState["columnFilters"]) => void;
  setColumnVisibility: (state: TableState["columnVisibility"]) => void;
  setGrouping: (state: TableState["grouping"]) => void;
  setSorting: (state: TableState["sorting"]) => void;
  state: TableState;
  tableId: string;
  tableType?: string;
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
}

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

export interface MenuSectionState {
  canShowColumnsSection: boolean;
  canShowCalculationsSection: boolean;
  canShowFiltersSection: boolean;
  canShowGroupSection: boolean;
  canShowSortSection: boolean;
  effectiveActiveFiltersCount: number;
  effectiveActiveSortCount: number;
  hasAnyMenuSection: boolean;
  hasAnythingToReset: boolean;
  menuBadgeCount: number;
}

export const buildMenuSectionState = ({
  activeFiltersCount,
  activeGroupingCount,
  activeSortCount,
  enableColumnFilters,
  enableCalculations,
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
  enableCalculations: boolean;
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
  const canShowCalculationsSection = enableCalculations;
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
    canShowCalculationsSection,
    canShowFiltersSection,
    canShowGroupSection,
    canShowSortSection,
    effectiveActiveFiltersCount,
    effectiveActiveSortCount,
    hasAnyMenuSection:
      canShowColumnsSection ||
      canShowCalculationsSection ||
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
  /** Touch-size target in compact toolbars. */
  compact?: boolean;
  disabled?: boolean;
  label: string;
}

const OptionsMenuTrigger = forwardRef<
  HTMLButtonElement,
  OptionsMenuTriggerProps
>(function OptionsMenuTrigger(
  {
    actionsAsIcons,
    badgeCount,
    className,
    compact = false,
    disabled = false,
    label,
    ...props
  },
  ref
) {
  const hasBadge = badgeCount > 0;
  const button = (
    <Button
      aria-label={actionsAsIcons ? label : undefined}
      className={cn(
        actionsAsIcons
          ? "relative h-8 w-8"
          : "h-8 gap-2 px-3 font-normal text-xs leading-4",
        compact && "size-11",
        className
      )}
      disabled={disabled}
      ref={ref}
      size={actionsAsIcons ? "icon-sm" : "sm"}
      type="button"
      variant="outline"
      {...props}
    >
      <SlidersHorizontal className="size-4" />
      {!actionsAsIcons && <span>{label}</span>}
      {hasBadge && (
        <span
          className={cn(
            "flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground",
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
  selection,
  actions,
  dataActions,
  screens,
  modeSettings,
  cardSettings,
  cardSettingsTitle,
  activeGroupingCount,
  displayVisibleCount,
  footerCalculationsLabel,
  isFooterCalculationsVisible,
  onToggleFooterCalculations,
  sectionState,
  t,
}: {
  selection?: ReactNode;
  actions?: ReactNode;
  dataActions?: ReactNode;
  screens?: SettingsScreen[];
  modeSettings?: ReactNode;
  cardSettings?: ReactNode;
  cardSettingsTitle: string;
  activeGroupingCount: number;
  displayVisibleCount: number;
  footerCalculationsLabel: string;
  isFooterCalculationsVisible: boolean;
  onToggleFooterCalculations: () => void;
  sectionState: MenuSectionState;
  t: ReturnType<typeof useTranslations>["t"];
}) {
  return (
    <StackMenuView name="main" title={t("views.settings")}>
      <StackMenuContent>
        {selection}
        {modeSettings}
        {screens?.map((screen) => (
          <StackMenuItem
            endIcon={
              <span className="text-muted-foreground text-xs">
                {screen.value}
              </span>
            }
            icon={screen.icon}
            key={screen.id}
            navigateTitle={screen.label}
            navigateTo={screen.id}
          >
            {screen.label}
          </StackMenuItem>
        ))}
        {cardSettings ? (
          <StackMenuItem
            icon={<List className="size-4" />}
            navigateTitle={cardSettingsTitle}
            navigateTo="cards"
          >
            {cardSettingsTitle}
          </StackMenuItem>
        ) : null}
        <StackMenuSection>
          {sectionState.canShowColumnsSection && (
            <StackMenuItem
              endIcon={
                displayVisibleCount > 0 ? (
                  <span className="flex min-w-4 items-center justify-center text-muted-foreground text-xs tabular-nums">
                    {displayVisibleCount}
                  </span>
                ) : undefined
              }
              icon={<List className="size-4" />}
              navigateTitle={getNavigationTitle("columns", t)}
              navigateTo="columns"
            >
              {t("menu.properties")}
            </StackMenuItem>
          )}

          {sectionState.canShowFiltersSection && (
            <StackMenuItem
              endIcon={
                sectionState.effectiveActiveFiltersCount > 0 ? (
                  <span className="flex min-w-4 items-center justify-center text-muted-foreground text-xs tabular-nums">
                    {sectionState.effectiveActiveFiltersCount}
                  </span>
                ) : undefined
              }
              icon={<ListFilter className="size-4" />}
              navigateTitle={getNavigationTitle("filters", t)}
              navigateTo="filters"
            >
              {t("menu.filter")}
            </StackMenuItem>
          )}

          {sectionState.canShowSortSection && (
            <StackMenuItem
              endIcon={
                sectionState.effectiveActiveSortCount > 0 ? (
                  <span className="flex min-w-4 items-center justify-center text-muted-foreground text-xs tabular-nums">
                    {sectionState.effectiveActiveSortCount}
                  </span>
                ) : undefined
              }
              icon={<ArrowUpDown className="size-4" />}
              navigateTitle={getNavigationTitle("sort", t)}
              navigateTo="sort"
            >
              {t("menu.sort")}
            </StackMenuItem>
          )}

          {sectionState.canShowGroupSection && (
            <StackMenuItem
              endIcon={
                activeGroupingCount > 0 ? (
                  <span className="flex min-w-4 items-center justify-center text-muted-foreground text-xs tabular-nums">
                    {activeGroupingCount}
                  </span>
                ) : undefined
              }
              icon={<Layers className="size-4" />}
              navigateTitle={getNavigationTitle("group", t)}
              navigateTo="group"
            >
              {t("menu.group")}
            </StackMenuItem>
          )}

          {sectionState.canShowCalculationsSection && (
            <StackMenuItem
              endIcon={
                <span aria-hidden="true" className="text-xs">
                  {footerCalculationsLabel}
                </span>
              }
              icon={<Calculator className="size-4" />}
              onClick={onToggleFooterCalculations}
            >
              {t("menu.footer_calculations")}
              <span className="sr-only">
                {isFooterCalculationsVisible
                  ? t("menu.footer_calculations_on")
                  : t("menu.footer_calculations_off")}
              </span>
            </StackMenuItem>
          )}
        </StackMenuSection>
        {actions}
        {dataActions ? (
          <StackMenuSection
            className="mt-1 space-y-1 border-border border-t pt-1"
            data-menu-section="data"
          >
            <div className="px-2 pt-1 text-muted-foreground text-sm">
              {t("menu.data")}
            </div>
            {dataActions}
          </StackMenuSection>
        ) : null}
      </StackMenuContent>
    </StackMenuView>
  );
}

function resolveMenuGrouping(state: string[], url: string[]): string[] {
  return state.length ? state : url;
}

function getSettingsTitle(
  mode: TableDisplayMode,
  locale: string,
  translate: (key: string) => string,
  fallback: string
): string {
  if (mode === "form") {
    return formLabel("settingsTitle", locale, (key, text) =>
      translateWithFallback(translate, `form.${key}`, text)
    );
  }
  return mode === "gantt"
    ? ganttSettingsLabels(locale, planningLabelOverrides(translate)).title
    : fallback;
}

export function TableMenu({
  compact = false,
  viewMenu,
  dataActions,
  screens,
  dataScreens,
  modeSettings,
  cardSettings,
  filterExtras,
  columns = EMPTY_COLUMNS,
  defaultDisplayMode,
  enableColumnFilters = true,
  enableCalculations = false,
  enableGrouping = true,
  enableSorting = true,
  invalidateTable,
  setColumnFilters,
  setColumnVisibility,
  setGrouping,
  setSorting,
  state,
  tableId,
  tableType,
  useAdvancedFilters = false,
  advancedFiltersConfig,
}: TableMenuProps) {
  const { t } = useTranslations();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const openToView = useAtomValue(tableMenuOpenToViewAtom(tableId));
  const [isFooterCalculationsVisible, setFooterCalculationsVisible] = useAtom(
    footerVisibleAtom(tableId)
  );
  const setOpenToView = useSetAtom(tableMenuOpenToViewAtom(tableId));
  const setOpenFilterColumnId = useSetAtom(
    tableMenuOpenFilterColumnIdAtom(tableId)
  );

  // Derive open: menu opens when user toggles or when openToView is set (e.g. from column menu)
  const effectiveOpen = (viewMenu?.open ?? open) || Boolean(openToView);

  // URL-state fallback to avoid stale grouping passed from parents
  const {
    displayModeParam,
    groupingParam: urlGrouping,
    setGroupingFromUI,
  } = useTableUrlState({
    defaultDisplayMode,
    tableId,
  });

  const locale = useLocale();
  const cardSettingsTitle = getSettingsTitle(
    displayModeParam,
    locale,
    t,
    t("views.cardSettings")
  );
  const capabilities = getViewModeCapabilities(displayModeParam);
  const groupingMaxGroups = capabilities.maxGroups;
  const rawFinalGrouping = resolveMenuGrouping(
    state.grouping,
    urlGrouping
  ) as string[];
  const finalGrouping = getDisplayModeGrouping({
    displayMode: displayModeParam,
    grouping: rawFinalGrouping,
  });
  const finalSetGrouping = useCallback(
    (next: TableState["grouping"]) => {
      const displayGrouping = getDisplayModeGrouping({
        displayMode: displayModeParam,
        grouping: next as string[],
      });
      setGrouping(displayGrouping);
      setGroupingFromUI(displayGrouping);
    },
    [displayModeParam, setGrouping, setGroupingFromUI]
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
    ? (advancedFiltersConfig?.filters ?? []).filter((f) => f.isActive).length
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
        enableCalculations: enableCalculations && capabilities.calculations,
        enableGrouping,
        enableSorting,
        filterableColumnsCount,
        groupableColumnsCount,
        hasHiddenColumns: capabilities.columns && hasHiddenColumns,
        hideableColumnsCount: capabilities.columns ? hideableColumns.length : 0,
        sortableColumnsCount,
        useAdvancedFilters,
      }),
    [
      capabilities.calculations,
      capabilities.columns,
      activeFiltersCount,
      activeGroupingCount,
      activeSortCount,
      enableColumnFilters,
      enableCalculations,
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
  const footerCalculationsLabel = isFooterCalculationsVisible
    ? t("menu.footer_calculations_on")
    : t("menu.footer_calculations_off");
  const toggleFooterCalculations = useCallback(() => {
    setFooterCalculationsVisible((previous) => !previous);
  }, [setFooterCalculationsVisible]);

  const defaultSorting = useTableDefaultSorting();
  const handleResetAll = useCallback(() => {
    setColumnFilters([]);
    if (useAdvancedFilters && advancedFiltersConfig?.actions?.clearFilters) {
      advancedFiltersConfig.actions.clearFilters();
    }
    // Reset returns to the configured sort (`columns.sort`), as in Vue.
    setSorting(defaultSorting);
    finalSetGrouping([]);
    setColumnVisibility({});
  }, [
    setColumnFilters,
    useAdvancedFilters,
    advancedFiltersConfig?.actions,
    defaultSorting,
    setSorting,
    finalSetGrouping,
    setColumnVisibility,
  ]);

  const resetAllButton = (
    <TableTooltip label={t("menu.reset_all_description")}>
      <Button
        aria-label={t("menu.reset_all")}
        className="h-8 w-8 shrink-0 p-0 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
        disabled={!sectionState.hasAnythingToReset}
        onClick={handleResetAll}
        size="sm"
        type="button"
        variant="ghost"
      >
        <RotateCcw className="size-4" />
      </Button>
    </TableTooltip>
  );

  // Hide options button entirely if nothing is available
  if (
    !(sectionState.hasAnyMenuSection || viewMenu || dataActions || screens)
  ) {
    return null;
  }

  return (
    <StackMenu
      asDropdown
      compact={compact}
      defaultView="main"
      headerEndContent={viewMenu ? undefined : resetAllButton}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        viewMenu?.onOpenChange(isOpen);
        if (!isOpen) {
          setOpenToView(null);
          setOpenFilterColumnId(null);
        }
      }}
      open={effectiveOpen}
      openToView={openToView ?? undefined}
      ref={menuRef}
      size="lg"
      trigger={
        viewMenu?.trigger ?? (
          <OptionsMenuTrigger
            actionsAsIcons
            badgeCount={hasMenuBadgeCount ? sectionState.menuBadgeCount : 0}
            compact={compact}
            label={t("views.settings")}
          />
        )
      }
    >
      {renderMainMenuView({
        selection: viewMenu?.selection,
        actions: viewMenu?.actions,
        dataActions,
        screens,
        modeSettings,
        cardSettings,
        cardSettingsTitle,
        activeGroupingCount,
        displayVisibleCount,
        footerCalculationsLabel,
        isFooterCalculationsVisible,
        onToggleFooterCalculations: toggleFooterCalculations,
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
            tableType={tableType}
          />
        </StackMenuView>
      )}

      {sectionState.canShowFiltersSection && (
        <StackMenuView name="filters">
          {filterExtras}
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
            tableType={tableType}
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
            tableType={tableType}
          />
        </StackMenuView>
      )}

      {sectionState.canShowGroupSection && (
        <StackMenuView name="group">
          <TableGroupingMenu
            columns={columns}
            grouping={finalGrouping}
            invalidateTable={invalidateTable}
            maxGroups={groupingMaxGroups}
            setGrouping={finalSetGrouping}
            tableId={tableId}
            tableType={tableType}
          />
        </StackMenuView>
      )}

      {screens?.map((screen) => (
        <StackMenuView key={screen.id} name={screen.id} title={screen.label}>
          {screen.content}
        </StackMenuView>
      ))}
      {dataScreens?.map((screen) => (
        <StackMenuView key={screen.name} name={screen.name} title={screen.title}>
          {screen.content}
        </StackMenuView>
      ))}

      {cardSettings ? (
        <StackMenuView name="cards" title={cardSettingsTitle}>
          {cardSettings}
        </StackMenuView>
      ) : null}
    </StackMenu>
  );
}
