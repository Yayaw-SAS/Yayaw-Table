// Export the main provider and translations

export type {
  DataTableColumnsConfig,
  DataTableConfig,
} from "./components/ui/yayaw-table/atoms/config-atoms";
// Export main components
export { DataTable } from "./components/ui/yayaw-table/components/data-table";
// Re-export TableActions type from provider for external usage
export type { TableActions } from "./components/ui/yayaw-table/providers/table-provider";
export {
  defaultTranslations,
  TableProvider,
  useFormConfig,
  useLocale,
  useTableActions,
  useTableComponents,
  useTableConfig,
  useTranslations,
} from "./components/ui/yayaw-table/providers/table-provider";
// Export types
export type { DataTableTranslations } from "./components/ui/yayaw-table/types/translations";
