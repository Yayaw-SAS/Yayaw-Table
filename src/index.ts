// Export the main provider and translations

export type {
  DataTableColumnsConfig,
  DataTableConfig,
} from './data-table/atoms/config-atoms';

// Export main components
export { DataTable } from './data-table/components/data-table';
export {
  defaultTranslations,
  TableProvider,
  useFormConfig,
  useLocale,
  useTableActions,
  useTableComponents,
  useTableConfig,
  useTranslations,
} from './data-table/providers/table-provider';
// Re-export TableActions type from provider for external usage
export type { TableActions } from './data-table/providers/table-provider';
// Export types
export type { DataTableTranslations } from './data-table/types/translations';
