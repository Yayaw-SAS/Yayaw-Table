"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { GalleryHorizontal } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useQueryState } from "nuqs";
import { useCallback, useEffect, useMemo } from "react";
import type { FieldValues } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { SiteHeader } from "@/src/components/site/site-header";
import {
  activeColumnDragAtom,
  columnDragEnabledAtom,
} from "@/src/components/ui/yayaw-table/atoms/table-atoms";
import { DataTable } from "@/src/components/ui/yayaw-table/components/data-table";
import {
  type CatalogueFormState,
  catalogueFormAtom,
  openUpdateForm,
} from "@/src/components/ui/yayaw-table/components/forms/atoms/catalogue-form-atoms";
import type { TableActions } from "@/src/components/ui/yayaw-table/providers/table-provider";
import type { AppLocale } from "@/src/i18n/routing";
import { CustomDescription, CustomTitle } from "./components";
import {
  createProductsLocalActions,
  type ProductsLocalActions,
} from "./lib/products-local-actions";
import { getFormConfig } from "./setup/form-config";
import { getTableConfig } from "./setup/table-config";

const queryClient = new QueryClient();
const PRODUCTS_TABLE_TYPE = "products";
const PRODUCTS_BULK_FORM_TYPE = "products-bulk";
const BULK_EDIT_SYNTHETIC_ID = "__bulk-edit__";

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
  key: TableSettingKey;
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
  },
  {
    key: "enableColumnFilters",
  },
  {
    key: "enableSorting",
  },
  {
    key: "enableGrouping",
  },
  {
    key: "enableColumnDnd",
  },
  {
    key: "enablePagination",
  },
];

const EXPORT_SETTINGS: SettingDefinition[] = [
  {
    key: "export",
  },
  {
    key: "bulkExport",
  },
  {
    key: "actionsAsIcons",
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

function extractIdsFromRows(
  rows: Array<{ original: { id?: unknown } }>
): string[] {
  const ids = rows
    .map((row) => row.original.id)
    .filter((value): value is string | number => value != null)
    .map((value) => String(value))
    .filter((value) => value.length > 0);

  return [...new Set(ids)];
}

function extractBulkEditSelectedIds(data: Record<string, unknown>): string[] {
  const rawBulkEdit = data._bulkEdit;
  if (!rawBulkEdit || typeof rawBulkEdit !== "object") {
    return [];
  }

  const selectedIds = (rawBulkEdit as { selectedIds?: unknown }).selectedIds;
  if (!Array.isArray(selectedIds)) {
    return [];
  }

  return selectedIds
    .filter((value): value is string | number => value != null)
    .map((value) => String(value))
    .filter((value) => value.length > 0);
}

function sanitizeBulkUpdatePayload(
  data: Record<string, unknown>
): Record<string, unknown> {
  const { id: _id, _bulkEdit, ...payload } = data;

  return Object.fromEntries(
    Object.entries(payload).filter(
      ([, value]) => value !== undefined && value !== null && value !== ""
    )
  );
}

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
  const t = useTranslations("Example");

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
                {t(`feature.${setting.key}.label`)}
              </p>
              <p className="text-muted-foreground text-xs">
                {t(`feature.${setting.key}.description`)}
              </p>
            </div>
            <Switch
              aria-label={t(`feature.${setting.key}.label`)}
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
  onResetData,
  onResetSettings,
  onSettingChange,
  tableSettings,
}: {
  onResetData: () => void;
  onResetSettings: () => void;
  onSettingChange: (key: TableSettingKey, value: boolean) => void;
  tableSettings: ExampleTableSettings;
}) {
  const t = useTranslations("Example");

  return (
    <section className="mb-6 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-card-foreground text-lg">
            {t("settingsTitle")}
          </h2>
          <p className="text-muted-foreground text-sm">
            {t("settingsDescription")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={onResetSettings}
            size="sm"
            type="button"
            variant="outline"
          >
            {t("resetSettings")}
          </Button>
          <Button
            onClick={onResetData}
            size="sm"
            type="button"
            variant="outline"
          >
            {t("resetData")}
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <SettingsGroup
          onSettingChange={onSettingChange}
          settings={CORE_FEATURE_SETTINGS}
          tableSettings={tableSettings}
          title={t("coreFeatures")}
        />
        <SettingsGroup
          onSettingChange={onSettingChange}
          settings={EXPORT_SETTINGS}
          tableSettings={tableSettings}
          title={t("exportToolbar")}
        />
      </div>
    </section>
  );
}

function BulkActionsSection({
  tableActions,
  tableSettings,
}: {
  tableActions: ProductsLocalActions;
  tableSettings: ExampleTableSettings;
}) {
  const t = useTranslations("Example");
  const locale = useLocale() as AppLocale;
  const setFormState = useSetAtom(catalogueFormAtom);

  const getLocalTableActions = useCallback(
    (formType: string): TableActions | undefined => {
      if (formType === PRODUCTS_TABLE_TYPE) {
        return tableActions;
      }

      if (formType === PRODUCTS_BULK_FORM_TYPE) {
        return {
          update: async (_id: string, data: Record<string, unknown>) => {
            const selectedIds = extractBulkEditSelectedIds(data);
            if (selectedIds.length === 0) {
              return {
                success: false,
                error: t("toasts.bulkEditNoRowsSelected"),
              };
            }

            const payload = sanitizeBulkUpdatePayload(data);
            if (Object.keys(payload).length === 0) {
              return {
                success: false,
                error: t("toasts.bulkEditNoChanges"),
              };
            }

            const result = await tableActions.bulkUpdate(selectedIds, payload);
            if (!result.success) {
              return {
                success: false,
                error: result.error || "Failed to update selected rows.",
              };
            }

            await queryClient.invalidateQueries({
              queryKey: ["tableData", PRODUCTS_TABLE_TYPE],
            });

            return {
              success: true,
              data: result.data,
            };
          },
        };
      }

      return;
    },
    [tableActions, t]
  );

  const handleBulkDelete = async (
    rows: Array<{ original: { id?: unknown } }>
  ) => {
    if (!tableActions.bulkDelete) {
      return {
        clearSelection: false,
        closeMenu: false,
        message: t("toasts.deleteUnavailable"),
        success: false,
      };
    }

    try {
      const ids = rows.map((row) => String(row.original.id ?? ""));
      const result = await tableActions.bulkDelete(ids);

      if (!result.success) {
        return {
          clearSelection: false,
          closeMenu: false,
          message: result.error || t("toasts.deleteError"),
          success: false,
        };
      }

      await queryClient.invalidateQueries({
        queryKey: ["tableData", PRODUCTS_TABLE_TYPE],
      });

      return {
        clearSelection: true,
        closeMenu: true,
        message: t("toasts.deleteSuccess", { count: rows.length }),
        success: true,
      };
    } catch {
      return {
        clearSelection: false,
        closeMenu: false,
        message: t("toasts.deleteError"),
        success: false,
      };
    }
  };

  const handleBulkCopy = async (
    rows: Array<{ original: { id?: unknown } }>
  ) => {
    if (!tableActions.bulkCopy) {
      return {
        clearSelection: false,
        closeMenu: false,
        message: t("toasts.copyUnavailable"),
        success: false,
      };
    }

    try {
      const ids = rows.map((row) => String(row.original.id ?? ""));
      const result = await tableActions.bulkCopy(ids);

      if (result.success && result.data) {
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(result.data);
        } else {
          const textArea = document.createElement("textarea");
          textArea.value = result.data;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand("copy");
          document.body.removeChild(textArea);
        }

        return {
          clearSelection: false,
          closeMenu: true,
          message: t("toasts.copySuccess", { count: rows.length }),
          success: true,
        };
      }

      return {
        clearSelection: false,
        closeMenu: false,
        message: result.error || t("toasts.copyError"),
        success: false,
      };
    } catch {
      return {
        clearSelection: false,
        closeMenu: false,
        message: t("toasts.copyError"),
        success: false,
      };
    }
  };

  const handleBulkEdit = useCallback(
    (rows: Array<{ original: { id?: unknown } }>) => {
      const selectedIds = extractIdsFromRows(rows);
      if (selectedIds.length === 0) {
        return {
          clearSelection: false,
          closeMenu: false,
          message: t("toasts.bulkEditNoRowsInMenu"),
          success: false,
        };
      }

      const bulkFormState = openUpdateForm<Record<string, unknown>>(
        PRODUCTS_BULK_FORM_TYPE,
        PRODUCTS_TABLE_TYPE,
        {
          id: BULK_EDIT_SYNTHETIC_ID,
          _bulkEdit: {
            selectedIds,
          },
        },
        undefined
      );

      setFormState(
        bulkFormState as CatalogueFormState<Record<string, unknown>>
      );

      return {
        clearSelection: false,
        closeMenu: true,
        success: true,
      };
    },
    [setFormState, t]
  );

  const getTableConfigWithOverrides = useCallback(
    (tableType: string) => {
      const baseConfig = getTableConfig(tableType, locale);
      if (!baseConfig) {
        return;
      }

      return {
        ...baseConfig,
        ...tableSettings,
      };
    },
    [locale, tableSettings]
  );

  const getFormConfigWithLocale = useCallback(
    <TFieldValues extends FieldValues = FieldValues>(formType: string) =>
      getFormConfig<TFieldValues>(formType, locale),
    [locale]
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
      description={t("description")}
      enableAdvancedFilters={true}
      enableToolbar={true}
      getFormConfig={getFormConfigWithLocale}
      getTableActions={getLocalTableActions}
      getTableConfig={getTableConfigWithOverrides}
      loadingOverlay={
        <div className="flex items-center justify-center p-8 text-muted-foreground">
          {t("loadingExample")}
        </div>
      }
      locale={locale}
      onBulkCopy={handleBulkCopy}
      onBulkDelete={handleBulkDelete}
      onBulkEdit={handleBulkEdit}
      onRowSelectionChange={undefined}
      queryClient={queryClient}
      TitleComponent={CustomTitle}
      tableType="products"
      title={t("title")}
    />
  );
}

export default function ExamplePage() {
  const t = useTranslations("Example");
  const setColumnDragEnabled = useSetAtom(columnDragEnabledAtom("products"));
  const setActiveColumnDrag = useSetAtom(activeColumnDragAtom("products"));
  const localTableActions = useMemo(() => createProductsLocalActions(), []);

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
  const fullWidthSetting = useBooleanQuerySetting("excfg-fw", false);

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

  const handleResetData = useCallback(async () => {
    const result = await localTableActions.resetData();
    if (!result.success) {
      toast.error(result.error || t("toasts.resetDataError"));
      return;
    }

    try {
      await queryClient.invalidateQueries({
        queryKey: ["tableData", PRODUCTS_TABLE_TYPE],
      });
      toast.success(t("toasts.resetDataSuccess"));
    } catch {
      toast.error(t("toasts.resetDataError"));
    }
  }, [localTableActions, t]);

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
        queryKey: ["tableData", PRODUCTS_TABLE_TYPE],
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
        queryKey: ["tableData", PRODUCTS_TABLE_TYPE],
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
        queryKey: ["tableData", PRODUCTS_TABLE_TYPE],
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

  const handleFullWidthToggle = useCallback(() => {
    fullWidthSetting.setValue(!fullWidthSetting.value);
  }, [fullWidthSetting]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="p-6 lg:p-8">
        <div
          className={fullWidthSetting.value ? "w-full" : "mx-auto max-w-7xl"}
        >
          <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-display font-semibold text-3xl text-foreground tracking-tight">
                {t("title")}
              </h1>
              <p className="mt-2 text-muted-foreground">{t("description")}</p>
            </div>
            <Button
              aria-label={
                fullWidthSetting.value
                  ? t("fullWidthDisable")
                  : t("fullWidthEnable")
              }
              aria-pressed={fullWidthSetting.value}
              className="shrink-0"
              onClick={handleFullWidthToggle}
              size="icon"
              title={
                fullWidthSetting.value
                  ? t("layoutConstrained")
                  : t("layoutFull")
              }
              type="button"
              variant="ghost"
            >
              <GalleryHorizontal aria-hidden className="size-4" />
            </Button>
          </div>

          <ExampleSettingsPanel
            onResetData={handleResetData}
            onResetSettings={resetTableSettings}
            onSettingChange={setTableSetting}
            tableSettings={tableSettings}
          />

          {/* Data Table */}
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <div className="p-6">
              <QueryClientProvider client={queryClient}>
                <BulkActionsSection
                  tableActions={localTableActions}
                  tableSettings={tableSettings}
                />
              </QueryClientProvider>
            </div>
          </div>

          {/* Code Example */}
          <div className="mt-8 rounded-lg border border-border bg-card p-6">
            <h3 className="mb-4 text-card-foreground">
              {t("configurationUsed")}
            </h3>
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
          {
            id: "price",
            type: "number",
            header: "Price",
            numberFormat: {
              thousandsSeparator: " ",
              decimals: 0,
              suffix: " €",
            },
          },
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

// Local data API with pagination, filtering, and sorting.
// Edits persist in localStorage and can be reset from the settings panel.`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
