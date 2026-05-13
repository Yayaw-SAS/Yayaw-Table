import type { ColumnDef, ColumnFiltersState } from "@tanstack/react-table";
import type { CustomBulkActionsInput } from "../components/bulk-actions";

/**
 * Column filter object
 */
export interface ColumnFilter {
  /**
   * ID of the column to filter
   */
  id: string;

  /**
   * Filter value
   */
  value: unknown;
}

export interface DataTableFooterProps {
  tableId: string;
}

export interface DataTableHeaderProps {
  menuId?: string;
  onSearch?: (value: string) => void;
  searchPlaceholder?: string;
  showSearch?: boolean;
  tableId: string;
  title?: string;
}

/**
 * DataTable v2 context state interface
 */
export interface DataTableState {
  /**
   * Active column ID
   */
  activeColumnId: null | string;

  /**
   * Column filters
   */
  columnFilters: ColumnFiltersState;

  /**
   * Column order
   */
  columnOrder: string[];

  /**
   * Column visibility
   */
  columnVisibility: Record<string, boolean>;

  /**
   * Global filter value
   */
  globalFilter: string;

  /**
   * Pagination state
   */
  pagination: {
    pageIndex: number;
    pageSize: number;
  };

  /**
   * Row selection state
   */
  rowSelection: Record<string, boolean>;

  /**
   * Sorting state
   */
  sorting: {
    desc: boolean;
    id: string;
  }[];

  /**
   * Table ID
   */
  tableId: string;

  /**
   * Last update date of the view
   */
  updatedAt: Date;
}

export interface DataTableProps<
  TData extends Record<string, unknown>,
  TValue = unknown,
> {
  data: TData[];
  columns: ColumnDef<TData, TValue>[];
  tableId: string;
  tableType?: string;
  customBulkActions?: CustomBulkActionsInput<TData>;
  children?: React.ReactNode;
  initialActiveViewId?: string;
  initialViews?: unknown[];
}
