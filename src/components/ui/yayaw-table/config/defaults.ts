/**
 * Default configuration values for all data tables
 * These values are used when specific configurations are not provided
 */

/**
 * Default table configuration
 */
export const defaultTableConfig = {
  export: true,
  bulkExport: true,
  actionsAsIcons: false,
  defaultPageSize: 10,
  enableColumnDragDropByDefault: false,
  enableColumnFilters: true,
  enableColumnPinning: true,
  enableMultiRowSelection: true,
  enablePagination: true,
  enableRowSelection: true,
  enableSorting: true,
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
};
