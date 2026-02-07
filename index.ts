/**
 * YaYaw Table - A robust and flexible data table component library
 *
 * @author Yannis
 * @version 0.1.0
 */

// Re-export essential TanStack Table types
export type {
  Column,
  ColumnDef,
  ColumnFiltersState,
  ColumnSort,
  PaginationState,
  Row,
  RowSelectionState,
  SortDirection,
  SortingState,
  Table,
  VisibilityState,
} from "@tanstack/react-table";
// Export theme components
export { ThemeProvider } from "./src/components/theme-provider";
// Export utility functions
export { cn, debounce, formatDate } from "./src/lib/utils";
export { ThemeToggle } from "./src/ui/custom/theme-toggle";
export * from "./src/ui/shadcn/badge";
export * from "./src/ui/shadcn/button";
export * from "./src/ui/shadcn/checkbox";
export * from "./src/ui/shadcn/input";
export * from "./src/ui/shadcn/label";
export * from "./src/ui/shadcn/select";
export * from "./src/ui/shadcn/separator";
export * from "./src/ui/shadcn/skeleton";
// Export core UI components (cleaned versions)
export * from "./src/ui/shadcn/table";
export type { BulkActionsMenuProps } from "./src/ui/yayaw_table/components/bulk-actions";
// Export bulk actions components
export { BulkActionsMenu } from "./src/ui/yayaw_table/components/bulk-actions";
// Export main DataTable component (full-featured)
export { DataTable } from "./src/ui/yayaw_table/components/data-table";
// Export simplified components (alternative API)
// SimpleDataTable removed in favor of unified DataTable
export type {
  ColumnDefinition,
  TableBehaviorConfig,
  TableColumnsConfig,
  TableConfig,
  TableTranslationsConfig,
} from "./src/ui/yayaw_table/config/helpers";
// Export configuration helpers - users need these to create their table configs
export { defineTableConfig } from "./src/ui/yayaw_table/config/helpers";
export {
  defaultBulkActions,
  useBulkActions,
} from "./src/ui/yayaw_table/hooks/use-bulk-actions";
export {
  createBulkEditFormConfig,
  useBulkEdit,
} from "./src/ui/yayaw_table/hooks/use-bulk-edit";
// useSimpleDataTable hook kept for advanced internal scenarios; not exported by default
// Export providers and translations
export {
  defaultTranslations,
  TableProvider,
  useTableActions,
  useTranslations,
} from "./src/ui/yayaw_table/providers/table-provider";
// Export translation types
export type {
  DataTableTranslations,
  TranslationParams,
} from "./src/ui/yayaw_table/types/translations";

// Advanced components require optional peer dependencies:
// - jotai (for advanced state management)
// - @tanstack/react-query (for server state)
// - @dnd-kit/* (for drag and drop)
// - motion/react (for animations)
// - sonner (for notifications)

// Note: Advanced hooks like useDataTable with external dependencies
// are available but not exported by default to avoid build issues.
// They can be imported directly if needed:
// import { useDataTable } from "yayaw-table/src/ui/yayaw_table/hooks/use-data-table"
