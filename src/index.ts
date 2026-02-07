// Export the main provider and translations

export type {
  DataTableColumnsConfig,
  DataTableConfig,
} from "./ui/yayaw_table/atoms/config-atoms";

// Export main components
export { DataTable } from "./ui/yayaw_table/components/data-table";
// Re-export TableActions type from provider for external usage
export type { TableActions } from "./ui/yayaw_table/providers/table-provider";
export {
  defaultTranslations,
  TableProvider,
  useFormConfig,
  useLocale,
  useTableActions,
  useTableComponents,
  useTableConfig,
  useTranslations,
} from "./ui/yayaw_table/providers/table-provider";
// Export types
export type { DataTableTranslations } from "./ui/yayaw_table/types/translations";
