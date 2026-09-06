/**
 * Hook for managing table configuration
 * Handles configuration retrieval, defaults, and translations
 */
"use client";

import type { ColumnSort } from "@/components/ui/yayaw-table/tanstack";
import { useMemo } from "react";
import type { TableFormConfig } from "../config/form-config";
import type {
  InlineEditColumnConfig,
  TableConfig,
  TableEmptyStateConfig,
  TableInlineEditConfig,
  TableLayoutPreset,
  TableRowClickMode,
} from "../config/helpers";
import {
  getTableLayoutPresetDefaults,
  resolveTableDisplayMode,
  resolveTableDisplayModes,
  resolveTableLayoutPreset,
} from "../config/helpers";
import {
  useTableConfig as useProviderTableConfig,
  useTranslations,
} from "../providers/table-provider";
import type { DateDisplayPreset } from "../types/date-types";
import type {
  TableDisplayMode,
  TableGalleryConfig,
  TableKanbanConfig,
} from "../types/display-types";
import type { CalculationType } from "../types/footer-types";
import type {
  ToolbarActionsInput,
  ToolbarActionsPlacement,
} from "../types/toolbar-types";
import type { NumberFormatConfig } from "../utils/number-format";
import { useTableTranslations } from "./use-table-translations";

/**
 * Configuration for table columns in the catalogue
 */
export interface TableCatalogueColumnConfig {
  id: string;
  type: string;
  header: string;
  enableGrouping?: boolean;
  enableResizing?: boolean;
  enableSorting?: boolean;
  enablePinning?: boolean;
  enableColumnFilter?: boolean;
  displayVariant?: "default" | "tag";
  dateDisplayPreset?: DateDisplayPreset;
  dateFormat?: string;
  tagColorMap?: Record<string, string>;
  typeKey?: string;
  customRenderers?: Record<string, (value: unknown) => React.ReactNode>;
  /** Number column: "space" | "dot" | "comma" | "locale" or { thousandsSeparator, decimalSeparator, decimals } */
  numberFormat?: NumberFormatConfig;
  /** URL column display mode */
  urlDisplayMode?: "domain" | "full" | "icon" | "row-link";
  inlineEdit?: boolean | InlineEditColumnConfig;
  size?: number;
  minSize?: number;
  maxSize?: number;
  enableCalculation?: boolean;
  defaultCalculation?: CalculationType;
}

/**
 * Configuration for table behavior in the catalogue
 */
export interface TableCatalogueTableConfig {
  allowCreate?: boolean;
  allowEdit?: boolean;
  allowDuplicate?: boolean;
  allowDelete?: boolean;
  allowBulkEdit?: boolean;
  allowBulkDelete?: boolean;
  allowInlineEdit?: boolean;
  allowViewSave?: boolean;
  allowViewSharing?: boolean;
  canEditRow?: (row: Record<string, unknown>) => boolean;
  canDeleteRow?: (row: Record<string, unknown>) => boolean;
  canDuplicateRow?: (row: Record<string, unknown>) => boolean;
  canSelectRow?: (row: Record<string, unknown>) => boolean;
  showToolbar?: boolean;
  showToolbarHeader?: boolean;
  /** Show an icon in the toolbar to clear filters and global search. */
  showClearFilters?: boolean;
  /** Backwards-compatible alias for `showClearFilters`. */
  showResetFilters?: boolean;
  export?: boolean;
  bulkExport?: boolean;
  actionsAsIcons?: boolean;
  density?: "small" | "medium" | "large";
  layoutPreset?: TableLayoutPreset;
  displayModes?: TableDisplayMode[];
  defaultDisplayMode?: TableDisplayMode;
  kanban?: TableKanbanConfig;
  gallery?: TableGalleryConfig;
  emptyState?: TableEmptyStateConfig;
  enableRowSelection: boolean;
  enableRowClickEdit?: boolean;
  rowClickMode?: TableRowClickMode;
  enableColumnFilters: boolean;
  enableSorting: boolean;
  enableGrouping?: boolean;
  enableColumnPinning?: boolean;
  enableViews?: boolean;
  /** Gate for column DnD feature and UI */
  enableColumnDnd?: boolean;
  enableColumnDragDropByDefault?: boolean;
  enableColumnResizing?: boolean;
  enableMultiRowSelection?: boolean;
  enablePagination?: boolean;
  defaultPageSize?: number;
  pageSizeOptions?: number[];
  dateDisplayPreset?: DateDisplayPreset;
  inlineEdit?: TableInlineEditConfig;
  enableCalculations?: boolean;
  enableAdvancedFilters?: boolean;
  preserveSelectionOnQuery?: boolean;
  searchDebounceMs?: number;
  syncUrl?: boolean;
}

/**
 * Shape returned by getTableConfig: table options plus optional columns.
 * Used when normalizing provider config to TableCatalogueConfig.
 */
type ProviderTableConfig = TableCatalogueTableConfig & {
  form?: TableFormConfig;
  columns?: {
    definitions?: TableCatalogueColumnConfig[];
    order?: string[];
    visible?: string[];
    mandatory?: string[];
    sort?: ColumnSort[];
  };
  toolbarActions?: ToolbarActionsInput;
  toolbarActionsPlacement?: ToolbarActionsPlacement;
};

type ProviderTableConfigInput = Partial<ProviderTableConfig> | TableConfig;

/**
 * Full configuration for a table type in the catalogue
 */
export interface TableCatalogueConfig {
  table: TableCatalogueTableConfig;
  form?: TableFormConfig;
  columns: {
    definitions: TableCatalogueColumnConfig[];
    order?: string[];
    sort?: ColumnSort[];
    visible?: string[];
    mandatory?: string[];
  };
  translations?: {
    namespace: string;
    keys: Record<string, string>;
  };
  toolbarActions?: ToolbarActionsInput;
  toolbarActionsPlacement?: ToolbarActionsPlacement;
}

/**
 * Default table configuration
 */
const DEFAULT_TABLE_CONFIG: TableCatalogueConfig = {
  table: {
    allowCreate: true,
    allowEdit: true,
    allowDuplicate: true,
    allowDelete: true,
    allowBulkEdit: true,
    allowBulkDelete: true,
    allowInlineEdit: true,
    allowViewSave: true,
    allowViewSharing: false,
    showToolbar: true,
    showToolbarHeader: true,
    showClearFilters: false,
    showResetFilters: false,
    export: true,
    bulkExport: true,
    actionsAsIcons: false,
    density: "medium",
    layoutPreset: "default",
    displayModes: ["table"],
    defaultDisplayMode: "table",
    emptyState: {
      show: true,
    },
    enableRowSelection: true,
    enableRowClickEdit: false,
    rowClickMode: "default",
    enableColumnFilters: true,
    enableAdvancedFilters: false,
    enableColumnPinning: true,
    enableSorting: true,
    enableGrouping: true,
    enableViews: true,
    enableColumnDnd: true,
    enableColumnDragDropByDefault: false,
    enableColumnResizing: false,
    enableMultiRowSelection: true,
    enablePagination: true,
    defaultPageSize: 10,
    pageSizeOptions: [10, 20, 50, 100, 200, 500],
    dateDisplayPreset: "localized-short",
    enableCalculations: false,
    preserveSelectionOnQuery: false,
    searchDebounceMs: 300,
    syncUrl: true,
    inlineEdit: {
      enabled: false,
      debounceMs: 700,
      trigger: "doubleClickEnter",
      optimistic: true,
      showDelayIndicator: true,
    },
  },
  columns: {
    definitions: [],
    order: [],
    sort: [],
    visible: [],
    mandatory: [],
  },
  translations: {
    namespace: "common",
    keys: {},
  },
};

function normalizeDensityMode(
  density: "small" | "medium" | "large" | undefined
): "small" | "medium" | "large" {
  if (density === "small") {
    return "small";
  }

  if (density === "large") {
    return "large";
  }

  return "medium";
}

function resolveInlineEditConfig(
  inlineEdit: TableInlineEditConfig | undefined
): TableInlineEditConfig {
  return {
    enabled:
      inlineEdit?.enabled ??
      DEFAULT_TABLE_CONFIG.table.inlineEdit?.enabled ??
      false,
    debounceMs:
      inlineEdit?.debounceMs ??
      DEFAULT_TABLE_CONFIG.table.inlineEdit?.debounceMs ??
      700,
    trigger:
      inlineEdit?.trigger ??
      DEFAULT_TABLE_CONFIG.table.inlineEdit?.trigger ??
      "doubleClickEnter",
    optimistic:
      inlineEdit?.optimistic ??
      DEFAULT_TABLE_CONFIG.table.inlineEdit?.optimistic ??
      true,
    showDelayIndicator:
      inlineEdit?.showDelayIndicator ??
      DEFAULT_TABLE_CONFIG.table.inlineEdit?.showDelayIndicator ??
      true,
  };
}

function resolveTablePermissionConfig(
  mergedConfig: Partial<TableCatalogueTableConfig>
): Pick<
  TableCatalogueTableConfig,
  | "allowBulkDelete"
  | "allowBulkEdit"
  | "allowCreate"
  | "allowDelete"
  | "allowDuplicate"
  | "allowEdit"
  | "allowInlineEdit"
  | "allowViewSave"
  | "allowViewSharing"
  | "canDeleteRow"
  | "canDuplicateRow"
  | "canEditRow"
  | "canSelectRow"
> {
  return {
    allowCreate: mergedConfig.allowCreate ?? true,
    allowEdit: mergedConfig.allowEdit ?? true,
    allowDuplicate: mergedConfig.allowDuplicate ?? true,
    allowDelete: mergedConfig.allowDelete ?? true,
    allowBulkEdit: mergedConfig.allowBulkEdit ?? true,
    allowBulkDelete: mergedConfig.allowBulkDelete ?? true,
    allowInlineEdit: mergedConfig.allowInlineEdit ?? true,
    allowViewSave: mergedConfig.allowViewSave ?? true,
    allowViewSharing: mergedConfig.allowViewSharing ?? false,
    canEditRow: mergedConfig.canEditRow,
    canDeleteRow: mergedConfig.canDeleteRow,
    canDuplicateRow: mergedConfig.canDuplicateRow,
    canSelectRow: mergedConfig.canSelectRow,
  };
}

function resolveTableBehaviorConfig(
  providerConfig: Partial<TableCatalogueTableConfig>
): TableCatalogueTableConfig {
  const layoutPreset = resolveTableLayoutPreset(providerConfig.layoutPreset);
  const presetDefaults = getTableLayoutPresetDefaults(layoutPreset);
  const mergedConfig = {
    ...presetDefaults,
    ...providerConfig,
  };
  const displayModes = resolveTableDisplayModes(mergedConfig.displayModes);

  return {
    ...resolveTablePermissionConfig(mergedConfig),
    showToolbar: mergedConfig.showToolbar ?? true,
    showToolbarHeader: mergedConfig.showToolbarHeader ?? true,
    showClearFilters: mergedConfig.showClearFilters ?? false,
    showResetFilters: mergedConfig.showResetFilters ?? false,
    export: mergedConfig.export ?? true,
    bulkExport: mergedConfig.bulkExport ?? true,
    actionsAsIcons: mergedConfig.actionsAsIcons ?? false,
    density: normalizeDensityMode(mergedConfig.density),
    layoutPreset,
    displayModes,
    defaultDisplayMode: resolveTableDisplayMode({
      allowedModes: displayModes,
      displayMode: mergedConfig.defaultDisplayMode,
    }),
    kanban: mergedConfig.kanban,
    gallery: mergedConfig.gallery,
    emptyState: {
      show: true,
      ...mergedConfig.emptyState,
    },
    enableRowSelection: mergedConfig.enableRowSelection ?? true,
    enableRowClickEdit: mergedConfig.enableRowClickEdit ?? false,
    rowClickMode: mergedConfig.rowClickMode ?? "default",
    enableColumnFilters: mergedConfig.enableColumnFilters ?? true,
    enableAdvancedFilters: mergedConfig.enableAdvancedFilters ?? false,
    enableColumnPinning: mergedConfig.enableColumnPinning ?? true,
    enableSorting: mergedConfig.enableSorting ?? true,
    enableGrouping: mergedConfig.enableGrouping,
    enableViews: mergedConfig.enableViews !== false,
    enableColumnDnd: mergedConfig.enableColumnDnd ?? true,
    enableColumnDragDropByDefault: mergedConfig.enableColumnDragDropByDefault,
    enableColumnResizing: Boolean(mergedConfig.enableColumnResizing),
    enableMultiRowSelection: mergedConfig.enableMultiRowSelection,
    enablePagination: mergedConfig.enablePagination,
    defaultPageSize: mergedConfig.defaultPageSize,
    pageSizeOptions: mergedConfig.pageSizeOptions,
    dateDisplayPreset:
      mergedConfig.dateDisplayPreset ??
      DEFAULT_TABLE_CONFIG.table.dateDisplayPreset,
    inlineEdit: resolveInlineEditConfig(mergedConfig.inlineEdit),
    enableCalculations: mergedConfig.enableCalculations ?? false,
    preserveSelectionOnQuery: mergedConfig.preserveSelectionOnQuery ?? false,
    searchDebounceMs: mergedConfig.searchDebounceMs ?? 300,
    syncUrl: mergedConfig.syncUrl ?? true,
  };
}

function resolveColumnsConfig(
  providerConfig: Pick<ProviderTableConfig, "columns"> &
    Pick<TableCatalogueTableConfig, "enableRowSelection">
): TableCatalogueConfig["columns"] {
  const definitions = providerConfig?.columns?.definitions || [];
  const order = providerConfig?.columns?.order || [];
  const hasExplicitVisibleConfig = Array.isArray(
    providerConfig?.columns?.visible
  );
  const visible = providerConfig?.columns?.visible || [];
  const mandatory = providerConfig?.columns?.mandatory || [];
  const enableRowSelection = providerConfig.enableRowSelection !== false;

  const orderWithSelect =
    enableRowSelection && !order.includes("select")
      ? ["select", ...order]
      : order;
  const visibleWithSelect =
    !hasExplicitVisibleConfig &&
    enableRowSelection &&
    !visible.includes("select")
      ? ["select", ...visible]
      : visible;

  return {
    definitions,
    order: orderWithSelect,
    sort: providerConfig?.columns?.sort || [],
    visible: visibleWithSelect,
    mandatory,
  };
}

export function resolveTableCatalogueConfig(
  providerConfig?: ProviderTableConfigInput
): TableCatalogueConfig {
  if (!providerConfig) {
    return DEFAULT_TABLE_CONFIG;
  }

  const hasNestedShape = "table" in providerConfig;
  const tableOptions = hasNestedShape ? providerConfig.table : providerConfig;
  const columns = providerConfig.columns as ProviderTableConfig["columns"];
  const translations = hasNestedShape ? providerConfig.translations : undefined;

  return {
    table: resolveTableBehaviorConfig(tableOptions),
    form: providerConfig.form,
    columns: resolveColumnsConfig({
      columns,
      enableRowSelection: tableOptions.enableRowSelection ?? true,
    }),
    translations: translations ?? {
      namespace: "common",
      keys: {},
    },
    toolbarActions: providerConfig.toolbarActions,
    toolbarActionsPlacement: providerConfig.toolbarActionsPlacement,
  };
}

/**
 * Hook for managing table configuration
 */
export function useTableConfig(tableType: string) {
  // Get configuration and translation providers
  const getTableConfig = useProviderTableConfig();
  // Removed useColumnsConfig since it's not exported
  const { t } = useTranslations();
  const baseTranslations = useTableTranslations();

  // Get table configuration with fallback to defaults
  const config = useMemo(() => {
    const providerConfig = getTableConfig?.(tableType) as
      | ProviderTableConfig
      | undefined;
    // columnsConfig removed since useColumnsConfig is not exported

    return resolveTableCatalogueConfig(providerConfig);
  }, [getTableConfig, tableType]);

  // Create enhanced translations object
  const translations = useMemo(() => {
    if (!config.translations?.keys) {
      return baseTranslations;
    }

    return {
      ...baseTranslations,
      ...Object.entries(config.translations.keys).reduce(
        (acc, [key, value]) => {
          // Use the main t function for translation keys
          acc[key] = t(value);
          return acc;
        },
        {} as Record<string, string>
      ),
    };
  }, [baseTranslations, config.translations?.keys, t]);

  return {
    config,
    translations,
    isConfigured: !!getTableConfig?.(tableType),
  };
}
