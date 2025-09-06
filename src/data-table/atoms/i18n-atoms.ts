/**
 * Translation atoms for DataTable component
 * These atoms provide centralized translation management
 */
import { atom } from 'jotai';
import { atomFamily } from 'jotai/utils';

/**
 * Interface defining all translation keys used in the DataTable
 * This acts as a "translation API" for the component
 */
export interface DataTableUiStrings {
  // Filters
  activeFilters: string;
  addFilter: string;
  addView: string;
  applyFilters: string;
  cancel: string;

  clearFilters: string;
  close: string;
  // Column menu
  columnEditProperty: string;
  columnFilter: string;
  columnHide: string;
  columnReorder: string;
  columnSortAsc: string;

  columnSortDesc: string;
  columnsTitle: string;
  confirm: string;
  confirmDeleteView: string;
  create: string;
  customView: string;
  // Views
  defaultView: string;
  delete: string;
  deleteView: string;
  dragColumn: string;
  edit: string;
  error: string;
  // Messages
  errorDescription: string;
  false: string;

  filterBetween: string;
  filterColumn: string;
  filterContains: string;
  filterEmpty: string;
  filterError: string;
  filterNotEmpty: string;
  filterOperator: string;
  filterTitle: string;
  filterValue: string;
  filterValueTo: string;
  firstPage: string;
  hideAll: string;
  hideColumn: string;

  // History
  historyNothingToRedo: string;
  historyNothingToUndo: string;
  isDefaultView: string;
  lastPage: string;
  loading: string;
  manageViews: string;
  nextPage: string;
  noFilters: string;
  // General
  noResults: string;
  noResultsDescription: string;
  of: string;

  page: string;
  pageXofY: string;
  // Pagination
  previousPage: string;
  redo: string;
  renameView: string;
  reset: string;
  resetColumns: string;

  rowsPerPage: string;
  // Actions
  save: string;

  saveView: string;
  saveViewDefaultLabel: string;
  saveViewDescription: string;
  saveViewNameLabel: string;
  saveViewNamePlaceholder: string;
  // Dialogs
  saveViewTitle: string;
  search: string;
  searchPlaceholder: string;
  selectedRows: string;
  showAll: string;
  showColumn: string;

  showingPage: string;
  showingRows: string;
  sortAscending: string;
  sortDescending: string;
  success: string;
  systemView: string;
  // Table controls
  toggleColumns: string;
  true: string;
  undo: string;
  updateView: string;
  viewCantDeleteSystem: string;
  viewCantUpdateSystem: string;
  viewCreated: string;
  viewDeleted: string;
  viewDeleteError: string;
  viewDeleteSuccess: string;
  viewError: string;
  viewLoadError: string;
  viewName: string;
  viewOptions: string;
  viewSaveError: string;
  viewSaveSuccess: string;
  viewTemporary: string;
  viewUpdated: string;
  viewUpdateError: string;
  viewUpdateSuccess: string;
}

/**
 * Atom to store the actual translated values
 * This is populated by the translation provider
 */
export const translationsAtom = atom<
  Partial<Record<keyof DataTableUiStrings, string>>
>({});

/**
 * Atom to check if translations have been initialized
 */
export const translationsInitializedAtom = atom<boolean>(false);

/**
 * Atom family for storing table-specific translation overrides
 * Allows customizing translations for specific tables
 */
export const tableTranslationOverridesAtom = atomFamily((_tableId: string) =>
  atom<Partial<Record<keyof DataTableUiStrings, string>>>({})
);

/**
 * Derived atom family that combines global translations with table-specific overrides
 * Keyed by tableId
 */
export const tableTranslationsAtom = atomFamily((tableId: string) =>
  atom((get) => {
    const globalTranslations = get(translationsAtom);
    const tableOverrides = get(tableTranslationOverridesAtom(tableId));

    // Merge global translations with table-specific overrides
    return { ...globalTranslations, ...tableOverrides };
  })
);

/**
 * Default translation keys mapping
 * Maps each UI string to its corresponding translation key in the translations file
 */
export const translationKeysMap: DataTableUiStrings = {
  // Filters
  activeFilters: 'filters.active_count',
  addFilter: 'filters.add',
  addView: 'views.add_view',
  applyFilters: 'filters.apply',
  cancel: 'actions.cancel',

  clearFilters: 'filters.clear',
  close: 'actions.close',
  // Column menu
  columnEditProperty: 'columns.edit_property',
  columnFilter: 'columns.filter',
  columnHide: 'columns.hide_in_view',
  columnReorder: 'columns.reorder',
  columnSortAsc: 'columns.sort_ascending',

  columnSortDesc: 'columns.sort_descending',
  columnsTitle: 'columns.title',
  confirm: 'actions.confirm',
  confirmDeleteView: 'views.confirmDelete',
  create: 'actions.create',
  customView: 'views.custom_view',
  // Views
  defaultView: 'views.default_system_view',
  delete: 'actions.delete',
  deleteView: 'views.delete',
  dragColumn: 'table.drag_column',
  edit: 'actions.edit',
  error: 'common.error',
  // Messages
  errorDescription: 'state.error_description',
  false: 'common.false',

  filterBetween: 'filters.operators.between',
  filterColumn: 'filters.column',
  filterContains: 'filters.operators.contains',
  filterEmpty: 'filters.operators.empty',
  filterError: 'filters.error',
  filterNotEmpty: 'filters.operators.not_empty',
  filterOperator: 'filters.select_operator',
  filterTitle: 'filters.title',
  filterValue: 'filters.value',
  filterValueTo: 'filters.value_to',
  firstPage: 'pagination.first',
  hideAll: 'columns.hideAll',

  hideColumn: 'table.hide_column',
  // History
  historyNothingToRedo: 'views.history.nothing_to_redo',
  historyNothingToUndo: 'views.history.nothing_to_undo',
  isDefaultView: 'views.setDefault',
  lastPage: 'pagination.last',
  loading: 'common.loading',
  manageViews: 'views.manage',
  nextPage: 'pagination.next',
  noFilters: 'filters.noFilters',
  // General
  noResults: 'table.no_results',
  noResultsDescription: 'table.no_results_description',

  of: 'pagination.of',
  page: 'pagination.page',
  pageXofY: 'pagination.showing',
  // Pagination
  previousPage: 'pagination.previous',
  redo: 'views.history.redo',
  renameView: 'views.rename',

  reset: 'common.reset',
  resetColumns: 'columns.resetOrder',

  rowsPerPage: 'pagination.rowsPerPage',
  // Actions
  save: 'actions.save',
  saveView: 'views.save',
  saveViewDefaultLabel: 'views.dialog.save.default',
  saveViewDescription: 'views.dialog.save.description',
  saveViewNameLabel: 'views.dialog.save.name',
  saveViewNamePlaceholder: 'views.dialog.save.namePlaceholder',
  // Dialogs
  saveViewTitle: 'views.dialog.save.title',
  search: 'common.search',
  searchPlaceholder: 'search.placeholder',

  selectedRows: 'table.selected_rows',
  showAll: 'columns.showAll',
  showColumn: 'table.show_column',
  showingPage: 'pagination.showing',
  showingRows: 'pagination.selectedCount',
  sortAscending: 'table.sort_ascending',
  sortDescending: 'table.sort_descending',
  success: 'common.success',
  systemView: 'views.systemView',
  // Table controls
  toggleColumns: 'table.toggle_columns',
  true: 'common.true',
  undo: 'views.history.undo',
  updateView: 'views.update',
  viewCantDeleteSystem: 'views.cannot_delete_system_view',
  viewCantUpdateSystem: 'views.cannot_update_system_view',
  viewCreated: 'views.view_created_successfully',
  viewDeleted: 'views.view_deleted_successfully',
  viewDeleteError: 'views.error_deleting_view',
  viewDeleteSuccess: 'views.view_deleted_successfully',
  viewError: 'views.error_saving_view',
  viewLoadError: 'views.error_loading_views',
  viewName: 'views.view_name',
  viewOptions: 'views.view_options',
  viewSaveError: 'views.error_saving_view',
  viewSaveSuccess: 'views.notifications.created',
  viewTemporary: 'views.temporary_view',
  viewUpdated: 'views.view_updated_successfully',
  viewUpdateError: 'views.error_updating_view',
  viewUpdateSuccess: 'views.notifications.updated',
};

/**
 * Atom for translation keys (injection point)
 * Allows complete replacement of translation keys if needed
 */
export const dataTableTranslationKeysAtom =
  atom<DataTableUiStrings>(translationKeysMap);

/**
 * Atom for resolved translations
 * Components use this atom directly, without knowing how translations are resolved
 */
export const resolvedTranslationsAtom = atom<DataTableUiStrings>(
  {} as DataTableUiStrings
);
