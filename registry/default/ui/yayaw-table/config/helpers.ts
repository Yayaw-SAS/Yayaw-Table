/**
 * Helper functions for defining and working with table configurations
 */

import type { DateDisplayPreset } from "../types/date-types";
import type {
  TableDisplayMode,
  TableGalleryConfig,
  TableKanbanConfig,
} from "../types/display-types";
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
 * High-level layout preset for common table surfaces.
 */
export type TableLayoutPreset = "admin" | "catalog" | "default" | "preview";

/**
 * Row click behavior used by table rows.
 */
export type TableRowClickMode =
  | "activate"
  | "default"
  | "edit"
  | "link"
  | "none";

/**
 * Empty/no-results state override for a table.
 */
export interface TableEmptyStateConfig {
  /**
   * Description shown below the empty-state title.
   */
  description?: string;

  /**
   * Whether the empty-state row should be rendered.
   */
  show?: boolean;

  /**
   * Title shown when the table has no rows.
   */
  title?: string;
}

export function resolveTableLayoutPreset(
  layoutPreset: TableLayoutPreset | undefined
): TableLayoutPreset {
  if (
    layoutPreset === "admin" ||
    layoutPreset === "catalog" ||
    layoutPreset === "preview"
  ) {
    return layoutPreset;
  }

  return "default";
}

export function getTableLayoutPresetDefaults(
  layoutPreset: TableLayoutPreset
): Partial<TableBehaviorConfig> {
  if (layoutPreset === "admin") {
    return {
      actionsAsIcons: true,
      defaultPageSize: 20,
      density: "small",
      pageSizeOptions: [10, 20, 50, 100],
    };
  }

  if (layoutPreset === "catalog") {
    return {
      actionsAsIcons: true,
      defaultPageSize: 20,
      density: "medium",
      pageSizeOptions: [10, 20, 50],
    };
  }

  if (layoutPreset === "preview") {
    return {
      actionsAsIcons: true,
      defaultPageSize: 20,
      density: "small",
      pageSizeOptions: [10, 20, 50],
      showToolbarHeader: false,
    };
  }

  return {};
}

const TABLE_DISPLAY_MODES: TableDisplayMode[] = ["table", "kanban", "gallery"];

export function resolveTableDisplayModes(
  displayModes: TableDisplayMode[] | undefined
): TableDisplayMode[] {
  const resolvedModes = (displayModes ?? ["table"]).filter(
    (mode, index, modes): mode is TableDisplayMode => {
      return (
        TABLE_DISPLAY_MODES.includes(mode) && modes.indexOf(mode) === index
      );
    }
  );

  return resolvedModes.length > 0 ? resolvedModes : ["table"];
}

export function resolveTableDisplayMode({
  allowedModes,
  displayMode,
}: {
  allowedModes: TableDisplayMode[];
  displayMode?: TableDisplayMode;
}): TableDisplayMode {
  if (displayMode && allowedModes.includes(displayMode)) {
    return displayMode;
  }

  return allowedModes[0] ?? "table";
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
   * Whether the column can be used as a table or Kanban grouping field.
   */
  enableGrouping?: boolean;

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
    | "image"
    | "json"
    | "multiSelect"
    | "number"
    | "select"
    | "string"
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
   * Preferred column width in pixels.
   */
  size?: number;

  /**
   * Minimum allowed column width in pixels.
   */
  minSize?: number;

  /**
   * Maximum allowed column width in pixels.
   */
  maxSize?: number;

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

  /**
   * Whether to enable footer calculations for this column.
   * @default true
   */
  enableCalculation?: boolean;

  /**
   * Default calculation to show in the footer for this column.
   * If set, the footer will display this calculation on first load
   * (until the user explicitly changes it).
   * @example "sum" for a price column, "count_all" for any column
   */
  defaultCalculation?:
    | "average"
    | "count_all"
    | "count_empty"
    | "count_not_empty"
    | "count_true"
    | "count_false"
    | "count_unique"
    | "count_values"
    | "max"
    | "median"
    | "min"
    | "percent_empty"
    | "percent_not_empty"
    | "percent_true"
    | "percent_false"
    | "range"
    | "sum";
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
   * Allow users to create, update, and delete saved table views.
   */
  allowViewSave?: boolean;

  /**
   * Allow users to save views as shared team views.
   */
  allowViewSharing?: boolean;

  /**
   * Row-aware guard for standard edit actions.
   * Return false to disable the built-in edit action for that row.
   */
  canEditRow?: (row: Record<string, unknown>) => boolean;

  /**
   * Row-aware guard for standard delete actions.
   * Return false to disable the built-in delete action for that row.
   */
  canDeleteRow?: (row: Record<string, unknown>) => boolean;

  /**
   * Row-aware guard for standard duplicate actions.
   * Return false to disable the built-in duplicate action for that row.
   */
  canDuplicateRow?: (row: Record<string, unknown>) => boolean;

  /**
   * Row-aware guard for selection checkboxes.
   * Return false to prevent selecting that row.
   */
  canSelectRow?: (row: Record<string, unknown>) => boolean;

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
   * Opinionated layout preset for common admin/catalog surfaces.
   */
  layoutPreset?: TableLayoutPreset;

  /**
   * Display modes available to users.
   */
  displayModes?: TableDisplayMode[];

  /**
   * Display mode used when no URL/view state overrides it.
   */
  defaultDisplayMode?: TableDisplayMode;

  /**
   * Kanban display mode configuration.
   */
  kanban?: TableKanbanConfig;

  /**
   * Gallery display mode configuration.
   */
  gallery?: TableGalleryConfig;

  /**
   * Empty/no-results state behavior.
   */
  emptyState?: TableEmptyStateConfig;

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
   * Enable saved table views in the toolbar header
   */
  enableViews?: boolean;

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

  /**
   * Enable footer row with column calculations (sum, count, average, etc.)
   * @default false
   */
  enableCalculations?: boolean;
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
  const layoutPreset = resolveTableLayoutPreset(config.table?.layoutPreset);
  const layoutPresetDefaults = getTableLayoutPresetDefaults(layoutPreset);

  // Merge the table behavior config with defaults
  const tableDefaults: TableBehaviorConfig = {
    ...defaultTableConfig,
    ...layoutPresetDefaults,
    ...config.table,
    layoutPreset,
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
    emptyState: {
      ...defaultTableConfig.emptyState,
      ...config.table?.emptyState,
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
