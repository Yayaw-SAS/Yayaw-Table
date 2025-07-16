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
    const tableConfig = getTableConfig?.(tableType) as
      | TableCatalogueConfig
      | undefined;

    if (!tableConfig) {
      return DEFAULT_TABLE_CONFIG;
    }

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
