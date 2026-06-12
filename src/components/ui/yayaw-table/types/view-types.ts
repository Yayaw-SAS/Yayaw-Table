/**
 * Types for table views
 * Defines the structure of saved table views
 */

import type {
  ColumnFiltersState,
  ColumnPinningState,
  SortingState,
  VisibilityState,
} from "@tanstack/react-table";
import type { TableDisplayMode, TableKanbanViewConfig } from "./display-types";
import type { AdvancedFiltersState } from "./filter-types";

/**
 * Table view
 * Represents a saved view of the table
 */
export interface TableView {
  /**
   * View configuration
   */
  config: TableViewConfig;

  /**
   * Creation date
   */
  createdAt?: Date;

  /**
   * ID of the user who created the view
   */
  createdById: string;

  /**
   * Unique identifier for the view
   */
  id: string;

  /**
   * Whether the view is the default view
   * The default view is loaded when the table is first rendered
   */
  isDefault?: boolean;

  /**
   * Whether the view is global (available to all users)
   */
  isGlobal?: boolean;

  /**
   * Whether the view is a system view
   * System views cannot be edited or deleted by users
   */
  isSystem?: boolean;

  /**
   * Display name for the view
   */
  name: string;

  /**
   * ID of the user who owns the view
   */
  ownerId?: null | string;

  /**
   * ID of the table this view belongs to
   */
  tableId: string;

  /**
   * Last update date
   */
  updatedAt?: Date;
}

/**
 * Table view configuration
 * Contains all state that can be saved in a view
 */
export interface TableViewConfig {
  /**
   * Advanced filter rules
   */
  advancedFilters?: AdvancedFiltersState;

  /**
   * Column filters
   */
  columnFilters?: ColumnFiltersState;

  /**
   * Column order
   */
  columnOrder?: string[];

  /**
   * Pinned columns
   */
  columnPinning?: ColumnPinningState;

  /**
   * Column visibility
   */
  columnVisibility?: VisibilityState;

  /**
   * Global search value
   */
  globalSearch?: string;

  /**
   * Display mode restored when applying the view.
   */
  displayMode?: TableDisplayMode;

  /**
   * Grouping column IDs
   */
  grouping?: string[];

  /**
   * Kanban-specific view state.
   */
  kanban?: TableKanbanViewConfig;

  /**
   * Page size to restore when applying the view
   */
  pageSize?: number;

  /**
   * Sorting
   */
  sorting?: SortingState;
}

/**
 * Context passed to view persistence actions.
 */
export interface TableViewActionContext {
  /**
   * Stable table instance ID used for URL state
   */
  tableId: string;

  /**
   * Table catalogue key
   */
  tableType: string;
}

/**
 * Input used to create a saved view.
 */
export interface CreateTableViewInput extends TableViewActionContext {
  /**
   * View configuration to persist
   */
  config: TableViewConfig;

  /**
   * Whether the view should become the default view
   */
  isDefault?: boolean;

  /**
   * Whether the view is shared globally
   */
  isGlobal?: boolean;

  /**
   * Display name for the new view
   */
  name: string;
}

/**
 * Input used to update an existing saved view.
 */
export interface UpdateTableViewInput extends Partial<CreateTableViewInput> {
  /**
   * Stable table instance ID used for URL state
   */
  tableId: string;

  /**
   * Table catalogue key
   */
  tableType: string;
}

/**
 * Standard result shape for view mutations.
 */
export interface TableViewActionResult<TData = TableView> {
  /**
   * Updated or created payload
   */
  data?: TData;

  /**
   * Human-readable error message
   */
  error?: string;

  /**
   * Whether the mutation succeeded
   */
  success: boolean;
}

/**
 * View persistence contract exposed through table actions.
 */
export interface TableViewActions {
  /**
   * Create a saved view from the current table state
   */
  create?: (
    input: CreateTableViewInput
  ) => Promise<TableViewActionResult<TableView>>;

  /**
   * Delete a saved view
   */
  delete?: (
    id: string,
    context: TableViewActionContext
  ) => Promise<TableViewActionResult<{ id: string }>>;

  /**
   * List saved views for the table
   */
  list?: (
    context: TableViewActionContext
  ) => Promise<{ data: TableView[] }>;

  /**
   * Update a saved view with a new name or configuration
   */
  update?: (
    id: string,
    input: UpdateTableViewInput
  ) => Promise<TableViewActionResult<TableView>>;
}
