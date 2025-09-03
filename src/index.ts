// Export the main provider and translations

export type {
  DataTableColumnsConfig,
  DataTableConfig,
} from './data-table/atoms/config-atoms';

// Export main components
export { DataTable } from './data-table/components/data-table';
export {
  SimpleDataTable,
  type SimpleTableConfig,
} from './data-table/components/simple-data-table';
export { UltraSimpleTable } from './data-table/components/ultra-simple-table';
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
// Export types
export type { DataTableTranslations } from './data-table/types/translations';
