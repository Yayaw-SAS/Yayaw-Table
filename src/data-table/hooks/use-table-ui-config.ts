/**
 * Hook for accessing DataTable UI configuration
 * Provides access to translations, table options, and column configurations
 */
'use client';

import { useAtomValue } from 'jotai';

import {
  type DataTableColumnsConfig,
  type DataTableConfig,
  tableColumnsConfigFamilyAtom,
  tableConfigFamilyAtom,
} from '../atoms/config-atoms';
import {
  type DataTableTranslations,
  resolvedTranslationsAtom,
} from '../atoms/i18n-atoms';

interface UseTableUIConfigResult {
  /**
   * Column configuration options
   */
  columnsConfig: DataTableColumnsConfig;

  /**
   * Table configuration options
   */
  tableConfig: DataTableConfig;

  /**
   * Fully resolved translations
   */
  translations: DataTableTranslations;
}

/**
 * Hook to access all UI-related configurations for a specific table
 * @param tableId - The ID of the table to get configurations for
 * @returns Object containing translations, table config, and columns config
 */
export function useTableUIConfig(
  tableId = 'default-table'
): UseTableUIConfigResult {
  // Get table-specific column configuration
  const columnsConfig = useAtomValue(tableColumnsConfigFamilyAtom(tableId));

  // Get table-specific configuration
  const tableConfig = useAtomValue(tableConfigFamilyAtom(tableId));

  // Get resolved translations
  const translations = useAtomValue(resolvedTranslationsAtom);

  return {
    columnsConfig,
    tableConfig,
    translations,
  };
}
