import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { useHydrateAtoms } from "jotai/utils";
import type React from "react";
import { createContext, type ReactNode, useContext, useMemo } from "react";
// Import atoms with correct paths
import {
  type DataTableColumnsConfig,
  type DataTableConfig,
  tableColumnsConfigAtom,
  tableConfigAtom,
} from "../atoms/config-atoms";
// Import form config type
import type { FieldValues, FormConfig } from "../components/forms/types";
import type { TableConfig } from "../config/helpers";
import type {
  DataTableTranslations,
  TranslationParams,
} from "../types/translations";
import { createTranslationFunction } from "./translation-cache";

// Define proper types for the helper functions
export interface TableActions {
  create?: (
    data: Record<string, unknown>
  ) => Promise<{ success: boolean; data?: unknown; error?: string }>;
  update?: (
    id: string,
    data: Record<string, unknown>
  ) => Promise<{ success: boolean; data?: unknown; error?: string }>;
  delete?: (
    id: string
  ) => Promise<{ success: boolean; data?: unknown; error?: string }>;
  list?: (params: Record<string, unknown>) => Promise<{
    data: unknown[];
    meta?: {
      pageCount?: number;
      totalCount?: number;
    };
  }>;
  duplicate?: (
    id: string
  ) => Promise<{ success: boolean; data?: unknown; error?: string }>;
  [key: string]: unknown;
}

interface TableProviderContextType {
  translations: DataTableTranslations;
  locale: string;
  t: (key: string, params?: TranslationParams) => string;
  getFormConfig?: <TFieldValues extends FieldValues = FieldValues>(
    formType: string
  ) => FormConfig<TFieldValues> | undefined;
  getTableActions?: (formType: string) => TableActions | undefined;
  getTableConfig?: (
    tableType: string
  ) => TableConfig | DataTableConfig | undefined;

  // UI Components for custom styling
  TitleComponent?: React.ComponentType<{
    children: React.ReactNode;
    className?: string;
  }>;
  DescriptionComponent?: React.ComponentType<{
    children: React.ReactNode;
    className?: string;
  }>;
}

const TableProviderContext = createContext<
  TableProviderContextType | undefined
>(undefined);

interface TableProviderProps {
  children: ReactNode;
  translations: DataTableTranslations;
  locale?: string;
  getFormConfig?: <TFieldValues extends FieldValues = FieldValues>(
    formType: string
  ) => FormConfig<TFieldValues> | undefined;
  getTableActions?: (formType: string) => TableActions | undefined;
  getTableConfig?: (
    tableType: string
  ) => TableConfig | DataTableConfig | undefined;

  // From data-table-ui-provider
  columnsConfig?: Partial<DataTableColumnsConfig>;
  tableConfig?: Partial<DataTableConfig>;
  tableId: string;

  // Optional QueryClient - create one if not provided
  queryClient?: QueryClient;

  // Custom UI components
  TitleComponent?: React.ComponentType<{
    children: React.ReactNode;
    className?: string;
  }>;
  DescriptionComponent?: React.ComponentType<{
    children: React.ReactNode;
    className?: string;
  }>;
}

// Note: Translation functions moved to separate translation-cache.ts file for optimization

export function TableProvider({
  children,
  translations,
  locale = "en",
  getFormConfig,
  getTableActions,
  getTableConfig,
  columnsConfig,
  tableConfig,
  tableId: _tableId,
  queryClient,
  TitleComponent,
  DescriptionComponent,
}: TableProviderProps) {
  // Create optimized translation function using cache
  const t = useMemo(
    () => createTranslationFunction(translations),
    [translations]
  );

  // Create default QueryClient if none provided
  const defaultQueryClient = useMemo(
    () =>
      queryClient ||
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            refetchOnWindowFocus: false,
          },
        },
      }),
    [queryClient]
  );

  // Prepare table configuration (from data-table-ui-provider)
  const defaultTableConfig = useAtomValue(tableConfigAtom);
  const mergedTableConfig = useMemo(() => {
    return tableConfig
      ? { ...defaultTableConfig, ...tableConfig }
      : defaultTableConfig;
  }, [defaultTableConfig, tableConfig]);

  // Prepare columns configuration (from data-table-ui-provider)
  const defaultColumnsConfig = useAtomValue(tableColumnsConfigAtom);
  const mergedColumnsConfig = useMemo(() => {
    return columnsConfig
      ? { ...defaultColumnsConfig, ...columnsConfig }
      : defaultColumnsConfig;
  }, [defaultColumnsConfig, columnsConfig]);

  // Hydrate all atoms with the provided values
  useHydrateAtoms([
    [tableConfigAtom, mergedTableConfig],
    [tableColumnsConfigAtom, mergedColumnsConfig],
  ]);

  // Stabilize the context value to prevent unnecessary re-renders
  const value = useMemo(
    () => ({
      translations,
      locale,
      t,
      getFormConfig,
      getTableActions,
      getTableConfig,
      TitleComponent,
      DescriptionComponent,
    }),
    [
      translations,
      locale,
      t,
      getFormConfig,
      getTableActions,
      getTableConfig,
      TitleComponent,
      DescriptionComponent,
    ]
  );

  return (
    <QueryClientProvider client={defaultQueryClient}>
      <TableProviderContext.Provider value={value}>
        {children}
      </TableProviderContext.Provider>
    </QueryClientProvider>
  );
}

/**
 * Hook to use translations in components
 */
export function useTranslations() {
  const context = useContext(TableProviderContext);

  if (context === undefined) {
    throw new Error("useTranslations must be used within a TableProvider");
  }

  return context;
}

/**
 * Hook to get the current locale
 */
export function useLocale() {
  const context = useContext(TableProviderContext);

  if (context === undefined) {
    throw new Error("useLocale must be used within a TableProvider");
  }

  return context.locale;
}

/**
 * Hook to get form configuration
 */
export function useFormConfig() {
  const context = useContext(TableProviderContext);

  if (context === undefined) {
    throw new Error("useFormConfig must be used within a TableProvider");
  }

  return context.getFormConfig;
}

/**
 * Hook to get table actions
 */
export function useTableActions() {
  const context = useContext(TableProviderContext);

  if (context === undefined) {
    throw new Error("useTableActions must be used within a TableProvider");
  }

  return context.getTableActions;
}

/**
 * Hook to get table configuration
 */
export function useTableConfig() {
  const context = useContext(TableProviderContext);

  if (context === undefined) {
    throw new Error("useTableConfig must be used within a TableProvider");
  }

  return context.getTableConfig;
}

/**
 * Hook to get custom UI components
 */
export function useTableComponents() {
  const context = useContext(TableProviderContext);

  if (context === undefined) {
    throw new Error("useTableComponents must be used within a TableProvider");
  }

  return {
    TitleComponent: context.TitleComponent,
    DescriptionComponent: context.DescriptionComponent,
  };
}

/**
 * Default English translations
 */
export const defaultTranslations: DataTableTranslations = {
  actions: {
    delete: "Delete",
    edit: "Edit",
    copy: "Copy",
    save: "Save",
    cancel: "Cancel",
    confirm: "Confirm",
    title: "Actions",
    view: "View",
  },
  bulk: {
    close_menu: "Close bulk actions menu",
    confirm_copy_description:
      "You are about to copy {count} {count, plural, one {item} other {items}}.",
    confirm_delete_description: "This action cannot be undone.",
    confirm_title:
      "{action} {count} {count, plural, one {item} other {items}}?",
  },
  columns: {
    title: "Columns",
    hide: "Hide column",
    show: "Show column",
    visible: "Visible columns",
    hidden: "Hidden columns",
    drag: "Drag {column} column",
    resetOrder: "Reset column order",
    toggleVisibility: "Toggle columns",
    hideAll: "Hide all columns",
    showAll: "Show all columns",
    edit_property: "Edit Property",
    filter: "Filter",
    hide_in_view: "Hide in View",
    reorder: "Drag to Reorder",
    sort_ascending: "Sort Ascending",
    sort_descending: "Sort Descending",
  },
  common: {
    true: "True",
    false: "False",
    loading: "Loading...",
    error: "Error",
    success: "Success",
    reset: "Reset",
    search: "Search",
  },
  filters: {
    title: "Filters",
    add: "Add filter",
    remove: "Remove filter",
    apply: "Apply filters",
    clear: "Clear filters",
    select_all: "Select all",
    noResults: "No results found",
    noFilters: "No filters applied",
    search: "Search {filter}...",
    selectedCount: "{count} {count, plural, one {selected} other {selected}}",
    active_count:
      "{count} {count, plural, one {active filter} other {active filters}}",
    column: "Column",
    value: "Value",
    value_to: "Value to",
    select_operator: "Select operator",
    error: "Filter error",
    operators: {
      contains: "Contains",
      equals: "Equals",
      starts_with: "Starts with",
      ends_with: "Ends with",
      not_contains: "Does not contain",
      empty: "Is empty",
      not_empty: "Is not empty",
      greater_than: "Greater than",
      less_than: "Less than",
      greater_than_or_equal: "Greater than or equal",
      less_than_or_equal: "Less than or equal",
      between: "Between",
      not_equals: "Not equals",
      is: "Is",
      is_not: "Is not",
      is_any_of: "Is any of",
      is_none_of: "Is none of",
      contains_all: "Contains all",
      contains_none: "Contains none",
      before: "Before",
      after: "After",
      on_or_before: "On or before",
      on_or_after: "On or after",
    },
    types: {
      text: "Text",
      number: "Number",
      date: "Date",
      option: "Option",
      multiOption: "Multiple options",
    },
    date_shortcuts: {
      today: "Today",
      yesterday: "Yesterday",
      last_7_days: "Last 7 days",
      last_30_days: "Last 30 days",
      this_month: "This month",
    },
    advanced: {
      title: "Advanced filters",
      basic_title: "Basic filters",
      convert_to_advanced: "Convert to advanced filter",
      filter_options: "Filter options",
      edit_filter: "Edit filter",
      enable_filter: "Enable filter",
      disable_filter: "Disable filter",
      edit_filter_for: "Edit filter for {column}",
      editing: "Editing",
      done: "Done",
      reset_filters: "Reset filters",
      empty_description: "Add filters to narrow down the results.",
      add_first_filter: "Add your first filter to get started.",
      quick_start: "Quick start",
      quick_start_search: "Search specific columns",
      quick_start_status: "Filter by status",
      quick_start_date: "Limit by date range",
      load_error_title: "Could not load filters",
      load_error_description:
        "There was a problem loading advanced filters. Please retry.",
      retry: "Try again",
      results_count: "{count} results",
      no_results_with_search:
        'No items match "{search}" with the current filters.',
      no_results_description: "No items match the current filter criteria.",
      adjust_filters_hint: "Try adjusting your filters or search terms.",
      modify_filters: "Modify filters",
      filtered_in: "Filtered in {time}",
      search_columns: "Search columns...",
      no_columns_found: "No columns found",
      no_columns_available: "No columns available",
      no_popular_filters: "No popular filters available",
      no_recent_filters: "No recent filters",
      try_different_search: "Try a different search term.",
      add_column: "Add {column}",
      active: "Active",
      activate: "Activate",
      off: "Off",
    },
    faceted: {
      sort_by_label: "Sort by label",
      sort_by_count: "Sort by count",
      sort_by_value: "Sort by value",
      sort_by_trending: "Sort by trending",
      selected_of_total: "{selected} of {total} selected",
      options_count: "{count} options",
      select_all: "Select all",
      select_none: "Select none",
      top_5: "Top 5",
      trending: "Trending",
      no_options_found: "No options found",
      no_options_available: "No options available",
      try_different_search: "Try a different search term.",
      no_data_for_filter: "No data available for this filter.",
      statistics: "Statistics",
      options: "Options",
      records: "Records",
      coverage: "Coverage: {percentage}% of data",
    },
    add_menu: {
      all: "All",
      popular: "Popular",
      recent: "Recent",
      clear_search_hint: "Clear search to see all columns",
      navigate_hint: "Use arrow keys to navigate",
      categories: {
        recent: "Recently used",
        popular: "Popular",
        text: "Text fields",
        number: "Number fields",
        date: "Date fields",
        option: "Selection fields",
      },
    },
    presets: {
      title: "Presets",
      panel_title: "Filter presets",
      share: "Share",
      duplicate: "Duplicate",
      load: "Load",
      used_times: "Used {count} times",
      last_used: "Last: {date}",
      save_dialog_title: "Save filter preset",
      save_dialog_description: "Save your current filters to reuse them later.",
      name_label: "Name",
      name_placeholder: "My preset",
      description_label: "Description",
      description_placeholder: "What does this preset filter?",
      tags_label: "Tags",
      tags_placeholder: "tag1, tag2, tag3",
      make_public: "Make preset public",
      no_active_filters_to_save: "Add at least one active filter to save.",
      save_preset: "Save preset",
      saving: "Saving...",
      delete_title: "Delete preset",
      delete_description:
        "Are you sure you want to delete this preset? This action cannot be undone.",
      save_current: "Save current filters",
      import: "Import",
      export_all: "Export all",
      search_placeholder: "Search presets...",
      no_presets_found: "No presets found",
      try_different_search: "Try a different search term.",
      create_first_hint: "Create your first preset from current filters.",
      save_first: "Save first preset",
      tabs: {
        all: "All",
        recent: "Recent",
        popular: "Popular",
        system: "System",
      },
    },
  },
  pagination: {
    first: "Go to first page",
    last: "Go to last page",
    next: "Go to next page",
    previous: "Go to previous page",
    of: "of",
    page: "Page",
    rowsPerPage: "Rows per page",
    showing:
      "Showing page {page} of {total} {total, plural, one {page} other {pages}}",
    selectedCount:
      "{selected} of {total} {total, plural, one {row} other {rows}} selected",
  },
  search: {
    placeholder: "Search...",
  },
  selection: {
    rows: "{count} {count, plural, one {row} other {rows}} selected",
  },
  sorting: {
    ascending: "Sort ascending",
    descending: "Sort descending",
    choose_column: "Select column",
    current: "Current sort",
  },
  views: {
    title: "Views",
    current: "Current View",
    save: "Save View",
    saveAs: "Save as new view",
    update: "Update view",
    delete: "Delete view",
    rename: "Rename view",
    setDefault: "Set as default",
    defaultView: "Default View",
    default_system_view: "Default System View",
    systemView: "System View",
    custom_view: "Custom View",
    temporary_view: "Temporary View",
    viewName: "View Name",
    noViews: "No saved views",
    confirmDelete: "Are you sure you want to delete this view?",
    confirmDeleteWithName: "Are you sure you want to delete the view '{name}'?",
    manage: "Manage Views",
    saveChanges: "Save changes",
    saveChangesTooltip: "Save changes made to this view",
    add_view: "Add view",
    view_options: "View options",
    view_name: "View name",
    cannot_delete_system_view: "Cannot delete system view",
    cannot_update_system_view: "Cannot update system view",
    view_created_successfully: "View created successfully",
    view_updated_successfully: "View updated successfully",
    view_deleted_successfully: "View deleted successfully",
    error_saving_view: "Error saving view",
    error_updating_view: "Error updating view",
    error_deleting_view: "Error deleting view",
    error_loading_views: "Error loading views",
    history: {
      undo: "Undo change",
      redo: "Redo change",
      nothing_to_undo: "Nothing to undo",
      nothing_to_redo: "Nothing to redo",
    },
    notifications: {
      created: "View created successfully",
      updated: "View updated successfully",
      deleted: "View deleted successfully",
      setAsDefault: "View set as default successfully",
      error: {
        create: "Failed to create view",
        update: "Failed to update view",
        delete: "Failed to delete view",
        setDefault: "Failed to set view as default",
      },
    },
    dialog: {
      save: {
        title: "Save View",
        description: "Save your current configuration as a custom view",
        name: "Name",
        namePlaceholder: "My custom view",
        default: "Set as default view",
        global: "Make this view global",
        save: "Save",
        saving: "Saving...",
      },
      manage: {
        title: "Manage Views",
        description: "Manage your saved table views",
        name: "Name",
        type: "Type",
        created: "Created",
        actions: "Actions",
        rename: "Rename view",
        delete: "Delete view",
        setDefault: "Set as default",
        editColumns: "Edit Columns",
        stopEdit: "Stop Editing",
        editSystemViewWarning: "(Will create a new view)",
      },
    },
  },
  state: {
    loading: "Loading data...",
    noData: "No data available",
    error: "Error loading data",
    error_description: "An error occurred: {message}",
  },
  url_state: {
    copy_link: "Copy link",
    link_copied: "Link copied to clipboard",
    reset: "Reset filters",
    share: "Share this view",
    auto_save: "Auto-saving...",
    save_success: "View saved successfully",
  },
  demo: {
    title: "URL Table Demo",
    copy_url: "Copy URL",
    save_view: "Save View",
    reset: "Reset",
    view: "View",
    sort_by: "Sort by",
    select_view: "Select a view",
    select_sort: "Select sorting",
    view_name_placeholder: "Enter view name",
    save: "Save",
    current_state: "Current State",
    data: "Data",
    loading: "Loading...",
    name_asc: "Name (A-Z)",
    name_desc: "Name (Z-A)",
    date_asc: "Date (oldest first)",
    date_desc: "Date (newest first)",
  },
  table: {
    no_results: "No results found",
    no_results_description: "No data matches your current filters",
    hide_column: "Hide column",
    show_column: "Show column",
    toggle_columns: "Toggle columns",
    selected_rows: "{count} {count, plural, one {row} other {rows}} selected",
    sort_ascending: "Sort ascending",
    sort_descending: "Sort descending",
    drag_column: "Drag column",
  },
  menu: {
    back: "Back",
    columns: "Columns",
    columns_visible: "{count} {count, plural, one {visible} other {visibles}}",
    filter: "Filter",
    filters: "Filters",
    group: "Group",
    select_column: "Select column",
    current_groups:
      "{count, plural, one {Current group} other {Current groups}}",
    active_groups:
      "{count} {count, plural, one {active group} other {active groups}}",
    options: "Options",
    properties: "Properties",
    sort: "Sort",
    subgroup: "Subgroup",
    title: "Options",
    reset_all: "Reset all",
    reset_all_description:
      "Clear filters, sort, grouping, and show all columns",
  },
  add_an_item: "Add Item",
};
