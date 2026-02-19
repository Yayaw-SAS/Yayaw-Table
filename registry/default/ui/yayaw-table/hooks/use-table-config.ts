/**
 * Hook for managing table configuration
 * Handles configuration retrieval, defaults, and translations
 */
"use client";

import type { ColumnSort } from "@tanstack/react-table";
import { useMemo } from "react";
import type { TableFormConfig } from "../config/form-config";
import type {
  InlineEditColumnConfig,
  TableInlineEditConfig,
} from "../config/helpers";
import {
  useTableConfig as useProviderTableConfig,
  useTranslations,
} from "../providers/table-provider";
import type { DateDisplayPreset } from "../types/date-types";
import type { NumberFormatConfig } from "../utils/number-format";
import { useTableTranslations } from "./use-table-translations";

/**
 * Configuration for table columns in the catalogue
 */
export interface TableCatalogueColumnConfig {
  id: string;
  type: string;
  header: string;
  enableSorting?: boolean;
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
  showToolbar?: boolean;
  showToolbarHeader?: boolean;
  export?: boolean;
  bulkExport?: boolean;
  actionsAsIcons?: boolean;
  density?: "small" | "medium" | "large";
  enableRowSelection: boolean;
  enableRowClickEdit?: boolean;
  enableColumnFilters: boolean;
  enableSorting: boolean;
  enableGrouping?: boolean;
  /** Gate for column DnD feature and UI */
  enableColumnDnd?: boolean;
  enableColumnDragDropByDefault?: boolean;
  enableMultiRowSelection?: boolean;
  enablePagination?: boolean;
  defaultPageSize?: number;
  pageSizeOptions?: number[];
  dateDisplayPreset?: DateDisplayPreset;
  inlineEdit?: TableInlineEditConfig;
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
};

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
    showToolbar: true,
    showToolbarHeader: true,
    export: true,
    bulkExport: true,
    actionsAsIcons: false,
    density: "medium",
    enableRowSelection: true,
    enableRowClickEdit: false,
    enableColumnFilters: true,
    enableSorting: true,
    enableGrouping: true,
    enableColumnDnd: true,
    enableColumnDragDropByDefault: false,
    enableMultiRowSelection: true,
    enablePagination: true,
    defaultPageSize: 10,
    pageSizeOptions: [10, 20, 50, 100, 200, 500],
    dateDisplayPreset: "localized-short",
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

function resolveTableBehaviorConfig(
  providerConfig: ProviderTableConfig
): TableCatalogueTableConfig {
  return {
    allowCreate: providerConfig.allowCreate ?? true,
    allowEdit: providerConfig.allowEdit ?? true,
    allowDuplicate: providerConfig.allowDuplicate ?? true,
    allowDelete: providerConfig.allowDelete ?? true,
    allowBulkEdit: providerConfig.allowBulkEdit ?? true,
    allowBulkDelete: providerConfig.allowBulkDelete ?? true,
    allowInlineEdit: providerConfig.allowInlineEdit ?? true,
    showToolbar: providerConfig.showToolbar ?? true,
    showToolbarHeader: providerConfig.showToolbarHeader ?? true,
    export: providerConfig.export ?? true,
    bulkExport: providerConfig.bulkExport ?? true,
    actionsAsIcons: providerConfig.actionsAsIcons ?? false,
    density: normalizeDensityMode(providerConfig.density),
    enableRowSelection: providerConfig.enableRowSelection,
    enableRowClickEdit: providerConfig.enableRowClickEdit ?? false,
    enableColumnFilters: providerConfig.enableColumnFilters,
    enableSorting: providerConfig.enableSorting,
    enableGrouping: providerConfig.enableGrouping,
    enableColumnDnd: providerConfig.enableColumnDnd ?? true,
    enableColumnDragDropByDefault: providerConfig.enableColumnDragDropByDefault,
    enableMultiRowSelection: providerConfig.enableMultiRowSelection,
    enablePagination: providerConfig.enablePagination,
    defaultPageSize: providerConfig.defaultPageSize,
    pageSizeOptions: providerConfig.pageSizeOptions,
    dateDisplayPreset:
      providerConfig.dateDisplayPreset ??
      DEFAULT_TABLE_CONFIG.table.dateDisplayPreset,
    inlineEdit: resolveInlineEditConfig(providerConfig.inlineEdit),
  };
}

function resolveColumnsConfig(
  providerConfig: ProviderTableConfig
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
    sort: [],
    visible: visibleWithSelect,
    mandatory,
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

    if (!providerConfig) {
      return DEFAULT_TABLE_CONFIG;
    }

    // Transform DataTableConfig to TableCatalogueConfig
    const tableConfig: TableCatalogueConfig = {
      table: resolveTableBehaviorConfig(providerConfig),
      form: providerConfig.form,
      columns: resolveColumnsConfig(providerConfig),
      translations: {
        namespace: "common",
        keys: {},
      },
    };

    return tableConfig;
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
