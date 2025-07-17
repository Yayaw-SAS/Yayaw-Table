import type { DataTableConfig } from '../../src/data-table/atoms/config-atoms';
import { productActions } from './data';

// Configuration du tableau
export const getTableConfig = (
  tableType: string
): DataTableConfig | undefined => {
  if (tableType === 'products') {
    return {
      defaultPageSize: 10,
      enableColumnDragDropByDefault: false,
      enableColumnFilters: true,
      enableMultiRowSelection: true,
      enablePagination: true,
      enableRowDragDrop: false,
      enableRowSelection: true,
      enableSorting: true,
      manualFiltering: false,
      manualPagination: false,
      manualSorting: false,
      pageSizeOptions: [5, 10, 20, 50],
    };
  }
  return undefined;
};

// Configuration des actions du tableau
export const getTableActions = (tableType: string) => {
  if (tableType === 'products') {
    return productActions;
  }
  return undefined;
};
