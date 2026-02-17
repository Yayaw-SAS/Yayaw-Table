import type { DataTableConfig } from "@/src/components/ui/yayaw-table/atoms/config-atoms";
import type { AppLocale } from "@/src/i18n/routing";
import {
  bulkCopy,
  bulkDelete,
  bulkUpdate,
  createProduct,
  deleteProduct,
  listProducts,
  updateProduct,
} from "../actions/products";

interface ExtendedDataTableConfig extends DataTableConfig {
  columns?: {
    definitions?: Array<{
      id: string;
      type: string;
      header: string;
      enableSorting?: boolean;
      enableColumnFilter?: boolean;
      dateDisplayPreset?: string;
      dateFormat?: string;
      inlineEdit?:
        | boolean
        | {
            enabled?: boolean;
            editor?:
              | "auto"
              | "boolean"
              | "date"
              | "json"
              | "number"
              | "select"
              | "text"
              | "textarea";
            debounceMs?: number;
            formField?: string;
            options?: Array<{
              label: string;
              value: boolean | number | string;
            }>;
            readonly?: boolean;
          };
      numberFormat?:
        | "space"
        | "dot"
        | "comma"
        | "locale"
        | {
            thousandsSeparator?: string;
            decimalSeparator?: string;
            decimals?: number;
            prefix?: string;
            suffix?: string;
          };
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
  inlineEdit?: {
    enabled?: boolean;
    debounceMs?: number;
    trigger?: "doubleClickEnter";
    optimistic?: boolean;
    showDelayIndicator?: boolean;
  };
}

const TABLE_COPY: Record<
  AppLocale,
  {
    headers: {
      actions: string;
      active: string;
      brand: string;
      category: string;
      created: string;
      name: string;
      price: string;
      status: string;
    };
    tableDescription: string;
    tableTitle: string;
  }
> = {
  en: {
    headers: {
      actions: "Actions",
      active: "Active",
      brand: "Brand",
      category: "Category",
      created: "Created",
      name: "Product Name",
      price: "Price",
      status: "Status",
    },
    tableDescription:
      "Production-ready table with server-side pagination, filtering, and sorting",
    tableTitle: "Products Management",
  },
  fr: {
    headers: {
      actions: "Actions",
      active: "Actif",
      brand: "Marque",
      category: "Catégorie",
      created: "Créé le",
      name: "Nom du produit",
      price: "Prix",
      status: "Statut",
    },
    tableDescription:
      "Table prête pour la production avec pagination, filtres et tri côté serveur",
    tableTitle: "Gestion des produits",
  },
};

export const getTableConfig = (
  tableType: string,
  locale: AppLocale = "en"
): ExtendedDataTableConfig | undefined => {
  if (tableType !== "products") {
    return;
  }

  const copy = TABLE_COPY[locale] ?? TABLE_COPY.en;

  return {
    defaultPageSize: 10,
    enableColumnDnd: true,
    enableColumnDragDropByDefault: true,
    enableColumnFilters: true,
    enableGrouping: true,
    enableMultiRowSelection: true,
    enablePagination: true,
    enableRowDragDrop: false,
    enableRowSelection: true,
    enableSorting: true,
    inlineEdit: {
      enabled: true,
      debounceMs: 700,
      trigger: "doubleClickEnter",
      optimistic: true,
      showDelayIndicator: true,
    },
    pageSizeOptions: [10, 50, 100],
    dateDisplayPreset: "localized-medium",
    columns: {
      definitions: [
        {
          id: "name",
          type: "text",
          header: copy.headers.name,
          enableSorting: true,
          enableColumnFilter: true,
          inlineEdit: true,
        },
        {
          id: "brand",
          type: "text",
          header: copy.headers.brand,
          enableSorting: true,
          enableColumnFilter: true,
          inlineEdit: true,
        },
        {
          id: "category",
          type: "tag",
          header: copy.headers.category,
          enableSorting: true,
          enableColumnFilter: true,
        },
        {
          id: "price",
          type: "number",
          header: copy.headers.price,
          enableSorting: true,
          enableColumnFilter: true,
          inlineEdit: {
            editor: "number",
          },
          // Euro display with space thousands separator and no decimals.
          numberFormat: {
            thousandsSeparator: " ",
            decimals: 0,
            suffix: " €",
          },
        },
        {
          id: "status",
          type: "tag",
          header: copy.headers.status,
          enableSorting: true,
          enableColumnFilter: true,
        },
        {
          id: "createdAt",
          type: "date",
          header: copy.headers.created,
          enableSorting: true,
          enableColumnFilter: true,
          dateDisplayPreset: "dmy-numeric",
        },
        {
          id: "isActive",
          type: "boolean",
          header: copy.headers.active,
          enableSorting: true,
          enableColumnFilter: true,
          inlineEdit: {
            editor: "boolean",
          },
        },
        {
          id: "actions",
          type: "actions",
          header: copy.headers.actions,
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
        title: copy.tableTitle,
        description: copy.tableDescription,
      },
    },
  };
};

// Server Action mapping for this table type.
export const getTableActions = (tableType: string) => {
  if (tableType !== "products") {
    return;
  }

  return {
    list: listProducts,
    create: createProduct,
    update: updateProduct,
    delete: deleteProduct,
    bulkDelete,
    bulkCopy,
    bulkUpdate,
  };
};
