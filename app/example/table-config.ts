import type { DataTableConfig } from '../../src/data-table/atoms/config-atoms';
import { productActions } from './data';

// Configuration du tableau (DataTableConfig)
export const getTableConfig = (
  tableType: string
): DataTableConfig | undefined => {
  if (tableType === 'products') {
    return {
      defaultPageSize: 10,
      enableColumnDragDropByDefault: false,
      enableColumnFilters: true,
      enableGrouping: true,
      enableMultiRowSelection: true,
      enablePagination: true,
      enableRowDragDrop: false,
      enableRowSelection: true,
      enableSorting: true,
      manualFiltering: true, // Server-side filtering
      manualPagination: true, // Server-side pagination
      manualSorting: true, // Server-side sorting
      pageSizeOptions: [5, 10, 20, 30, 50],
    };
  }
};

// Configuration des actions du tableau
export const getTableActions = (tableType: string) => {
  if (tableType === 'products') {
    return productActions;
  }
};
