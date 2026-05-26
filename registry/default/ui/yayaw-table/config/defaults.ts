/**
 * Default configuration values for all data tables
 * These values are used when specific configurations are not provided
 */

/**
 * Default table configuration
 */
export const defaultTableConfig = {
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
  density: "medium" as const,
  layoutPreset: "default" as const,
  defaultPageSize: 10,
  emptyState: {
    show: true,
  },
  enableColumnDragDropByDefault: false,
  enableColumnFilters: true,
  enableColumnPinning: true,
  enableMultiRowSelection: true,
  enablePagination: true,
  enableRowSelection: true,
  enableRowClickEdit: false,
  enableSorting: true,
  enableCalculations: false,
  inlineEdit: {
    enabled: false,
    debounceMs: 700,
    trigger: "doubleClickEnter",
    optimistic: true,
    showDelayIndicator: true,
  },
  dateDisplayPreset: "localized-short",
  pageSizeOptions: [10, 20, 50, 100, 200, 500],
};

/**
 * Default columns configuration
 */
export const defaultColumnsConfig = {
  defaultColumnOrder: [],
  defaultSort: [],
  defaultVisibleColumns: [],
  mandatoryColumns: [],
};

/**
 * Default translations
 */
export const defaultTranslations = {
  addFilter: "Add filter",
  clearFilters: "Clear filters",
  clearSort: "Clear sort",
  columns: "Columns",
  createView: "Create view",
  deleteView: "Delete view",
  dragHandleAriaLabel: "Drag to reorder",
  filterOperator: "Filter operator",
  filters: "Filters",
  filterValue: "Filter value",
  loading: "Loading data...",
  loadingError: "Error loading data",
  noDataAvailable: "No data available",
  noResults: "No results found",
  noResultsDescription: "Try adjusting your filters",
  of: "of",
  resetColumns: "Reset columns",
  rowsPerPage: "Rows per page",
  rowsSelected: "rows selected",
  saveView: "Save view",
  search: "Search",
  searchPlaceholder: "Search...",
  selectedCount: "Selected",
  showHideColumns: "Show/hide columns",
  toggleVisibility: "Toggle visibility",
  viewName: "View name",
  views: "Views",

  // Footer calculations
  calcNone: "None",
  calcCount: "Count",
  calcPercent: "Percent",
  calcMore: "More options",
  calcCountAll: "Count all",
  calcCountValues: "Count values",
  calcCountUnique: "Unique values",
  calcCountEmpty: "Empty",
  calcCountNotEmpty: "Not empty",
  calcCountTrue: "True",
  calcCountFalse: "False",
  calcPercentEmpty: "% empty",
  calcPercentNotEmpty: "% not empty",
  calcPercentTrue: "% true",
  calcPercentFalse: "% false",
  calcSum: "Sum",
  calcAverage: "Average",
  calcMedian: "Median",
  calcMin: "Min",
  calcMax: "Max",
  calcRange: "Range",
  calcCalculate: "Calculate",
};
