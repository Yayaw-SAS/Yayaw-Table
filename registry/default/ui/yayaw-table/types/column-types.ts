/**
 * Type definitions for DataTable column management
 */
import type { CellContext, Row } from "@tanstack/react-table";

/**
 * Comprehensive column definition interface for DataTable
 * Provides type-safe and translation-friendly column configuration
 */
export interface DataTableColumnDef<
  T extends Record<string, unknown> = Record<string, unknown>,
> {
  accessorFn?: (row: T) => unknown; // Function to access data if not using accessorKey
  accessorKey?: keyof T & string; // Property to access in the data
  cell?:
    | ((info: CellContext<T, unknown>) => React.ReactNode)
    | ((props: { row: Row<T> }) => React.ReactNode); // Custom cell renderer

  enableFiltering?: boolean; // Enable filtering for this column
  enableHiding?: boolean; // Enable hiding this column
  enableResizing?: boolean; // Enable resizing for this column
  enableSorting?: boolean; // Enable sorting for this column
  // Display properties
  header: string; // Translation key for the header
  // Core properties
  id: string; // Unique identifier for the column

  // Additional metadata
  meta?: {
    [key: string]: unknown; // Allow for additional custom metadata
    className?: string; // Additional CSS classes
    dateFormat?: string; // Format for date columns
    filterOptions?: string[]; // Options for select filters
    isActions?: boolean; // Whether this is an actions column
    maxWidth?: number; // Maximum width
    minWidth?: number; // Minimum width
    width?: number; // Default width
  };

  // Column type for specialized rendering and filtering
  type?:
    | "boolean"
    | "code"
    | "custom"
    | "date"
    | "number"
    | "select"
    | "tag"
    | "text";
}

/**
 * Helper type to convert DataTableColumnDef to TanStack ColumnDef
 * This is used internally by the useTableColumns hook
 */
export type DataTableColumnDefToColumnDef<
  T extends Record<string, unknown> = Record<string, unknown>,
> = Omit<DataTableColumnDef<T>, "enableFiltering"> & {
  enableColumnFilter?: boolean;
};
