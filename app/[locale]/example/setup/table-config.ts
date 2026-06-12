import type { DataTableConfig } from "@/src/components/ui/yayaw-table/atoms/config-atoms";
import type { CalculationType } from "@/src/components/ui/yayaw-table/types/footer-types";
import type { AppLocale } from "@/src/i18n/routing";
import {
  aggregateProductsAction,
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
      displayVariant?: "default" | "tag";
      urlDisplayMode?: "domain" | "full" | "icon" | "row-link";
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
              | "multiSelect"
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
      tagColorMap?: Record<string, string>;
      size?: number;
      minSize?: number;
      maxSize?: number;
      enableCalculation?: boolean;
      defaultCalculation?: CalculationType;
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
      website: string;
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
      website: "Website",
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
      website: "Site",
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
    defaultDisplayMode: "table",
    displayModes: ["table", "kanban"],
    enableColumnDnd: true,
    enableColumnDragDropByDefault: true,
    enableColumnFilters: true,
    enableGrouping: true,
    enableCalculations: false,
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
    kanban: {
      allowDragUpdate: true,
      cardColumnIds: ["brand", "category", "price", "isActive"],
      groupBy: "status",
      groups: [
        { value: "In Stock" },
        { value: "Low Stock" },
        { value: "Out of Stock" },
      ],
      titleColumn: "name",
    },
    pageSizeOptions: [10, 50, 100],
    dateDisplayPreset: "localized-medium",
    columns: {
      definitions: [
        {
          id: "name",
          type: "text",
          header: copy.headers.name,
          size: 260,
          minSize: 200,
          enableSorting: true,
          enableColumnFilter: true,
          inlineEdit: true,
        },
        {
          id: "brand",
          type: "text",
          header: copy.headers.brand,
          size: 170,
          minSize: 140,
          enableSorting: true,
          enableColumnFilter: true,
          inlineEdit: true,
        },
        {
          id: "category",
          type: "select",
          displayVariant: "tag",
          header: copy.headers.category,
          size: 170,
          minSize: 140,
          enableSorting: true,
          enableColumnFilter: true,
          tagColorMap: {
            Electronics: "bg-blue-500/80 text-white dark:bg-blue-600/90",
            Furniture: "bg-amber-500/80 text-white dark:bg-amber-600/90",
            Wearables: "bg-indigo-500/80 text-white dark:bg-indigo-600/90",
          },
        },
        {
          id: "price",
          type: "number",
          header: copy.headers.price,
          size: 120,
          minSize: 100,
          maxSize: 140,
          enableSorting: true,
          enableColumnFilter: true,
          defaultCalculation: "average",
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
          type: "select",
          displayVariant: "tag",
          header: copy.headers.status,
          size: 150,
          minSize: 130,
          enableSorting: true,
          enableColumnFilter: true,
          tagColorMap: {
            "In Stock": "bg-green-500/80 text-white dark:bg-green-600/90",
            "Low Stock": "bg-orange-500/80 text-white dark:bg-orange-600/90",
            "Out of Stock": "bg-red-500/80 text-white dark:bg-red-600/90",
          },
        },
        {
          id: "createdAt",
          type: "date",
          header: copy.headers.created,
          size: 140,
          minSize: 120,
          maxSize: 160,
          enableSorting: true,
          enableColumnFilter: true,
          dateDisplayPreset: "dmy-numeric",
        },
        {
          id: "website",
          type: "url",
          header: copy.headers.website,
          size: 84,
          minSize: 77,
          maxSize: 96,
          enableSorting: true,
          enableColumnFilter: true,
          urlDisplayMode: "icon",
          inlineEdit: false,
        },
        {
          id: "isActive",
          type: "boolean",
          header: copy.headers.active,
          size: 110,
          minSize: 100,
          maxSize: 130,
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
        "website",
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
        "website",
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
    aggregate: aggregateProductsAction,
    list: listProducts,
    create: createProduct,
    update: updateProduct,
    delete: deleteProduct,
    bulkDelete,
    bulkCopy,
    bulkUpdate,
  };
};
