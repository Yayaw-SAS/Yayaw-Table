/**
 * Configuration atoms for DataTable
 * Centralizes all configuration options in one place
 */
import { atom } from 'jotai';
import { atomFamily } from 'jotai/utils';

import type { TableFormConfig } from '../config/form-config';

/**
 * Interface for column-specific configuration options
 */
export interface DataTableColumnsConfig {
  /**
   * Default column order
   */
  defaultColumnOrder: string[];

  /**
   * Default sort configuration
   */
  defaultSort: { desc: boolean; id: string }[];

  /**
   * Default visible columns
   */
  defaultVisibleColumns: string[];

  /**
   * Columns that cannot be hidden
   */
  mandatoryColumns: string[];
}

/**
 * Interface for general DataTable configuration options
 */
export interface DataTableConfig {
  /**
   * Default page size
   */
  defaultPageSize: number;

  /**
   * Enable column drag and drop
   */
  enableColumnDragDropByDefault: boolean;

  /**
   * Enable column filters
   */
  enableColumnFilters: boolean;

  /**
   * Enable column pinning
   */
  enableColumnPinning?: boolean;

  /**
   * Enable multi-row selection
   */
  enableMultiRowSelection: boolean;

  /**
   * Enable pagination
   */
  enablePagination: boolean;

  /**
   * Enable row drag and drop
   */
  enableRowDragDrop: boolean;

  /**
   * Enable row selection
   */
  enableRowSelection: boolean;

  /**
   * Enable sorting
   */
  enableSorting: boolean;

  /**
   * Enable grouping
   */
  enableGrouping?: boolean;

  /**
   * Form configuration
   */
  form?: TableFormConfig;

  /**
   * Enable manual filtering (server-side)
   */
  manualFiltering: boolean;

  /**
   * Enable manual pagination (server-side)
   */
  manualPagination: boolean;

  /**
   * Enable manual sorting (server-side)
   */
  manualSorting: boolean;

  /**
   * Available page size options
   */
  pageSizeOptions: number[];

  /**
   * Translations for the table
   */
  translations?: {
    keys: Record<string, string>;
    namespace: string;
  };
}

/**
 * Default table configuration
 */
const defaultTableConfig: DataTableConfig = {
  defaultPageSize: 10,
  enableColumnDragDropByDefault: true,
  enableColumnFilters: true,
  enableMultiRowSelection: true,
  enablePagination: true,
  enableRowDragDrop: false,
  enableRowSelection: true,
  enableSorting: true,
  enableGrouping: true,
  manualFiltering: false,
  manualPagination: false,
  manualSorting: false,
  pageSizeOptions: [5, 10, 20, 50, 100],
};

/**
 * Default columns configuration
 */
const defaultColumnsConfig: DataTableColumnsConfig = {
  defaultColumnOrder: [],
  defaultSort: [],
  defaultVisibleColumns: [],
  mandatoryColumns: [],
};

/**
 * Atom for the default table configuration
 */
export const tableConfigAtom = atom<DataTableConfig>(defaultTableConfig);

/**
 * Atom family for table-specific configurations
 * This allows different tables to have different configurations
 */
export const tableConfigFamilyAtom = atomFamily(
  (_tableId: string) => atom<DataTableConfig>(defaultTableConfig),
  (a, b) => a === b
);

/**
 * Atom for the default columns configuration
 */
export const tableColumnsConfigAtom =
  atom<DataTableColumnsConfig>(defaultColumnsConfig);

/**
 * Atom family for table-specific column configurations
 * This allows different tables to have different column configurations
 */
export const tableColumnsConfigFamilyAtom = atomFamily(
  (_tableId: string) => atom<DataTableColumnsConfig>(defaultColumnsConfig),
  (a, b) => a === b
);
