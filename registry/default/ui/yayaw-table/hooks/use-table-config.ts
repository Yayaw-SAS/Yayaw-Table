/**
 * Hook for managing table configuration
 * Handles configuration retrieval, defaults, and translations
 */
"use client";

import type { ColumnSort } from "@tanstack/react-table";
import { useMemo } from "react";
import {
  useTableConfig as useProviderTableConfig,
  useTranslations,
} from "../providers/table-provider";
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
  typeKey?: string;
  customRenderers?: Record<string, (value: unknown) => React.ReactNode>;
}

/**
 * Configuration for table behavior in the catalogue
 */
export interface TableCatalogueTableConfig {
  enableRowSelection: boolean;
  enableColumnFilters: boolean;
  enableSorting: boolean;
  enableGrouping?: boolean;
  manualFiltering: boolean;
  manualPagination: boolean;
  manualSorting: boolean;
  /** Gate for column DnD feature and UI */
  enableColumnDnd?: boolean;
  enableColumnDragDropByDefault?: boolean;
  enableMultiRowSelection?: boolean;
  enablePagination?: boolean;
  defaultPageSize?: number;
  pageSizeOptions?: number[];
}

/**
 * Shape returned by getTableConfig: table options plus optional columns.
 * Used when normalizing provider config to TableCatalogueConfig.
 */
type ProviderTableConfig = TableCatalogueTableConfig & {
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
    enableRowSelection: true,
    enableColumnFilters: true,
    enableSorting: true,
    enableGrouping: true,
    manualFiltering: false,
    manualPagination: false,
    manualSorting: false,
    enableColumnDnd: true,
    enableColumnDragDropByDefault: false,
    enableMultiRowSelection: true,
    enablePagination: true,
    defaultPageSize: 10,
    pageSizeOptions: [5, 10, 20, 50],
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
      table: {
        enableRowSelection: providerConfig.enableRowSelection,
        enableColumnFilters: providerConfig.enableColumnFilters,
        enableSorting: providerConfig.enableSorting,
        enableGrouping: providerConfig.enableGrouping,
        manualFiltering: providerConfig.manualFiltering,
        manualPagination: providerConfig.manualPagination,
        manualSorting: providerConfig.manualSorting,
        enableColumnDnd: providerConfig.enableColumnDnd ?? true,
        enableColumnDragDropByDefault:
          providerConfig.enableColumnDragDropByDefault,
        enableMultiRowSelection: providerConfig.enableMultiRowSelection,
        enablePagination: providerConfig.enablePagination,
        defaultPageSize: providerConfig.defaultPageSize,
        pageSizeOptions: providerConfig.pageSizeOptions,
      },
      columns: (() => {
        const definitions = providerConfig?.columns?.definitions || [];
        const order = providerConfig?.columns?.order || [];
        const visible = providerConfig?.columns?.visible || [];
        const mandatory = providerConfig?.columns?.mandatory || [];
        const enableRowSelection = providerConfig.enableRowSelection !== false;

        const orderWithSelect =
          enableRowSelection && !order.includes("select")
            ? ["select", ...order]
            : order;
        const visibleWithSelect =
          enableRowSelection && !visible.includes("select")
            ? ["select", ...visible]
            : visible;

        return {
          definitions,
          order: orderWithSelect,
          sort: [],
          visible: visibleWithSelect,
          mandatory,
        };
      })(),
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
