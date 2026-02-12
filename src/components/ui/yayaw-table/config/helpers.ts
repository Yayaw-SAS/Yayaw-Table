/**
 * Helper functions for defining and working with table configurations
 */
import { defaultTableConfig, defaultTranslations } from "./defaults";
import type { TableFormConfig } from "./form-config";
import type { DateDisplayPreset } from "../types/date-types";

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
   * Type of column (text, number, date, boolean, code, tag, etc.)
   * Used to determine how to render and filter the column
   */
  type?:
    | "actions"
    | "boolean"
    | "code"
    | "custom"
    | "date"
    | "dynamicType"
    | "number"
    | "tag"
    | "text";

  /**
   * Date display preset for date columns
   */
  dateDisplayPreset?: DateDisplayPreset;

  /**
   * Legacy date-fns format string for date columns
   */
  dateFormat?: string;

  /**
   * Key that contains the type information for dynamicType columns
   * Only used when type is "dynamicType"
   */
  typeKey?: string;
}

/**
 * Configuration for the table behavior
 */
export interface TableBehaviorConfig {
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
