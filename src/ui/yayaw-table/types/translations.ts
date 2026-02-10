/**
 * Type definitions for the data table translations
 * These types ensure type safety when using translations
 */

export interface DataTableTranslations {
  actions: {
    delete: string;
    edit: string;
    copy: string;
    save: string;
    cancel: string;
    confirm: string;
    title: string;
    view: string;
  };
  bulk: {
    close_menu: string;
    confirm_copy_description: string;
    confirm_delete_description: string;
    confirm_title: string;
  };
  columns: {
    title: string;
    hide: string;
    show: string;
    visible: string;
    hidden: string;
    drag: string;
    resetOrder: string;
    toggleVisibility: string;
    hideAll: string;
    showAll: string;
    edit_property: string;
    filter: string;
    hide_in_view: string;
    reorder: string;
    sort_ascending: string;
    sort_descending: string;
  };
  common: {
    true: string;
    false: string;
    loading: string;
    error: string;
    success: string;
    reset: string;
    search: string;
  };
  filters: {
    title: string;
    add: string;
    remove: string;
    apply: string;
    clear: string;
    noResults: string;
    noFilters: string;
    search: string;
    selectedCount: string;
    active_count: string;
    column: string;
    value: string;
    value_to: string;
    select_operator: string;
    error: string;
    operators: {
      contains: string;
      empty: string;
      not_empty: string;
      between: string;
    };
  };
  pagination: {
    first: string;
    last: string;
    next: string;
    previous: string;
    of: string;
    page: string;
    rowsPerPage: string;
    showing: string;
    selectedCount: string;
  };
  search: {
    placeholder: string;
  };
  selection: {
    rows: string;
  };
  sorting: {
    ascending: string;
    descending: string;
    choose_column: string;
    current: string;
  };
  views: {
    title: string;
    current: string;
    save: string;
    saveAs: string;
    update: string;
    delete: string;
    rename: string;
    setDefault: string;
    defaultView: string;
    default_system_view: string;
    systemView: string;
    custom_view: string;
    temporary_view: string;
    viewName: string;
    noViews: string;
    confirmDelete: string;
    confirmDeleteWithName: string;
    manage: string;
    saveChanges: string;
    saveChangesTooltip: string;
    add_view: string;
    view_options: string;
    view_name: string;
    cannot_delete_system_view: string;
    cannot_update_system_view: string;
    view_created_successfully: string;
    view_updated_successfully: string;
    view_deleted_successfully: string;
    error_saving_view: string;
    error_updating_view: string;
    error_deleting_view: string;
    error_loading_views: string;
    history: {
      undo: string;
      redo: string;
      nothing_to_undo: string;
      nothing_to_redo: string;
    };
    notifications: {
      created: string;
      updated: string;
      deleted: string;
      setAsDefault: string;
      error: {
        create: string;
        update: string;
        delete: string;
        setDefault: string;
      };
    };
    dialog: {
      save: {
        title: string;
        description: string;
        name: string;
        namePlaceholder: string;
        default: string;
        global: string;
        save: string;
        saving: string;
      };
      manage: {
        title: string;
        description: string;
        name: string;
        type: string;
        created: string;
        actions: string;
        rename: string;
        delete: string;
        setDefault: string;
        editColumns: string;
        stopEdit: string;
        editSystemViewWarning: string;
      };
    };
  };
  state: {
    loading: string;
    noData: string;
    error: string;
    error_description: string;
  };
  url_state: {
    copy_link: string;
    link_copied: string;
    reset: string;
    share: string;
    auto_save: string;
    save_success: string;
  };
  demo: {
    title: string;
    copy_url: string;
    save_view: string;
    reset: string;
    view: string;
    sort_by: string;
    select_view: string;
    select_sort: string;
    view_name_placeholder: string;
    save: string;
    current_state: string;
    data: string;
    loading: string;
    name_asc: string;
    name_desc: string;
    date_asc: string;
    date_desc: string;
  };
  table: {
    no_results: string;
    no_results_description: string;
    hide_column: string;
    show_column: string;
    toggle_columns: string;
    selected_rows: string;
    sort_ascending: string;
    sort_descending: string;
    drag_column: string;
  };
  menu: {
    back: string;
    columns: string;
    columns_visible: string;
    filter: string;
    filters: string;
    group: string;
    select_column: string;
    current_groups: string;
    active_groups: string;
    options: string;
    properties: string;
    reset_all: string;
    reset_all_description: string;
    sort: string;
    subgroup: string;
    title: string;
  };
  add_an_item: string;
}

/**
 * Utility type to get nested keys from translations
 */
type NestedKeyOf<ObjectType extends object> = {
  [Key in keyof ObjectType & (string | number)]: ObjectType[Key] extends object
    ? `${Key}` | `${Key}.${NestedKeyOf<ObjectType[Key]>}`
    : `${Key}`;
}[keyof ObjectType & (string | number)];

export type TranslationKey = NestedKeyOf<DataTableTranslations>;

/**
 * Parameters for translation functions with interpolation
 */
export interface TranslationParams {
  [key: string]: string | number;
}
