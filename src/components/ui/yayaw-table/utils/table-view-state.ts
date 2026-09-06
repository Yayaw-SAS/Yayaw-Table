import type {
  ColumnFiltersState,
  ColumnPinningState,
  ColumnSizingState,
  SortingState,
  VisibilityState,
} from "@/components/ui/yayaw-table/tanstack";
import type {
  TableDisplayMode,
  TableGalleryAspectRatio,
  TableGalleryCardSize,
  TableGalleryImageFit,
} from "../types/display-types";
import type { AdvancedFiltersState } from "../types/filter-types";
import type { TableViewConfig } from "../types/view-types";
import {
  normalizeFilterEnvelope,
  normalizeColumnSizing,
  normalizeViewAliases,
} from "./table-contracts";

const EMPTY_PINNING: ColumnPinningState = { left: [], right: [] };
const SINGLE_GROUP_DISPLAY_MODES = new Set<TableDisplayMode>([
  "gallery",
  "kanban",
]);

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
  return SINGLE_GROUP_DISPLAY_MODES.has(displayMode)
    ? normalizedGrouping.slice(0, 1)
    : normalizedGrouping;
}

function normalizeDisplayMode(
  value: TableDisplayMode | undefined
): TableDisplayMode | undefined {
  if (value === "gallery" || value === "kanban" || value === "table") {
    return value;
  }

  return;
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

function normalizeGalleryAspectRatio(
  value: unknown
): TableGalleryAspectRatio | undefined {
  if (
    value === "portrait" ||
    value === "square" ||
    value === "video" ||
    value === "wide"
  ) {
    return value;
  }

  return;
}

function normalizeGalleryImageFit(
  value: unknown
): TableGalleryImageFit | undefined {
  if (value === "contain" || value === "cover") {
    return value;
  }

  return;
}

function normalizeGalleryCardSize(
  value: unknown
): TableGalleryCardSize | undefined {
  if (value === "large" || value === "medium" || value === "small") {
    return value;
  }

  return;
}

function normalizeGalleryViewConfig(
  config: TableViewConfig["gallery"]
): TableViewConfig["gallery"] {
  if (!config) {
    return;
  }

  const normalized: NonNullable<TableViewConfig["gallery"]> = {};
  const imageColumn = config.imageColumn?.trim();
  const titleColumn = config.titleColumn?.trim();
  const cardColumnIds = normalizeColumnIds(config.cardColumnIds);
  const aspectRatio = normalizeGalleryAspectRatio(config.aspectRatio);
  const imageFit = normalizeGalleryImageFit(config.imageFit);
  const cardSize = normalizeGalleryCardSize(config.cardSize);

  if (imageColumn) {
    normalized.imageColumn = imageColumn;
  }
  if (titleColumn) {
    normalized.titleColumn = titleColumn;
  }
  if (cardColumnIds !== undefined) {
    normalized.cardColumnIds = cardColumnIds;
  }
  if (aspectRatio) {
    normalized.aspectRatio = aspectRatio;
  }
  if (imageFit) {
    normalized.imageFit = imageFit;
  }
  if (cardSize) {
    normalized.cardSize = cardSize;
  }
  if (typeof config.showCardLabels === "boolean") {
    normalized.showCardLabels = config.showCardLabels;
  }

  return hasObjectValues(normalized) ? normalized : undefined;
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

export function normalizeTableViewConfig(
  input: TableViewConfig
): TableViewConfig {
  const config = normalizeViewAliases(input) as TableViewConfig;
  config.advancedFilters = normalizeFilterEnvelope(config.advancedFilters)
    .filters as unknown as AdvancedFiltersState;
  const normalized: TableViewConfig = {};
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
  const grouping = normalizeGroupingState(
    config.grouping,
    config.kanban?.groupBy
  );
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
  displayModeParam,
  filtersParam,
  globalSearchParam,
  groupingParam,
  galleryParam,
  kanbanParam,
  kanbanGroupByParam,
  orderParam,
  pageSizeParam,
  pinningParam,
  sizingParam,
  sortParam,
  visibilityParam,
}: {
  advancedFiltersParam: AdvancedFiltersState;
  displayModeParam: TableDisplayMode;
  filtersParam: ColumnFiltersState;
  globalSearchParam: string;
  groupingParam: string[];
  galleryParam: TableViewConfig["gallery"];
  kanbanParam: TableViewConfig["kanban"];
  kanbanGroupByParam: string;
  orderParam: string[];
  pageSizeParam: string;
  pinningParam?: ColumnPinningState;
  sizingParam?: ColumnSizingState;
  sortParam: SortingState;
  visibilityParam: VisibilityState;
}): TableViewConfig {
  return normalizeTableViewConfig({
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
    gallery: galleryParam,
    kanban: kanbanParam,
    pageSize: normalizePageSize(pageSizeParam),
    sorting: sortParam,
  });
}

export function areTableViewConfigsEqual(
  left: TableViewConfig,
  right: TableViewConfig
): boolean {
  return (
    JSON.stringify(normalizeTableViewConfig(left)) ===
    JSON.stringify(normalizeTableViewConfig(right))
  );
}
