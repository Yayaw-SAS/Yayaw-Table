// Export the main provider and translations
export { 
  TableProvider, 
  useTranslations, 
  useLocale, 
  useFormConfig, 
  useTableActions, 
  useTableConfig, 
  useTableComponents,
  defaultTranslations
} from './data-table/providers/table-provider'

// Export main components
export { DataTable } from './data-table/components/data-table'

// Export types
export type { DataTableTranslations } from './data-table/types/translations'
export type { DataTableConfig, DataTableColumnsConfig } from './data-table/atoms/config-atoms' 