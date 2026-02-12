"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { useQueryState } from "nuqs";
import { useCallback, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/custom/theme-toggle";
import { Switch } from "@/components/ui/switch";
import {
  activeColumnDragAtom,
  columnDragEnabledAtom,
} from "@/src/components/ui/yayaw-table/atoms/table-atoms";
import { DataTable } from "@/src/components/ui/yayaw-table/components/data-table";
import { useBulkEdit } from "@/src/components/ui/yayaw-table/hooks/use-bulk-edit";
import { CustomDescription, CustomTitle } from "./components";
import { getFormConfig } from "./setup/form-config";
import { getTableActions, getTableConfig } from "./setup/table-config";

const queryClient = new QueryClient();

interface ExampleTableSettings {
  actionsAsIcons: boolean;
  bulkExport: boolean;
  enableColumnDnd: boolean;
  enableColumnFilters: boolean;
  enableGrouping: boolean;
  enablePagination: boolean;
  enableRowSelection: boolean;
  enableSorting: boolean;
  export: boolean;
}

type TableSettingKey = keyof ExampleTableSettings;

interface SettingDefinition {
  description: string;
  key: TableSettingKey;
  label: string;
}

interface BooleanQuerySettingController {
  resetValue: () => void;
  setValue: (nextValue: boolean) => void;
  value: boolean;
}

const DEFAULT_TABLE_SETTINGS: ExampleTableSettings = {
  actionsAsIcons: true,
  bulkExport: true,
  enableColumnDnd: true,
  enableColumnFilters: true,
  enableGrouping: true,
  enablePagination: true,
  enableRowSelection: true,
  enableSorting: true,
  export: true,
};

const CORE_FEATURE_SETTINGS: SettingDefinition[] = [
  {
    key: "enableRowSelection",
    label: "Row selection",
    description: "Enable checkbox selection and bulk actions.",
  },
  {
    key: "enableColumnFilters",
    label: "Column filters",
    description: "Enable search and filters in toolbar/options.",
  },
  {
    key: "enableSorting",
    label: "Sorting",
    description: "Enable sorting from headers and Options menu.",
  },
  {
    key: "enableGrouping",
    label: "Grouping",
    description: "Enable row grouping controls.",
  },
  {
    key: "enableColumnDnd",
    label: "Column drag & drop",
    description: "Enable drag & drop controls in column headers/menu.",
  },
  {
    key: "enablePagination",
    label: "Pagination",
    description: "Enable page navigation and page-size selector.",
  },
];

const EXPORT_SETTINGS: SettingDefinition[] = [
  {
    key: "export",
    label: "Toolbar export",
    description: "Show CSV export button in toolbar.",
  },
  {
    key: "bulkExport",
    label: "Bulk export",
    description: "Show CSV export action in bulk menu.",
  },
  {
    key: "actionsAsIcons",
    label: "Icon toolbar actions",
    description: "Render toolbar actions as icon-only with tooltips.",
  },
];

const ALL_SETTING_DEFINITIONS: SettingDefinition[] = [
  ...CORE_FEATURE_SETTINGS,
  ...EXPORT_SETTINGS,
];

const TABLE_SETTING_KEYS: TableSettingKey[] = ALL_SETTING_DEFINITIONS.map(
  (setting) => setting.key
);

const parseBooleanQueryValue = (
  rawValue: string | null,
  defaultValue: boolean
) => {
  if (rawValue === "1") {
    return true;
  }

  if (rawValue === "0") {
    return false;
  }

  return defaultValue;
};

function useBooleanQuerySetting(
  queryKey: string,
  defaultValue: boolean
): BooleanQuerySettingController {
  const [rawValue, setRawValue] = useQueryState(queryKey);

  const value = useMemo(
    () => parseBooleanQueryValue(rawValue, defaultValue),
    [rawValue, defaultValue]
  );

  const setValue = useCallback(
    (nextValue: boolean) => {
      setRawValue(nextValue ? "1" : "0");
    },
    [setRawValue]
  );

  const resetValue = useCallback(() => {
    setRawValue(null);
  }, [setRawValue]);

  return useMemo(
    () => ({ value, setValue, resetValue }),
    [value, setValue, resetValue]
  );
}

function SettingsGroup({
  onSettingChange,
  settings,
  tableSettings,
  title,
}: {
  onSettingChange: (key: TableSettingKey, value: boolean) => void;
  settings: SettingDefinition[];
  tableSettings: ExampleTableSettings;
  title: string;
}) {
  return (
    <div className="space-y-3">
      <h3 className="font-medium text-card-foreground text-sm">{title}</h3>
      <div className="space-y-2">
        {settings.map((setting) => (
          <div
            className="flex items-center justify-between gap-3 rounded-md border border-border p-3"
            key={setting.key}
          >
            <div className="space-y-1">
              <p className="font-medium text-card-foreground text-sm">
                {setting.label}
              </p>
              <p className="text-muted-foreground text-xs">
                {setting.description}
              </p>
            </div>
            <Switch
              aria-label={setting.label}
              checked={tableSettings[setting.key]}
              onCheckedChange={(checked) => {
                onSettingChange(setting.key, checked === true);
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function ExampleSettingsPanel({
  onResetSettings,
  onSettingChange,
  tableSettings,
}: {
  onResetSettings: () => void;
  onSettingChange: (key: TableSettingKey, value: boolean) => void;
  tableSettings: ExampleTableSettings;
}) {
  return (
    <section className="mb-6 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-card-foreground text-lg">
            Table Settings
          </h2>
          <p className="text-muted-foreground text-sm">
            Switch features live. Settings are persisted in URL query params.
          </p>
        </div>
        <Button
          onClick={onResetSettings}
          size="sm"
          type="button"
          variant="outline"
        >
          Reset settings
        </Button>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <SettingsGroup
          onSettingChange={onSettingChange}
          settings={CORE_FEATURE_SETTINGS}
          tableSettings={tableSettings}
          title="Core Features"
        />
        <SettingsGroup
          onSettingChange={onSettingChange}
          settings={EXPORT_SETTINGS}
          tableSettings={tableSettings}
          title="Export & Toolbar"
        />
      </div>
    </section>
  );
}

function BulkActionsSection({
  tableSettings,
}: {
  tableSettings: ExampleTableSettings;
}) {
  const actions = getTableActions("products") as
    | {
        bulkDelete?: (
          ids: string[]
        ) => Promise<{ success: boolean; data?: unknown; error?: string }>;
        bulkCopy?: (
          ids: string[]
        ) => Promise<{ success: boolean; data?: string; error?: string }>;
      }
    | undefined;

  const handleBulkDelete = async (
    rows: Array<{ original: { id?: unknown } }>
  ) => {
    if (!actions?.bulkDelete) {
      toast.error("Delete action not available");
      return;
    }

    try {
      const ids = rows.map((row) => String(row.original.id ?? ""));
      const result = await actions.bulkDelete(ids);

      if (result.success) {
        toast.success(`✅ Deleted ${rows.length} products successfully!`);
      } else {
        toast.error(result.error || "Failed to delete products");
      }
    } catch {
      toast.error("❌ Failed to delete products");
    }
  };

  const handleBulkCopy = async (
    rows: Array<{ original: { id?: unknown } }>
  ) => {
    if (!actions?.bulkCopy) {
      toast.error("Copy action not available");
      return;
    }

    try {
      const ids = rows.map((row) => String(row.original.id ?? ""));
      const result = await actions.bulkCopy(ids);

      if (result.success && result.data) {
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(result.data);
          toast.success(`📋 Copied ${rows.length} products to clipboard!`);
        } else {
          const textArea = document.createElement("textarea");
          textArea.value = result.data;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand("copy");
          document.body.removeChild(textArea);
          toast.success(`📋 Copied ${rows.length} products to clipboard!`);
        }
      } else {
        toast.error(result.error || "Failed to copy products");
      }
    } catch {
      toast.error("❌ Failed to copy products to clipboard");
    }
  };

  const bulkEdit = useBulkEdit({
    tableId: "products",
    formType: "products-bulk",
    onSuccess: () => {
      /* intentional no-op */
    },
    onUpdate: async () => true,
  });

  const getTableConfigWithOverrides = useCallback(
    (tableType: string) => {
      const baseConfig = getTableConfig(tableType);
      if (!baseConfig) {
        return;
      }

      return {
        ...baseConfig,
        ...tableSettings,
      };
    },
    [tableSettings]
  );

  return (
    <DataTable
      className="w-full"
      columnTypeMapping={{
        name: "text",
        brand: "text",
        category: "option",
        price: "number",
        status: "option",
        createdAt: "date",
        isActive: "option",
      }}
      DescriptionComponent={CustomDescription}
      description="Production-ready table with server-side pagination, filtering, and sorting. Select multiple rows to see bulk actions!"
      enableAdvancedFilters={true}
      enableToolbar={true}
      getFormConfig={getFormConfig}
      getTableActions={getTableActions}
      getTableConfig={getTableConfigWithOverrides}
      loadingOverlay={
        <div className="flex items-center justify-center p-8 text-muted-foreground">
          Loading products…
        </div>
      }
      locale="en"
      onBulkCopy={handleBulkCopy}
      onBulkDelete={handleBulkDelete}
      onBulkEdit={(rows) => bulkEdit.openBulkEdit(rows as never)}
      onRowSelectionChange={undefined}
      queryClient={queryClient}
      TitleComponent={CustomTitle}
      tableType="products"
      title="Products Management"
    />
  );
}

export default function ExamplePage() {
  const setColumnDragEnabled = useSetAtom(columnDragEnabledAtom("products"));
  const setActiveColumnDrag = useSetAtom(activeColumnDragAtom("products"));

  const enableRowSelectionSetting = useBooleanQuerySetting(
    "excfg-rs",
    DEFAULT_TABLE_SETTINGS.enableRowSelection
  );
  const enableColumnFiltersSetting = useBooleanQuerySetting(
    "excfg-cf",
    DEFAULT_TABLE_SETTINGS.enableColumnFilters
  );
  const enableColumnDndSetting = useBooleanQuerySetting(
    "excfg-cd",
    DEFAULT_TABLE_SETTINGS.enableColumnDnd
  );
  const enableSortingSetting = useBooleanQuerySetting(
    "excfg-so",
    DEFAULT_TABLE_SETTINGS.enableSorting
  );
  const enableGroupingSetting = useBooleanQuerySetting(
    "excfg-gp",
    DEFAULT_TABLE_SETTINGS.enableGrouping
  );
  const enablePaginationSetting = useBooleanQuerySetting(
    "excfg-pg",
    DEFAULT_TABLE_SETTINGS.enablePagination
  );
  const exportSetting = useBooleanQuerySetting(
    "excfg-ex",
    DEFAULT_TABLE_SETTINGS.export
  );
  const bulkExportSetting = useBooleanQuerySetting(
    "excfg-bx",
    DEFAULT_TABLE_SETTINGS.bulkExport
  );
  const actionsAsIconsSetting = useBooleanQuerySetting(
    "excfg-ai",
    DEFAULT_TABLE_SETTINGS.actionsAsIcons
  );

  const tableSettings = useMemo<ExampleTableSettings>(
    () => ({
      actionsAsIcons: actionsAsIconsSetting.value,
      bulkExport: bulkExportSetting.value,
      enableColumnDnd: enableColumnDndSetting.value,
      enableColumnFilters: enableColumnFiltersSetting.value,
      enableGrouping: enableGroupingSetting.value,
      enablePagination: enablePaginationSetting.value,
      enableRowSelection: enableRowSelectionSetting.value,
      enableSorting: enableSortingSetting.value,
      export: exportSetting.value,
    }),
    [
      actionsAsIconsSetting.value,
      bulkExportSetting.value,
      enableColumnDndSetting.value,
      enableColumnFiltersSetting.value,
      enableGroupingSetting.value,
      enablePaginationSetting.value,
      enableRowSelectionSetting.value,
      enableSortingSetting.value,
      exportSetting.value,
    ]
  );

  const settingControllers = useMemo<
    Record<TableSettingKey, BooleanQuerySettingController>
  >(
    () => ({
      actionsAsIcons: actionsAsIconsSetting,
      bulkExport: bulkExportSetting,
      enableColumnDnd: enableColumnDndSetting,
      enableColumnFilters: enableColumnFiltersSetting,
      enableGrouping: enableGroupingSetting,
      enablePagination: enablePaginationSetting,
      enableRowSelection: enableRowSelectionSetting,
      enableSorting: enableSortingSetting,
      export: exportSetting,
    }),
    [
      actionsAsIconsSetting,
      bulkExportSetting,
      enableColumnDndSetting,
      enableColumnFiltersSetting,
      enableGroupingSetting,
      enablePaginationSetting,
      enableRowSelectionSetting,
      enableSortingSetting,
      exportSetting,
    ]
  );

  const setTableSetting = useCallback(
    (key: TableSettingKey, value: boolean) => {
      settingControllers[key].setValue(value);
    },
    [settingControllers]
  );

  const resetTableSettings = useCallback(() => {
    for (const key of TABLE_SETTING_KEYS) {
      settingControllers[key].resetValue();
    }
  }, [settingControllers]);

  const [, setProductsSearchParam] = useQueryState("products-q");
  const [, setProductsFiltersParam] = useQueryState("products-filters");
  const [, setProductsAdvancedFiltersParam] = useQueryState(
    "products-advancedFilters"
  );
  const [, setProductsSortParam] = useQueryState("products-sort");
  const [, setProductsGroupingParam] = useQueryState("products-grouping");
  const [, setProductsExpandedParam] = useQueryState("products-expanded");
  const [, setProductsPageParam] = useQueryState("products-page");

  useEffect(() => {
    if (tableSettings.enableColumnFilters) {
      return;
    }

    setProductsSearchParam(null);
    setProductsFiltersParam(null);
    setProductsAdvancedFiltersParam(null);
    setProductsPageParam("0");
    queryClient
      .invalidateQueries({
        queryKey: ["tableData", "products"],
      })
      .catch(() => {
        /* ignore invalidation errors */
      });
  }, [
    tableSettings.enableColumnFilters,
    setProductsSearchParam,
    setProductsFiltersParam,
    setProductsAdvancedFiltersParam,
    setProductsPageParam,
  ]);

  useEffect(() => {
    if (tableSettings.enableSorting) {
      return;
    }

    setProductsSortParam(null);
    setProductsPageParam("0");
    queryClient
      .invalidateQueries({
        queryKey: ["tableData", "products"],
      })
      .catch(() => {
        /* ignore invalidation errors */
      });
  }, [tableSettings.enableSorting, setProductsSortParam, setProductsPageParam]);

  useEffect(() => {
    if (tableSettings.enableGrouping) {
      return;
    }

    setProductsGroupingParam(null);
    setProductsExpandedParam(null);
    queryClient
      .invalidateQueries({
        queryKey: ["tableData", "products"],
      })
      .catch(() => {
        /* ignore invalidation errors */
      });
  }, [
    tableSettings.enableGrouping,
    setProductsGroupingParam,
    setProductsExpandedParam,
  ]);

  useEffect(() => {
    if (tableSettings.enableColumnDnd) {
      return;
    }

    setColumnDragEnabled(false);
    setActiveColumnDrag(null);
  }, [
    tableSettings.enableColumnDnd,
    setColumnDragEnabled,
    setActiveColumnDrag,
  ]);

  return (
    <div className="min-h-screen bg-background p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header with Theme Toggle */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-3xl text-foreground tracking-tight">
              YaYaw Table Demo
            </h1>
            <p className="mt-2 text-muted-foreground">
              Experience the power of advanced data tables with theme support
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* Navigation */}
            <div className="mt-8 flex justify-center gap-4">
              <a
                className="inline-flex items-center rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                href="/docs"
              >
                📚 Read Documentation
              </a>
              <a
                className="inline-flex items-center rounded-lg bg-secondary px-6 py-3 font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
                href="/"
              >
                🏠 Back Home
              </a>
              <ThemeToggle variant="switch" />
            </div>
          </div>
        </div>

        <ExampleSettingsPanel
          onResetSettings={resetTableSettings}
          onSettingChange={setTableSetting}
          tableSettings={tableSettings}
        />

        {/* Data Table */}
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="p-6">
            <QueryClientProvider client={queryClient}>
              <BulkActionsSection tableSettings={tableSettings} />
            </QueryClientProvider>
          </div>
        </div>

        {/* Code Example */}
        <div className="mt-8 rounded-lg border border-border bg-card p-6">
          <h3 className="mb-4 text-card-foreground">📋 Configuration Used</h3>
          <div className="overflow-x-auto rounded-md bg-muted p-4">
            <pre className="text-muted-foreground text-sm">
              {`// 1. Configuration via provider
const getTableConfig = (tableType: string) => {
  if (tableType === "products") {
    return {
      table: { 
        enableRowSelection: true,
        enableColumnFilters: true,
        enableColumnDnd: true,
        enableSorting: true,
        enableGrouping: true,
        enablePagination: true,
        export: true,
        bulkExport: true,
        actionsAsIcons: false
      },
      columns: {
        definitions: [
          { id: "name", type: "text", header: "Product Name" },
          { id: "brand", type: "text", header: "Brand" },
          { id: "category", type: "tag", header: "Category" },
          { id: "price", type: "number", header: "Price" },
          { id: "status", type: "tag", header: "Status" },
          { id: "createdAt", type: "date", header: "Created" },
          { id: "isActive", type: "boolean", header: "Active" }
        ]
      }
    }
  }
}

// 2. Production Table with Real API
<DataTable 
  tableType="products"
  enableAdvancedFilters={true}
  columnTypeMapping={{
    name: 'text',
    brand: 'text', 
    category: 'option',  // tag -> option for dropdown
    price: 'number',
    status: 'option',    // tag -> option for dropdown  
    createdAt: 'date',
    isActive: 'option'   // boolean -> option for true/false
  }}
/>

// ✅ Server-side API with pagination, filtering, and sorting!
// 🎨 Try switching themes with the toggle in the top-right!`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
