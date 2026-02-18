/**
 * Helper functions for defining and working with table configurations
 */

import type { DateDisplayPreset } from "../types/date-types";
import { defaultTableConfig, defaultTranslations } from "./defaults";
import type { TableFormConfig } from "./form-config";

/**
 * Supported editor types for inline cell editing.
 */
export type InlineEditEditor =
  | "auto"
  | "boolean"
  | "date"
  | "json"
  | "multiSelect"
  | "number"
  | "select"
  | "text"
  | "textarea"
  | "url";

/**
 * Option used by inline edit select editors.
 */
export interface InlineEditOption {
  label: string;
  value: boolean | number | string;
}

/**
 * Per-column inline editing configuration.
 */
export interface InlineEditColumnConfig {
  /**
   * Enable inline edit for this column.
   */
  enabled?: boolean;

  /**
   * Force a specific inline editor.
   */
  editor?: InlineEditEditor;

  /**
   * Debounce delay before auto-save, in milliseconds.
   */
  debounceMs?: number;

  /**
   * Optional form field name to use instead of column id.
   */
  formField?: string;

  /**
   * Options for select editor.
   */
  options?: InlineEditOption[];

  /**
   * Mark this column as read-only in inline mode.
   */
  readonly?: boolean;
}

/**
 * Table-level inline edit behavior.
 */
export interface TableInlineEditConfig {
  /**
   * Enable inline edit globally for the table.
   */
  enabled?: boolean;

  /**
   * Default debounce delay for inline edits, in milliseconds.
   */
  debounceMs?: number;

  /**
   * Inline edit trigger mode.
   */
  trigger?: "doubleClickEnter";

  /**
   * Whether optimistic cache updates are enabled.
   */
  optimistic?: boolean;

  /**
   * Whether to show the debounce progress indicator.
   */
  showDelayIndicator?: boolean;
}

/**
 * Column definition for a data table
 */
export interface ColumnDefinition {
  /**
   * Additional props for the column
   */
  [key: string]: unknown;

  /**
   * Custom cell renderer for the column
   */
  cellRenderer?: (
    value: unknown,
    row: Record<string, unknown>
  ) => React.ReactNode;

  /**
   * Whether the column can be filtered
   */
  enableFiltering?: boolean;

  /**
   * Whether the column can be sorted
   */
  enableSorting?: boolean;

  /**
   * Translation key for the column header
   */
  header: string;

  /**
   * Unique identifier for the column
   */
  id: string;

  /**
   * Type of column (text, number, date, boolean, code, select, etc.)
   * Used to determine how to render and filter the column.
   */
  type?:
    | "actions"
    | "boolean"
    | "code"
    | "custom"
    | "date"
    | "dynamicType"
    | "multiSelect"
    | "number"
    | "select"
    | "text"
    | "url";

  /**
   * Visual rendering variant for option-like columns.
   * Use "tag" to render a pill/badge style while keeping type as select/multiSelect.
   */
  displayVariant?: "default" | "tag";

  /**
   * Date display preset for date columns
   */
  dateDisplayPreset?: DateDisplayPreset;

  /**
   * Legacy date-fns format string for date columns
   */
  dateFormat?: string;

  /**
   * Inline edit configuration for this column.
   */
  inlineEdit?: boolean | InlineEditColumnConfig;

  /**
   * Optional map of tag value -> Tailwind class used by tag columns.
   */
  tagColorMap?: Record<string, string>;

  /**
   * Key that contains the type information for dynamicType columns
   * Only used when type is "dynamicType"
   */
  typeKey?: string;

  /**
   * Display mode for URL columns.
   * - "icon": clickable favicon/icon
   * - "domain": shortened to domain name
   * - "full": truncated full URL
   * Only used when type is "url"
   */
  urlDisplayMode?: "domain" | "full" | "icon" | "row-link";
}

/**
 * Configuration for the table behavior
 */
export interface TableBehaviorConfig {
  /**
   * Allow opening the create flow from table UI actions
   */
  allowCreate: boolean;

  /**
   * Allow row edit actions
   */
  allowEdit: boolean;

  /**
   * Allow row duplicate actions
   */
  allowDuplicate: boolean;

  /**
   * Allow row delete actions
   */
  allowDelete: boolean;

  /**
   * Allow bulk edit action
   */
  allowBulkEdit: boolean;

  /**
   * Allow bulk delete action
   */
  allowBulkDelete: boolean;

  /**
   * Allow inline editing
   */
  allowInlineEdit: boolean;

  /**
   * Show the table toolbar (search and actions)
   */
  showToolbar: boolean;

  /**
   * Show the toolbar header block (title and description)
   */
  showToolbarHeader: boolean;

  /**
   * Enable toolbar CSV export button
   */
  export: boolean;

  /**
   * Enable CSV export in bulk actions menu
   */
  bulkExport: boolean;

  /**
   * Render toolbar action buttons as icons with tooltips
   */
  actionsAsIcons: boolean;

  /**
   * Table density mode
   */
  density: "small" | "medium" | "large";

  /**
   * Default number of rows per page
   */
  defaultPageSize: number;

  /**
   * Enable drag and drop for columns
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
   * Enable selection of multiple rows
   */
  enableMultiRowSelection: boolean;

  /**
   * Enable pagination
   */
  enablePagination: boolean;

  /**
   * Enable row selection
   */
  enableRowSelection: boolean;

  /**
   * Enable sorting
   */
  enableSorting: boolean;

  /**
   * Available options in the page size selector
   */
  pageSizeOptions: number[];

  /**
   * Default date display preset for date columns in this table
   */
  dateDisplayPreset?: DateDisplayPreset;

  /**
   * Inline edit behavior configuration.
   */
  inlineEdit?: TableInlineEditConfig;
}

/**
 * Configuration for table columns
 */
export interface TableColumnsConfig {
  /**
   * Column definitions
   */
  definitions: ColumnDefinition[];

  /**
   * Columns that cannot be hidden by the user
   */
  mandatory: string[];

  /**
   * Default order of columns (left to right)
   */
  order: string[];

  /**
   * Default sorting configuration
   */
  sort?: Array<{ desc: boolean; id: string }>;

  /**
   * Columns that are visible by default
   */
  visible: string[];
}

/**
 * Complete configuration for a data table
 */
export interface TableConfig {
  /**
   * Configuration for table columns
   */
  columns: TableColumnsConfig;

  /**
   * Form configuration for the table
   */
  form?: TableFormConfig;

  /**
   * Icon name to use for the table
   */
  icon?: string;

  /**
   * Unique identifier for the table
   */
  id: string;

  /**
   * Configuration for the table behavior
   */
  table: TableBehaviorConfig;

  /**
   * Configuration for table translations
   */
  translations: TableTranslationsConfig;
}

/**
 * Configuration for table translations
 */
export interface TableTranslationsConfig {
  /**
   * Translation keys for this table
   */
  keys: Record<string, string>;

  /**
   * Namespace for translations specific to this table
   */
  namespace: string;
}

/**
 * Define a table configuration with defaults applied
 */
export function defineTableConfig(config: {
  columns: TableColumnsConfig;
  form?: TableFormConfig;
  icon?: string;
  id: string;
  table?: Partial<TableBehaviorConfig>;
  translations: TableTranslationsConfig;
}): TableConfig {
  // Merge the table behavior config with defaults
  const tableDefaults: TableBehaviorConfig = {
    ...defaultTableConfig,
    ...config.table,
    inlineEdit: {
      enabled:
        config.table?.inlineEdit?.enabled ??
        defaultTableConfig.inlineEdit?.enabled,
      debounceMs:
        config.table?.inlineEdit?.debounceMs ??
        defaultTableConfig.inlineEdit?.debounceMs,
      trigger:
        config.table?.inlineEdit?.trigger ??
        (defaultTableConfig.inlineEdit?.trigger as
          | "doubleClickEnter"
          | undefined),
      optimistic:
        config.table?.inlineEdit?.optimistic ??
        defaultTableConfig.inlineEdit?.optimistic,
      showDelayIndicator:
        config.table?.inlineEdit?.showDelayIndicator ??
        defaultTableConfig.inlineEdit?.showDelayIndicator,
    },
    dateDisplayPreset:
      config.table?.dateDisplayPreset ??
      (defaultTableConfig.dateDisplayPreset as DateDisplayPreset | undefined),
  };

  return {
    columns: {
      definitions: config.columns.definitions,
      mandatory: config.columns.mandatory,
      order: config.columns.order,
      sort: config.columns.sort || [],
      visible: config.columns.visible,
    },
    form: config.form,
    icon: config.icon,
    id: config.id,
    table: tableDefaults,
    translations: config.translations,
  };
}

/**
 * Get merged translations for a table
 */
export function getMergedTranslations(_tableConfig: TableConfig) {
  return {
    ...defaultTranslations,
    // Custom translations will be added by the useDataTable hook
  };
}
