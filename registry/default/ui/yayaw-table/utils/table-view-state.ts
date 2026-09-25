import { normalizeGanttView } from "../planning/engine";
import type {
  ColumnFiltersState,
  ColumnPinningState,
  ColumnSizingState,
  SortingState,
  VisibilityState,
} from "../tanstack";
import type { TableDisplayMode } from "../types/display-types";
import type { AdvancedFiltersState } from "../types/filter-types";
import type { TableViewConfig } from "../types/view-types";
import { normalizeDateFilterRules } from "./date-filter-days";
import {
  displayModeMaxGroups,
  type GenericModeViewConfigs,
  isTableDisplayMode,
  normalizeGenericModeConfigs,
} from "./display-modes";
import { normalizeGalleryViewConfig } from "./gallery-view-state";
import {
  isTableDensity,
  normalizeColumnSizing,
  normalizeFilterEnvelope,
  normalizeViewAliases,
} from "./table-contracts";
import { areViewSettingsEqual } from "./view-menu";

const EMPTY_PINNING: ColumnPinningState = { left: [], right: [] };

function hasArrayValues(value: unknown): value is unknown[] {
  return Array.isArray(value) && value.length > 0;
}

function hasObjectValues(value: unknown): value is Record<string, unknown> {
  return Boolean(
    value && typeof value === "object" && Object.keys(value).length > 0
  );
}

function normalizePageSize(
  value: number | string | undefined
): number | undefined {
  const numericValue = typeof value === "string" ? Number(value) : value;
  if (
    typeof numericValue !== "number" ||
    !Number.isFinite(numericValue) ||
    numericValue <= 0
  ) {
    return;
  }

  return Math.trunc(numericValue);
}

export function normalizeGroupingState(
  value: unknown,
  fallbackGroupBy?: string
): string[] {
  const grouping = Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

  if (grouping.length > 0) {
    return grouping;
  }

  const fallback = fallbackGroupBy?.trim();
  return fallback ? [fallback] : [];
}

export function getPrimaryGrouping(value: unknown): string {
  return normalizeGroupingState(value)[0] ?? "";
}

export function getDisplayModeGrouping({
  displayMode,
  grouping,
}: {
  displayMode: TableDisplayMode;
  grouping: unknown;
}): string[] {
  const normalizedGrouping = normalizeGroupingState(grouping);
  // Only the single-level card modes truncate; a mode without grouping keeps the shared state.
  return displayModeMaxGroups(displayMode) === 1
    ? normalizedGrouping.slice(0, 1)
    : normalizedGrouping;
}

function normalizeDisplayMode(
  value: TableDisplayMode | undefined
): TableDisplayMode | undefined {
  return isTableDisplayMode(value) ? value : undefined;
}

function normalizeKanbanViewConfig(
  config: TableViewConfig["kanban"]
): TableViewConfig["kanban"] {
  if (!config) {
    return;
  }

  const normalized: NonNullable<TableViewConfig["kanban"]> = {};
  const titleColumn = config.titleColumn?.trim();
  const cardColumnIds = normalizeColumnIds(config.cardColumnIds);

  if (titleColumn) {
    normalized.titleColumn = titleColumn;
  }
  if (cardColumnIds !== undefined) {
    normalized.cardColumnIds = cardColumnIds;
  }
  if (typeof config.showCardLabels === "boolean") {
    normalized.showCardLabels = config.showCardLabels;
  }

  return hasObjectValues(normalized) ? normalized : undefined;
}

function normalizeColumnIds(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return;
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeColumnPinning(
  pinning: ColumnPinningState | undefined
): ColumnPinningState | undefined {
  const left = Array.isArray(pinning?.left) ? pinning.left : [];
  const right = Array.isArray(pinning?.right) ? pinning.right : [];
  if (left.length === 0 && right.length === 0) {
    return;
  }

  return { left, right };
}

function normalizeFooterVisibility(value: unknown): TableViewConfig {
  return typeof value === "boolean" ? { footerCalculationsVisible: value } : {};
}

function normalizeViewDensity(
  density: TableViewConfig["density"]
): TableViewConfig {
  return isTableDensity(density) ? { density } : {};
}

function normalizedGanttConfig(
  input: TableViewConfig["gantt"]
): TableViewConfig {
  const gantt = normalizeGanttView(input);
  return Object.keys(gantt).length ? { gantt } : {};
}

export function normalizeTableViewConfig(
  input: TableViewConfig
): TableViewConfig {
  const config = normalizeViewAliases(input) as TableViewConfig;
  // Date rules name calendar days; older views saved instants.
  config.advancedFilters = normalizeDateFilterRules(
    normalizeFilterEnvelope(config.advancedFilters).filters
  ) as unknown as AdvancedFiltersState;
  const normalized: TableViewConfig = normalizeViewDensity(config.density);
  Object.assign(
    normalized,
    normalizeFooterVisibility(config.footerCalculationsVisible)
  );
  const advancedFilters = hasArrayValues(config.advancedFilters)
    ? (config.advancedFilters as AdvancedFiltersState)
    : undefined;
  const columnFilters = hasArrayValues(config.columnFilters)
    ? (config.columnFilters as ColumnFiltersState)
    : undefined;
  const columnOrder = hasArrayValues(config.columnOrder)
    ? config.columnOrder
    : undefined;
  const columnPinning = normalizeColumnPinning(config.columnPinning);
  const columnSizing = normalizeColumnSizing(config.columnSizing);
  const columnVisibility = hasObjectValues(config.columnVisibility)
    ? (config.columnVisibility as VisibilityState)
    : undefined;
  const globalSearch =
    typeof config.globalSearch === "string" && config.globalSearch.trim()
      ? config.globalSearch.trim()
      : undefined;
  const displayMode = normalizeDisplayMode(config.displayMode);
  const grouping = normalizeGroupingState(config.grouping);
  const kanban = normalizeKanbanViewConfig(config.kanban);

  const gallery = normalizeGalleryViewConfig(config.gallery);
  const pageSize = normalizePageSize(config.pageSize);
  const sorting = hasArrayValues(config.sorting)
    ? (config.sorting as SortingState)
    : undefined;

  if (advancedFilters) {
    normalized.advancedFilters = advancedFilters;
  }
  if (columnFilters) {
    normalized.columnFilters = columnFilters;
  }
  if (columnOrder) {
    normalized.columnOrder = columnOrder;
  }
  if (columnPinning) {
    normalized.columnPinning = columnPinning;
  }
  if (hasObjectValues(columnSizing)) {
    normalized.columnSizing = columnSizing;
  }
  if (columnVisibility) {
    normalized.columnVisibility = columnVisibility;
  }
  if (globalSearch) {
    normalized.globalSearch = globalSearch;
  }
  if (displayMode) {
    normalized.displayMode = displayMode;
  }
  if (grouping.length > 0) {
    normalized.grouping = grouping;
  }
  if (kanban) {
    normalized.kanban = kanban;
  }
  Object.assign(
    normalized,
    normalizeGenericModeConfigs(config as Record<string, unknown>)
  );
  Object.assign(normalized, normalizedGanttConfig(config.gantt));
  if (gallery) {
    normalized.gallery = gallery;
  }
  if (pageSize) {
    normalized.pageSize = pageSize;
  }
  if (sorting) {
    normalized.sorting = sorting;
  }

  return normalized;
}

export function createTableViewConfigSnapshot({
  advancedFiltersParam,
  footerCalculationsVisible,
  density,
  displayModeParam,
  filtersParam,
  globalSearchParam,
  groupingParam,
  ganttParam,
  galleryParam,
  kanbanParam,
  kanbanGroupByParam,
  modeConfigsParam,
  orderParam,
  pageSizeParam,
  pinningParam,
  sizingParam,
  sortParam,
  visibilityParam,
}: {
  footerCalculationsVisible?: boolean;
  density?: TableViewConfig["density"];
  advancedFiltersParam: AdvancedFiltersState;
  displayModeParam: TableDisplayMode;
  filtersParam: ColumnFiltersState;
  globalSearchParam: string;
  groupingParam: string[];
  ganttParam?: TableViewConfig["gantt"];
  galleryParam: TableViewConfig["gallery"];
  kanbanParam: TableViewConfig["kanban"];
  kanbanGroupByParam: string;
  /** Settings of the modes handled generically by the registry. */
  modeConfigsParam?: GenericModeViewConfigs;
  orderParam: string[];
  pageSizeParam: string;
  pinningParam?: ColumnPinningState;
  sizingParam?: ColumnSizingState;
  sortParam: SortingState;
  visibilityParam: VisibilityState;
}): TableViewConfig {
  return normalizeTableViewConfig({
    density,
    footerCalculationsVisible,
    advancedFilters: advancedFiltersParam,
    columnFilters: filtersParam,
    columnOrder: orderParam,
    columnPinning: normalizeColumnPinning(pinningParam) ?? EMPTY_PINNING,
    columnSizing: sizingParam ?? {},
    columnVisibility: visibilityParam,
    displayMode: displayModeParam,
    globalSearch: globalSearchParam,
    grouping: normalizeGroupingState(
      groupingParam,
      kanbanParam?.groupBy ?? kanbanGroupByParam
    ),
    gantt: ganttParam,
    gallery: galleryParam,
    kanban: kanbanParam,
    ...modeConfigsParam,
    pageSize: normalizePageSize(pageSizeParam),
    sorting: sortParam,
  });
}

export function areTableViewConfigsEqual(
  left: TableViewConfig,
  right: TableViewConfig
): boolean {
  return areViewSettingsEqual(
    normalizeTableViewConfig(left),
    normalizeTableViewConfig(right)
  );
}
