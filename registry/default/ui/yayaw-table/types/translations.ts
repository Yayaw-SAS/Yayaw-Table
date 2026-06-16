/**
 * Type definitions for the data table translations
 * These types ensure type safety when using translations
 */

export interface DataTableTranslations {
  actions: {
    close?: string;
    create?: string;
    delete: string;
    edit: string;
    copy: string;
    export: string;
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
    select_all: string;
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
  collection?: {
    actions?: string;
    cancel?: string;
    deleteItem?: string;
    editItem?: string;
    moveDown?: string;
    moveUp?: string;
    save?: string;
  };
  inline?: {
    edit_hint: string;
    invalid_value: string;
    missing_row_id: string;
    missing_update_action: string;
    save_error: string;
    save_scheduled: string;
    saving: string;
    select_no_options: string;
  };
  filters: {
    title: string;
    add: string;
    remove: string;
    apply: string;
    clear: string;
    select_all?: string;
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
      equals?: string;
      starts_with?: string;
      ends_with?: string;
      not_contains?: string;
      greater_than?: string;
      less_than?: string;
      greater_than_or_equal?: string;
      less_than_or_equal?: string;
      not_equals?: string;
      is?: string;
      is_not?: string;
      is_any_of?: string;
      is_none_of?: string;
      contains_all?: string;
      contains_none?: string;
      before?: string;
      after?: string;
      on_or_before?: string;
      on_or_after?: string;
    };
    types?: {
      text?: string;
      number?: string;
      date?: string;
      select?: string;
      multiSelect?: string;
      option?: string;
      multiOption?: string;
    };
    date_shortcuts?: {
      today?: string;
      yesterday?: string;
      last_7_days?: string;
      last_30_days?: string;
      this_month?: string;
    };
    advanced?: {
      title?: string;
      basic_title?: string;
      convert_to_advanced?: string;
      filter_options?: string;
      edit_filter?: string;
      enable_filter?: string;
      disable_filter?: string;
      edit_filter_for?: string;
      editing?: string;
      done?: string;
      reset_filters?: string;
      empty_description?: string;
      add_first_filter?: string;
      quick_start?: string;
      quick_start_search?: string;
      quick_start_status?: string;
      quick_start_date?: string;
      load_error_title?: string;
      load_error_description?: string;
      retry?: string;
      results_count?: string;
      no_results_with_search?: string;
      no_results_description?: string;
      adjust_filters_hint?: string;
      modify_filters?: string;
      filtered_in?: string;
      search_columns?: string;
      no_columns_found?: string;
      no_columns_available?: string;
      no_popular_filters?: string;
      no_recent_filters?: string;
      try_different_search?: string;
      add_column?: string;
      active?: string;
      activate?: string;
      off?: string;
    };
    faceted?: {
      sort_by_label?: string;
      sort_by_count?: string;
      sort_by_value?: string;
      sort_by_trending?: string;
      selected_of_total?: string;
      options_count?: string;
      select_all?: string;
      select_none?: string;
      top_5?: string;
      trending?: string;
      no_options_found?: string;
      no_options_available?: string;
      try_different_search?: string;
      no_data_for_filter?: string;
      statistics?: string;
      options?: string;
      records?: string;
      coverage?: string;
    };
    add_menu?: {
      all?: string;
      popular?: string;
      recent?: string;
      clear_search_hint?: string;
      navigate_hint?: string;
      categories?: {
        recent?: string;
        popular?: string;
        text?: string;
        number?: string;
        date?: string;
        select?: string;
      };
    };
    presets?: {
      title?: string;
      panel_title?: string;
      share?: string;
      duplicate?: string;
      load?: string;
      used_times?: string;
      last_used?: string;
      save_dialog_title?: string;
      save_dialog_description?: string;
      name_label?: string;
      name_placeholder?: string;
      description_label?: string;
      description_placeholder?: string;
      tags_label?: string;
      tags_placeholder?: string;
      make_public?: string;
      no_active_filters_to_save?: string;
      save_preset?: string;
      saving?: string;
      delete_title?: string;
      delete_description?: string;
      save_current?: string;
      import?: string;
      export_all?: string;
      search_placeholder?: string;
      no_presets_found?: string;
      try_different_search?: string;
      create_first_hint?: string;
      save_first?: string;
      tabs?: {
        all?: string;
        recent?: string;
        popular?: string;
        system?: string;
      };
    };
  };
  filter_types?: {
    option?: string;
    multiOption?: string;
  };
  form?: string;
  value?: string;
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
    display: {
      title: string;
      gallery: string;
      table: string;
      kanban: string;
    };
    gallery: {
      title: string;
      image: string;
      titleColumn: string;
      properties: string;
      aspectRatio: string;
      imageFit: string;
      cardSize: string;
      showLabels: string;
      wide: string;
      square: string;
      video: string;
      portrait: string;
      cover: string;
      contain: string;
      small: string;
      medium: string;
      large: string;
    };
    kanban: {
      titleColumn: string;
      properties: string;
      showLabels: string;
    };
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
  calculations: {
    none: string;
    count: string;
    percent: string;
    more: string;
    count_all: string;
    count_values: string;
    count_unique: string;
    count_empty: string;
    count_not_empty: string;
    count_true: string;
    count_false: string;
    percent_empty: string;
    percent_not_empty: string;
    percent_true: string;
    percent_false: string;
    sum: string;
    average: string;
    median: string;
    min: string;
    max: string;
    range: string;
    calculate: string;
  };
  menu: {
    back: string;
    columns: string;
    columns_visible: string;
    filter: string;
    filters: string;
    group: string;
    selection_column?: string;
    select_column: string;
    current_groups: string;
    active_groups: string;
    options: string;
    properties: string;
    reset_all: string;
    reset_all_description: string;
    footer_calculations: string;
    footer_calculations_on: string;
    footer_calculations_off: string;
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
