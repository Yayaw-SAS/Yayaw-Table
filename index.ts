/**
 * YaYaw Table - A robust and flexible data table component library
 * 
 * @author Yannis
 * @version 0.1.0
 */

// Export main DataTable component (full-featured)
export { DataTable } from "./src/data-table/components/data-table"

// Export simplified components (alternative API)
export { SimpleDataTable } from "./src/data-table/components/simple-data-table"
export { useSimpleDataTable } from "./src/data-table/hooks/use-simple-data-table"

// Export providers and translations
export { TableProvider, useTranslations, defaultTranslations } from "./src/data-table/providers/table-provider"

// Export translation types
export type { DataTableTranslations, TranslationParams } from "./src/data-table/types/translations"

// Export configuration helpers - users need these to create their table configs
export { defineTableConfig } from "./src/data-table/config/helpers"
export type { 
  TableConfig, 
  TableColumnsConfig, 
  TableBehaviorConfig, 
  ColumnDefinition,
  TableTranslationsConfig 
} from "./src/data-table/config/helpers"

// Export core UI components (cleaned versions)
export * from "./src/components/ui/table"
export * from "./src/components/ui/button"
export * from "./src/components/ui/input"
export * from "./src/components/ui/select"
export * from "./src/components/ui/checkbox"
export * from "./src/components/ui/badge"
export * from "./src/components/ui/skeleton"
export * from "./src/components/ui/separator"
export * from "./src/components/ui/label"

// Export utility functions
export { cn, formatDate, debounce } from "./src/lib/utils"

// Re-export essential TanStack Table types
export type {
  ColumnDef,
  Row,
  Table,
  Column,
  SortDirection,
  ColumnSort,
  PaginationState,
  VisibilityState,
  ColumnFiltersState,
  SortingState,
  RowSelectionState,
} from "@tanstack/react-table"

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