import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAtomValue } from 'jotai';
import { useHydrateAtoms } from 'jotai/utils';
import type React from 'react';
import { createContext, type ReactNode, useContext, useMemo } from 'react';
import type { TableConfig } from '../config/helpers';
import type { FieldValues } from 'react-hook-form';
// Import atoms with correct paths
import {
  type DataTableColumnsConfig,
  type DataTableConfig,
  tableColumnsConfigAtom,
  tableConfigAtom,
} from '../atoms/config-atoms';
// Import form config type
import type { FormConfig } from '../components/forms/types';
import type {
  DataTableTranslations,
  TranslationParams,
} from '../types/translations';
import { createTranslationFunction } from './translation-cache';

// Define proper types for the helper functions
export type TableActions = {
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
};

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
  locale = 'en',
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
  const t = useMemo(() => createTranslationFunction(translations), [translations]);

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
    throw new Error('useTranslations must be used within a TableProvider');
  }

  return context;
}

/**
 * Hook to get the current locale
 */
export function useLocale() {
  const context = useContext(TableProviderContext);

  if (context === undefined) {
    throw new Error('useLocale must be used within a TableProvider');
  }

  return context.locale;
}

/**
 * Hook to get form configuration
 */
export function useFormConfig() {
  const context = useContext(TableProviderContext);

  if (context === undefined) {
    throw new Error('useFormConfig must be used within a TableProvider');
  }

  return context.getFormConfig;
}

/**
 * Hook to get table actions
 */
export function useTableActions() {
  const context = useContext(TableProviderContext);

  if (context === undefined) {
    throw new Error('useTableActions must be used within a TableProvider');
  }

  return context.getTableActions;
}

/**
 * Hook to get table configuration
 */
export function useTableConfig() {
  const context = useContext(TableProviderContext);

  if (context === undefined) {
    throw new Error('useTableConfig must be used within a TableProvider');
  }

  return context.getTableConfig;
}

/**
 * Hook to get custom UI components
 */
export function useTableComponents() {
  const context = useContext(TableProviderContext);

  if (context === undefined) {
    throw new Error('useTableComponents must be used within a TableProvider');
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
    delete: 'Delete',
    edit: 'Edit',
    copy: 'Copy',
    save: 'Save',
    cancel: 'Cancel',
    confirm: 'Confirm',
    title: 'Actions',
    view: 'View',
  },
  columns: {
    title: 'Columns',
    hide: 'Hide column',
    show: 'Show column',
    visible: 'Visible columns',
    hidden: 'Hidden columns',
    drag: 'Drag {column} column',
    resetOrder: 'Reset column order',
    toggleVisibility: 'Toggle columns',
    hideAll: 'Hide all columns',
    showAll: 'Show all columns',
    edit_property: 'Edit Property',
    filter: 'Filter',
    hide_in_view: 'Hide in View',
    reorder: 'Drag to Reorder',
    sort_ascending: 'Sort Ascending',
    sort_descending: 'Sort Descending',
  },
  common: {
    true: 'True',
    false: 'False',
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    reset: 'Reset',
    search: 'Search',
  },
  filters: {
    title: 'Filters',
    add: 'Add filter',
    remove: 'Remove filter',
    apply: 'Apply filters',
    clear: 'Clear filters',
    noResults: 'No results found',
    noFilters: 'No filters applied',
    search: 'Search {filter}...',
    selectedCount: '{count} {count, plural, one {selected} other {selected}}',
    active_count:
      '{count} {count, plural, one {active filter} other {active filters}}',
    column: 'Column',
    value: 'Value',
    value_to: 'Value to',
    select_operator: 'Select operator',
    error: 'Filter error',
    operators: {
      contains: 'Contains',
      empty: 'Is empty',
      not_empty: 'Is not empty',
      between: 'Between',
    },
  },
  pagination: {
    first: 'Go to first page',
    last: 'Go to last page',
    next: 'Go to next page',
    previous: 'Go to previous page',
    of: 'of',
    page: 'Page',
    rowsPerPage: 'Rows per page',
    showing:
      'Showing page {page} of {total} {total, plural, one {page} other {pages}}',
    selectedCount:
      '{selected} of {total} {total, plural, one {row} other {rows}} selected',
  },
  search: {
    placeholder: 'Search...',
  },
  selection: {
    rows: '{count} {count, plural, one {row} other {rows}} selected',
  },
  sorting: {
    ascending: 'Sort ascending',
    descending: 'Sort descending',
    choose_column: 'Select column',
    current: 'Current sort',
  },
  views: {
    title: 'Views',
    current: 'Current View',
    save: 'Save View',
    saveAs: 'Save as new view',
    update: 'Update view',
    delete: 'Delete view',
    rename: 'Rename view',
    setDefault: 'Set as default',
    defaultView: 'Default View',
    default_system_view: 'Default System View',
    systemView: 'System View',
    custom_view: 'Custom View',
    temporary_view: 'Temporary View',
    viewName: 'View Name',
    noViews: 'No saved views',
    confirmDelete: 'Are you sure you want to delete this view?',
    confirmDeleteWithName: "Are you sure you want to delete the view '{name}'?",
    manage: 'Manage Views',
    saveChanges: 'Save changes',
    saveChangesTooltip: 'Save changes made to this view',
    add_view: 'Add view',
    view_options: 'View options',
    view_name: 'View name',
    cannot_delete_system_view: 'Cannot delete system view',
    cannot_update_system_view: 'Cannot update system view',
    view_created_successfully: 'View created successfully',
    view_updated_successfully: 'View updated successfully',
    view_deleted_successfully: 'View deleted successfully',
    error_saving_view: 'Error saving view',
    error_updating_view: 'Error updating view',
    error_deleting_view: 'Error deleting view',
    error_loading_views: 'Error loading views',
    history: {
      undo: 'Undo change',
      redo: 'Redo change',
      nothing_to_undo: 'Nothing to undo',
      nothing_to_redo: 'Nothing to redo',
    },
    notifications: {
      created: 'View created successfully',
      updated: 'View updated successfully',
      deleted: 'View deleted successfully',
      setAsDefault: 'View set as default successfully',
      error: {
        create: 'Failed to create view',
        update: 'Failed to update view',
        delete: 'Failed to delete view',
        setDefault: 'Failed to set view as default',
      },
    },
    dialog: {
      save: {
        title: 'Save View',
        description: 'Save your current configuration as a custom view',
        name: 'Name',
        namePlaceholder: 'My custom view',
        default: 'Set as default view',
        global: 'Make this view global',
        save: 'Save',
        saving: 'Saving...',
      },
      manage: {
        title: 'Manage Views',
        description: 'Manage your saved table views',
        name: 'Name',
        type: 'Type',
        created: 'Created',
        actions: 'Actions',
        rename: 'Rename view',
        delete: 'Delete view',
        setDefault: 'Set as default',
        editColumns: 'Edit Columns',
        stopEdit: 'Stop Editing',
        editSystemViewWarning: '(Will create a new view)',
      },
    },
  },
  state: {
    loading: 'Loading data...',
    noData: 'No data available',
    error: 'Error loading data',
    error_description: 'An error occurred: {message}',
  },
  url_state: {
    copy_link: 'Copy link',
    link_copied: 'Link copied to clipboard',
    reset: 'Reset filters',
    share: 'Share this view',
    auto_save: 'Auto-saving...',
    save_success: 'View saved successfully',
  },
  demo: {
    title: 'URL Table Demo',
    copy_url: 'Copy URL',
    save_view: 'Save View',
    reset: 'Reset',
    view: 'View',
    sort_by: 'Sort by',
    select_view: 'Select a view',
    select_sort: 'Select sorting',
    view_name_placeholder: 'Enter view name',
    save: 'Save',
    current_state: 'Current State',
    data: 'Data',
    loading: 'Loading...',
    name_asc: 'Name (A-Z)',
    name_desc: 'Name (Z-A)',
    date_asc: 'Date (oldest first)',
    date_desc: 'Date (newest first)',
  },
  table: {
    no_results: 'No results found',
    no_results_description: 'No data matches your current filters',
    hide_column: 'Hide column',
    show_column: 'Show column',
    toggle_columns: 'Toggle columns',
    selected_rows: '{count} {count, plural, one {row} other {rows}} selected',
    sort_ascending: 'Sort ascending',
    sort_descending: 'Sort descending',
    drag_column: 'Drag column',
  },
  menu: {
    back: 'Back',
    columns: 'Columns',
    columns_visible: '{count} {count, plural, one {visible} other {visibles}}',
    filter: 'Filter',
    filters: 'Filters',
    group: 'Group',
    select_column: 'Select column',
    current_groups: '{count, plural, one {Current group} other {Current groups}}',
    active_groups: '{count} {count, plural, one {active group} other {active groups}}',
    options: 'Options',
    properties: 'Properties',
    sort: 'Sort',
    subgroup: 'Subgroup',
    title: 'Options',
  },
  add_an_item: 'Add Item',
};
