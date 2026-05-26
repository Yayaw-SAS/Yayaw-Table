/**
 * Configuration atoms for DataTable
 * Centralizes all configuration options in one place
 */
import { atom } from "jotai";
import { atomFamily } from "jotai-family";

import type {
  TableEmptyStateConfig,
  TableInlineEditConfig,
  TableLayoutPreset,
  TableRowClickMode,
} from "../config/helpers";
import type { TableFormConfig } from "../config/form-config";
import type { DateDisplayPreset } from "../types/date-types";

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
   * Allow opening the create flow from table UI actions
   */
  allowCreate?: boolean;

  /**
   * Allow row edit actions
   */
  allowEdit?: boolean;

  /**
   * Allow row duplicate actions
   */
  allowDuplicate?: boolean;

  /**
   * Allow row delete actions
   */
  allowDelete?: boolean;

  /**
   * Allow bulk edit action
   */
  allowBulkEdit?: boolean;

  /**
   * Allow bulk delete action
   */
  allowBulkDelete?: boolean;

  /**
   * Allow inline editing
   */
  allowInlineEdit?: boolean;

  /**
   * Show the table toolbar (search and actions)
   */
  showToolbar?: boolean;

  /**
   * Show the toolbar header block (title and description)
   */
  showToolbarHeader?: boolean;

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
   * Table density mode
   */
  density?: "small" | "medium" | "large";

  /**
   * Opinionated layout preset for common table surfaces.
   */
  layoutPreset?: TableLayoutPreset;

  /**
   * Empty/no-results state behavior.
   */
  emptyState?: TableEmptyStateConfig;

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
   * Open the edit drawer when a row is clicked.
   * Incompatible with URL columns configured with `urlDisplayMode: "row-link"`.
   * Incompatible with inline edit (`table.inlineEdit` / column `inlineEdit`).
   */
  enableRowClickEdit?: boolean;

  /**
   * Generic row click behavior. The default preserves legacy row-link/edit behavior.
   */
  rowClickMode?: TableRowClickMode;

  /**
   * Enable sorting
   */
  enableSorting: boolean;

  /**
   * Enable footer calculations (sum, count, average, etc.)
   */
  enableCalculations?: boolean;

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
   * Default date display preset for date columns in this table
   */
  dateDisplayPreset?: DateDisplayPreset;

  /**
   * Inline edit behavior configuration
   */
  inlineEdit?: TableInlineEditConfig;

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
  layoutPreset: "default",
  emptyState: {
    show: true,
  },
  defaultPageSize: 10,
  enableColumnDragDropByDefault: true,
  enableColumnDnd: true,
  enableColumnFilters: true,
  enableMultiRowSelection: true,
  enablePagination: true,
  enableRowDragDrop: false,
  enableRowSelection: true,
  enableRowClickEdit: false,
  rowClickMode: "default",
  enableSorting: true,
  enableCalculations: false,
  enableGrouping: true,
  inlineEdit: {
    enabled: false,
    debounceMs: 700,
    trigger: "doubleClickEnter",
    optimistic: true,
    showDelayIndicator: true,
  },
  dateDisplayPreset: "localized-short",
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
