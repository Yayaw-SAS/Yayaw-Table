/**
 * Configuration atoms for DataTable
 * Centralizes all configuration options in one place
 */
import { atom } from "jotai";
import { atomFamily } from "jotai-family";

import type { TableFormConfig } from "../config/form-config";

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
   * Enable toolbar CSV export button
   */
  export?: boolean;

  /**
   * Enable bulk CSV export action
   */
  bulkExport?: boolean;

  /**
   * Render toolbar action buttons as icons with tooltips
   */
  actionsAsIcons?: boolean;

  /**
   * Default page size
   */
  defaultPageSize: number;

  /**
   * Enable column drag and drop
   */
  enableColumnDragDropByDefault: boolean;

  /**
   * Enable the column drag & drop feature and UI (gate)
   * When false, the interface and actions to reorder columns are hidden/disabled
   */
  enableColumnDnd?: boolean;

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
  export: true,
  bulkExport: true,
  actionsAsIcons: false,
  defaultPageSize: 10,
  enableColumnDragDropByDefault: true,
  enableColumnDnd: true,
  enableColumnFilters: true,
  enableMultiRowSelection: true,
  enablePagination: true,
  enableRowDragDrop: false,
  enableRowSelection: true,
  enableSorting: true,
  enableGrouping: true,
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
