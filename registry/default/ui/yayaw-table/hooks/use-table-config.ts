/**
 * Hook for managing table configuration
 * Handles configuration retrieval, defaults, and translations
 */
"use client";

import { useMemo } from "react";
import type { TableFormConfig } from "../config/form-config";
/**
 * Configuration for table columns in the catalogue
 */
import type {
  ColumnDefinition,
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
  withTableDatePreset,
} from "../config/helpers";
import {
  useTableConfig as useProviderTableConfig,
  useTranslations,
} from "../providers/table-provider";
import type { ColumnSort } from "../tanstack";
import type { DateDisplayPreset } from "../types/date-types";
import type {
  TableDensity,
  TableDisplayMode,
  TableGalleryConfig,
  TableKanbanConfig,
} from "../types/display-types";
import type { CalculationType } from "../types/footer-types";
import type {
  ToolbarActionsInput,
  ToolbarActionsPlacement,
} from "../types/toolbar-types";
import type { GenericModeTableConfigs } from "../utils/display-modes";
import { pickGenericModeConfigs } from "../utils/display-modes";
import type { NumberFormatConfig } from "../utils/number-format";
import type { RecordPresentationConfig } from "../utils/record-presentation";
import { isTableDensity } from "../utils/table-contracts";
import { useTableTranslations } from "./use-table-translations";

export interface TableCatalogueColumnConfig extends ColumnDefinition {
  id: string;
  type: import("../utils/table-contracts").TableDataType;
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
  /** Inherits table.coloredTags; omitted keeps colored tags. */
  coloredTags?: boolean;
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
export interface TableCatalogueTableConfig extends GenericModeTableConfigs {
  coloredTags?: boolean;
  /** Offer "Manage tags" on tags columns when `actions.tags` can; default true. */
  canManageTags?: boolean;
  allowCreate?: boolean;
  allowEdit?: boolean;
  allowDuplicate?: boolean;
  allowDelete?: boolean;
  allowBulkEdit?: boolean;
  allowBulkDelete?: boolean;
  allowInlineEdit?: boolean;
  allowViewSave?: boolean;
  allowViewSharing?: boolean;
  /**
   * Saved views as tabs above the table (desktop). `false` keeps the view
   * menu only; `{ maxVisible }` sets how many tabs show before "More".
   */
  viewTabs?: import("../utils/view-tabs").ViewTabsConfig;
  canEditRow?: (row: Record<string, unknown>) => boolean;
  canDeleteRow?: (row: Record<string, unknown>) => boolean;
  canDuplicateRow?: (row: Record<string, unknown>) => boolean;
  canSelectRow?: (row: Record<string, unknown>) => boolean;
  showToolbar?: boolean;
  showToolbarHeader?: boolean;
  /** Show an icon in the toolbar to clear filters and global search. */
  /** Ordered static-option/boolean columns shown in the optional filter bar. */
  filterBarColumns?: string[];
  /** Show the filter bar by default; a component prop can override this. */
  showFilterBar?: boolean;
  showClearFilters?: boolean;
  /** Backwards-compatible alias for `showClearFilters`. */
  showResetFilters?: boolean;
  export?: boolean;
  /** Formats the Export screen offers (default CSV and PDF, Excel with `actions.exportFile`). */
  exportFormats?: import("../utils/export-model").ExportFormat[];
  /** Offer "Share" (copy the link to the view); default true. */
  share?: boolean;
  /** Offer scheduling settings for Connect destinations that declare `schedule`; default true. */
  schedule?: boolean;
  /** Open the connector screens of Connect destinations that declare `connector`; default true. */
  connectors?: boolean;
  /** Offer the pull and two-way directions of connectors that declare them; default true. */
  sync?: boolean;
  /** Offer Data › Import when rows can be created or updated; default true. */
  import?: boolean;
  bulkExport?: boolean;
  actionsAsIcons?: boolean;
  density?: TableDensity;
  layoutPreset?: TableLayoutPreset;
  displayModes?: TableDisplayMode[];
  defaultDisplayMode?: TableDisplayMode;
  kanban?: TableKanbanConfig;
  planning?: import("../planning/types").TablePlanningConfig;
  gantt?: import("../planning/types").TableGanttConfig;
  gallery?: TableGalleryConfig;
  manualOrder?: boolean;
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
  enableAutoPageSize?: boolean;
  /** Start table views in Automatic mode when automatic pagination is enabled. */
  defaultAutoPageSize?: boolean;
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
  presentation?: RecordPresentationConfig;
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
  presentation?: RecordPresentationConfig;
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

function normalizeDensityMode(density: TableDensity | undefined): TableDensity {
  return isTableDensity(density) ? density : "medium";
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
    share: mergedConfig.share,
    schedule: mergedConfig.schedule,
    connectors: mergedConfig.connectors,
    sync: mergedConfig.sync,
    import: mergedConfig.import,
    exportFormats: mergedConfig.exportFormats,
    bulkExport: mergedConfig.bulkExport ?? true,
    actionsAsIcons: mergedConfig.actionsAsIcons ?? false,
    coloredTags: mergedConfig.coloredTags !== false,
    canManageTags: mergedConfig.canManageTags,
    density: normalizeDensityMode(mergedConfig.density),
    layoutPreset,
    displayModes,
    defaultDisplayMode: resolveTableDisplayMode({
      allowedModes: displayModes,
      displayMode: mergedConfig.defaultDisplayMode,
    }),
    planning: mergedConfig.planning,
    gantt: mergedConfig.gantt,
    kanban: mergedConfig.kanban,
    gallery: mergedConfig.gallery,
    ...pickGenericModeConfigs(mergedConfig),
    manualOrder: mergedConfig.manualOrder,
    viewTabs: mergedConfig.viewTabs,
    emptyState: {
      show: true,
      ...mergedConfig.emptyState,
    },
    enableRowSelection: mergedConfig.enableRowSelection ?? true,
    enableRowClickEdit: mergedConfig.enableRowClickEdit ?? false,
    rowClickMode: mergedConfig.rowClickMode ?? "default",
    enableColumnFilters: mergedConfig.enableColumnFilters ?? true,
    filterBarColumns: mergedConfig.filterBarColumns,
    showFilterBar: mergedConfig.showFilterBar === true,
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
    enableAutoPageSize: mergedConfig.enableAutoPageSize,
    defaultAutoPageSize: mergedConfig.defaultAutoPageSize,
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
    Pick<TableCatalogueTableConfig, "dateDisplayPreset" | "enableRowSelection">
): TableCatalogueConfig["columns"] {
  const definitions = withTableDatePreset(
    providerConfig?.columns?.definitions || [],
    providerConfig.dateDisplayPreset
  );
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
  const table = resolveTableBehaviorConfig(tableOptions);

  return {
    table,
    presentation: providerConfig.presentation,
    form: providerConfig.form,
    columns: resolveColumnsConfig({
      columns,
      dateDisplayPreset: table.dateDisplayPreset,
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
