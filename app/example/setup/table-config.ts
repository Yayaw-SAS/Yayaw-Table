import type { DataTableConfig } from "@/src/ui/yayaw-table/atoms/config-atoms";
import {
  bulkCopy,
  bulkDelete,
  bulkUpdate,
  createProduct,
  deleteProduct,
  listProducts,
  updateProduct,
} from "../actions/products";

// Interface étendue pour inclure les colonnes
interface ExtendedDataTableConfig extends DataTableConfig {
  columns?: {
    definitions?: Array<{
      id: string;
      type: string;
      header: string;
      enableSorting?: boolean;
      enableColumnFilter?: boolean;
    }>;
    order?: string[];
    visible?: string[];
    mandatory?: string[];
    sort?: Array<{ id: string; desc: boolean }>;
  };
  translations?: {
    namespace: string;
    keys: Record<string, string>;
  };
}

// Configuration du tableau
export const getTableConfig = (
  tableType: string
): ExtendedDataTableConfig | undefined => {
  if (tableType === "products") {
    return {
      defaultPageSize: 10,
      enableColumnDnd: true,
      enableColumnDragDropByDefault: true,
      enableColumnFilters: true,
      enableMultiRowSelection: true,
      enablePagination: true,
      enableRowDragDrop: false,
      enableRowSelection: true,
      enableSorting: true,
      enableGrouping: true,
      pageSizeOptions: [10, 50, 100],
      columns: {
        definitions: [
          {
            id: "name",
            type: "text",
            header: "Product Name",
            enableSorting: true,
            enableColumnFilter: true,
          },
          {
            id: "brand",
            type: "text",
            header: "Brand",
            enableSorting: true,
            enableColumnFilter: true,
          },
          {
            id: "category",
            type: "tag",
            header: "Category",
            enableSorting: true,
            enableColumnFilter: true,
          },
          {
            id: "price",
            type: "number",
            header: "Price",
            enableSorting: true,
            enableColumnFilter: true,
          },
          {
            id: "status",
            type: "tag",
            header: "Status",
            enableSorting: true,
            enableColumnFilter: true,
          },
          {
            id: "createdAt",
            type: "date",
            header: "Created",
            enableSorting: true,
            enableColumnFilter: true,
          },
          {
            id: "isActive",
            type: "boolean",
            header: "Active",
            enableSorting: true,
            enableColumnFilter: true,
          },
          {
            id: "actions",
            type: "actions",
            header: "Actions",
            enableSorting: false,
            enableColumnFilter: false,
          },
        ],
        order: [
          "name",
          "brand",
          "category",
          "price",
          "status",
          "createdAt",
          "isActive",
          "actions",
        ],
        visible: [
          "name",
          "brand",
          "category",
          "price",
          "status",
          "createdAt",
          "isActive",
          "actions",
        ],
        mandatory: ["name"],
        sort: [],
      },
      translations: {
        namespace: "table.products",
        keys: {
          title: "Products Management",
          description:
            "Production-ready table with server-side pagination, filtering, and sorting",
        },
      },
    };
  }
};

// Configuration des actions du tableau (Server Actions)
export const getTableActions = (tableType: string) => {
  if (tableType === "products") {
    return {
      list: listProducts,
      create: createProduct,
      update: updateProduct,
      delete: deleteProduct,
      bulkDelete,
      bulkCopy,
      bulkUpdate,
    };
  }
};
