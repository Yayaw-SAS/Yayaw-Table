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
} from '@tanstack/react-table';
// Export theme components
export { ThemeProvider } from './src/components/theme-provider';
export * from './src/components/ui/badge';
export * from './src/components/ui/button';
export * from './src/components/ui/checkbox';
export * from './src/components/ui/input';
export * from './src/components/ui/label';
export * from './src/components/ui/select';
export * from './src/components/ui/separator';
export * from './src/components/ui/skeleton';
// Export core UI components (cleaned versions)
export * from './src/components/ui/table';
export { ThemeToggle } from './src/components/ui-custom/theme-toggle';
export type { BulkActionsMenuProps } from './src/data-table/components/bulk-actions';
// Export bulk actions components
export { BulkActionsMenu } from './src/data-table/components/bulk-actions';
// Export main DataTable component (full-featured)
export { DataTable } from './src/data-table/components/data-table';
// Export simplified components (alternative API)
export { SimpleDataTable } from './src/data-table/components/simple-data-table';
export type {
  ColumnDefinition,
  TableBehaviorConfig,
  TableColumnsConfig,
  TableConfig,
  TableTranslationsConfig,
} from './src/data-table/config/helpers';
// Export configuration helpers - users need these to create their table configs
export { defineTableConfig } from './src/data-table/config/helpers';
export {
  defaultBulkActions,
  useBulkActions,
} from './src/data-table/hooks/use-bulk-actions';
export {
  createBulkEditFormConfig,
  useBulkEdit,
} from './src/data-table/hooks/use-bulk-edit';
export { useSimpleDataTable } from './src/data-table/hooks/use-simple-data-table';
// Export providers and translations
export {
  defaultTranslations,
  TableProvider,
  useTableActions,
  useTranslations,
} from './src/data-table/providers/table-provider';
// Export translation types
export type {
  DataTableTranslations,
  TranslationParams,
} from './src/data-table/types/translations';
// Export utility functions
export { cn, debounce, formatDate } from './src/lib/utils';

// Advanced components require optional peer dependencies:
// - jotai (for advanced state management)
// - @tanstack/react-query (for server state)
// - @dnd-kit/* (for drag and drop)
// - motion/react (for animations)
// - sonner (for notifications)

// Note: Advanced hooks like useDataTable with external dependencies
// are available but not exported by default to avoid build issues.
// They can be imported directly if needed:
// import { useDataTable } from "yayaw-table/src/data-table/hooks/use-data-table"
