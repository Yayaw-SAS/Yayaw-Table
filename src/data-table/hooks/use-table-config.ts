/**
 * Hook for managing table configuration
 * Handles configuration retrieval, defaults, and translations
 */
'use client';

import type { ColumnSort } from '@tanstack/react-table';
import { useMemo } from 'react';
import {
  useTableConfig as useProviderTableConfig,
  useTranslations,
} from '../providers/table-provider';
import { useTableTranslations } from './use-table-translations';

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
  manualFiltering: boolean;
  manualPagination: boolean;
  manualSorting: boolean;
  enableColumnDragDropByDefault?: boolean;
  enableMultiRowSelection?: boolean;
  enablePagination?: boolean;
  defaultPageSize?: number;
  pageSizeOptions?: number[];
}

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
    manualFiltering: false,
    manualPagination: false,
    manualSorting: false,
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
    namespace: 'common',
    keys: {},
  },
};

/**
 * Hook for managing table configuration
 */
export function useTableConfig(tableType: string) {
  // Get configuration and translation providers
  const getTableConfig = useProviderTableConfig();
  const { t } = useTranslations();
  const baseTranslations = useTableTranslations();

  // Get table configuration with fallback to defaults
  const config = useMemo(() => {
    const providerConfig = getTableConfig?.(tableType);

    if (!providerConfig) {
      return DEFAULT_TABLE_CONFIG;
    }

         // Transform DataTableConfig to TableCatalogueConfig
     const tableConfig: TableCatalogueConfig = {
       table: {
         enableRowSelection: providerConfig.enableRowSelection,
         enableColumnFilters: providerConfig.enableColumnFilters,
         enableSorting: providerConfig.enableSorting,
         manualFiltering: providerConfig.manualFiltering,
         manualPagination: providerConfig.manualPagination,
         manualSorting: providerConfig.manualSorting,
         enableColumnDragDropByDefault: providerConfig.enableColumnDragDropByDefault,
         enableMultiRowSelection: providerConfig.enableMultiRowSelection,
         enablePagination: providerConfig.enablePagination,
         defaultPageSize: providerConfig.defaultPageSize,
         pageSizeOptions: providerConfig.pageSizeOptions,
       },
       columns: {
         definitions: [
           { id: "name", type: "text", header: "Product Name", enableSorting: true, enableColumnFilter: true },
           { id: "brand", type: "text", header: "Brand", enableSorting: true, enableColumnFilter: true },
           { id: "category", type: "tag", header: "Category", enableSorting: true, enableColumnFilter: true },
           { id: "price", type: "number", header: "Price", enableSorting: true, enableColumnFilter: true },
           { id: "status", type: "tag", header: "Status", enableSorting: true, enableColumnFilter: true },
           { id: "createdAt", type: "date", header: "Created", enableSorting: true, enableColumnFilter: true },
           { id: "isActive", type: "boolean", header: "Active", enableSorting: true, enableColumnFilter: true },
         ],
         order: [],
         sort: [],
         visible: [],
         mandatory: [],
       },
       translations: {
         namespace: 'common',
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
