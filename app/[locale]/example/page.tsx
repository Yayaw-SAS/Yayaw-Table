"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { GalleryHorizontal, RefreshCw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useQueryState } from "nuqs";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FieldValues } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
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
import type {
  ToolbarAction,
  ToolbarActionContext,
} from "@/src/components/ui/yayaw-table/types/toolbar-types";
import type { AppLocale } from "@/src/i18n/routing";
import { CustomDescription, CustomTitle } from "./components";
import {
  createProductsLocalActions,
  type ProductsLocalActions,
} from "./lib/products-local-actions";
import { getFormConfig } from "./setup/form-config";
import { getTableConfig } from "./setup/table-config";
import { getTableTranslations } from "./setup/table-translations";

const queryClient = new QueryClient();
const PRODUCTS_TABLE_TYPE = "products";
const PRODUCTS_BULK_FORM_TYPE = "products-bulk";
const BULK_EDIT_SYNTHETIC_ID = "__bulk-edit__";
const DEFAULT_DENSITY_MODE = "medium" as const;

type ExampleDensityMode = "small" | "medium" | "large";

interface ExampleTableSettings {
  allowBulkDelete: boolean;
  allowBulkEdit: boolean;
  allowCreate: boolean;
  allowDelete: boolean;
  allowDuplicate: boolean;
  allowEdit: boolean;
  allowInlineEdit: boolean;
  actionsAsIcons: boolean;
  bulkExport: boolean;
  enableColumnDnd: boolean;
  enableColumnFilters: boolean;
  enableCalculations: boolean;
  enableGrouping: boolean;
  enablePagination: boolean;
  enableRowClickEdit: boolean;
  enableRowSelection: boolean;
  enableSorting: boolean;
  export: boolean;
  showActionsColumn: boolean;
  showSelectionColumn: boolean;
  showToolbar: boolean;
  showToolbarHeader: boolean;
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
  allowBulkDelete: true,
  allowBulkEdit: true,
  allowCreate: true,
  allowDelete: true,
  allowDuplicate: true,
  allowEdit: true,
  allowInlineEdit: true,
  actionsAsIcons: true,
  bulkExport: true,
  enableColumnDnd: true,
  enableColumnFilters: true,
  enableCalculations: false,
  enableGrouping: true,
  enablePagination: true,
  enableRowClickEdit: false,
  enableRowSelection: true,
  enableSorting: true,
  export: true,
  showActionsColumn: true,
  showSelectionColumn: true,
  showToolbar: true,
  showToolbarHeader: true,
};

const STYLE_SETTINGS: SettingDefinition[] = [
  {
    key: "showToolbar",
  },
  {
    key: "enablePagination",
  },
  {
    key: "actionsAsIcons",
  },
  {
    key: "showToolbarHeader",
  },
];

const FEATURE_SETTINGS: SettingDefinition[] = [
  {
    key: "enableRowSelection",
  },
  {
    key: "showSelectionColumn",
  },
  {
    key: "showActionsColumn",
  },
  {
    key: "enableRowClickEdit",
  },
  {
    key: "enableColumnFilters",
  },
  {
    key: "enableCalculations",
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
];

const AUTHORIZATION_SETTINGS: SettingDefinition[] = [
  {
    key: "export",
  },
  {
    key: "bulkExport",
  },
  {
    key: "allowCreate",
  },
  {
    key: "allowEdit",
  },
  {
    key: "allowDuplicate",
  },
  {
    key: "allowDelete",
  },
  {
    key: "allowBulkEdit",
  },
  {
    key: "allowBulkDelete",
  },
  {
    key: "allowInlineEdit",
  },
];

const ALL_SETTING_DEFINITIONS: SettingDefinition[] = [
  ...STYLE_SETTINGS,
  ...FEATURE_SETTINGS,
  ...AUTHORIZATION_SETTINGS,
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

function parseDensityQueryValue(rawValue: string | null): ExampleDensityMode {
  if (rawValue === "small" || rawValue === "medium" || rawValue === "large") {
    return rawValue;
  }

  return DEFAULT_DENSITY_MODE;
}

function resolveConflictingEditModes(
  settings: ExampleTableSettings
): ExampleTableSettings {
  if (!(settings.enableRowClickEdit && settings.allowInlineEdit)) {
    return settings;
  }

  return {
    ...settings,
    allowInlineEdit: false,
  };
}

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

function DensitySettingCard({
  density,
  onDensityChange,
}: {
  density: ExampleDensityMode;
  onDensityChange: (nextDensity: ExampleDensityMode) => void;
}) {
  const t = useTranslations("Example");

  const densityOptions: ExampleDensityMode[] = ["small", "medium", "large"];

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <div className="space-y-1">
        <p className="font-medium text-card-foreground text-sm">
          {t("densityMode.label")}
        </p>
        <p className="text-muted-foreground text-xs">
          {t("densityMode.description")}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {densityOptions.map((option) => (
          <Button
            key={option}
            onClick={() => {
              onDensityChange(option);
            }}
            size="sm"
            type="button"
            variant={density === option ? "default" : "outline"}
          >
            {t(`densityMode.${option}`)}
          </Button>
        ))}
      </div>
    </div>
  );
}

function ExampleSettingsPanel({
  density,
  onDensityChange,
  onResetData,
  onResetSettings,
  onSettingChange,
  tableSettings,
}: {
  density: ExampleDensityMode;
  onDensityChange: (nextDensity: ExampleDensityMode) => void;
  onResetData: () => void;
  onResetSettings: () => void;
  onSettingChange: (key: TableSettingKey, value: boolean) => void;
  tableSettings: ExampleTableSettings;
}) {
  const t = useTranslations("Example");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-2xl">
          {t("settingsTitle")}
        </CardTitle>
        <CardDescription>{t("settingsDescription")}</CardDescription>
        <CardAction>
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
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4">
            <SettingsGroup
              onSettingChange={onSettingChange}
              settings={STYLE_SETTINGS}
              tableSettings={tableSettings}
              title={t("styleBlock")}
            />
            <DensitySettingCard
              density={density}
              onDensityChange={onDensityChange}
            />
          </div>
          <SettingsGroup
            onSettingChange={onSettingChange}
            settings={FEATURE_SETTINGS}
            tableSettings={tableSettings}
            title={t("featuresBlock")}
          />
          <SettingsGroup
            onSettingChange={onSettingChange}
            settings={AUTHORIZATION_SETTINGS}
            tableSettings={tableSettings}
            title={t("authorizationsBlock")}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function BulkActionsSection({
  densityMode,
  tableActions,
  tableSettings,
}: {
  densityMode: ExampleDensityMode;
  tableActions: ProductsLocalActions;
  tableSettings: ExampleTableSettings;
}) {
  const t = useTranslations("Example");
  const locale = useLocale() as AppLocale;
  const setFormState = useSetAtom(catalogueFormAtom);
  const [isRecalculatingPrices, setIsRecalculatingPrices] = useState(false);

  const handleRecalculatePrices = useCallback(async () => {
    setIsRecalculatingPrices(true);
    try {
      await new Promise((resolve) => {
        setTimeout(resolve, 900);
      });
      await queryClient.invalidateQueries({
        queryKey: ["tableData", PRODUCTS_TABLE_TYPE],
      });
      toast.success(t("toasts.recalculatePricesSuccess"));
    } catch {
      toast.error(t("toasts.recalculatePricesError"));
    } finally {
      setIsRecalculatingPrices(false);
    }
  }, [t]);

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
                error: result.error || t("toasts.bulkEditUpdateError"),
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

      const {
        showActionsColumn,
        showSelectionColumn,
        ...tableBehaviorSettings
      } = tableSettings;
      const isRowClickEditMode =
        tableBehaviorSettings.enableRowClickEdit === true;
      const baseVisibleColumns = baseConfig.columns?.visible ?? [];
      const visibleColumns = baseVisibleColumns.filter(
        (columnId) => columnId !== "select" && columnId !== "actions"
      );
      const definitionsWithInlineMode = (
        baseConfig.columns?.definitions ?? []
      ).map((definition) => ({
        ...definition,
        inlineEdit: isRowClickEditMode ? false : definition.inlineEdit,
      }));

      if (showSelectionColumn) {
        visibleColumns.unshift("select");
      }

      if (showActionsColumn) {
        visibleColumns.push("actions");
      }

      return {
        ...baseConfig,
        ...tableBehaviorSettings,
        allowInlineEdit: isRowClickEditMode
          ? false
          : tableBehaviorSettings.allowInlineEdit,
        inlineEdit: isRowClickEditMode
          ? {
              ...baseConfig.inlineEdit,
              enabled: false,
            }
          : baseConfig.inlineEdit,
        columns: baseConfig.columns
          ? {
              ...baseConfig.columns,
              definitions: definitionsWithInlineMode,
              visible: [...new Set(visibleColumns)],
            }
          : undefined,
        density: densityMode,
      };
    },
    [locale, tableSettings, densityMode]
  );

  const getFormConfigWithLocale = useCallback(
    <TFieldValues extends FieldValues = FieldValues>(formType: string) =>
      getFormConfig<TFieldValues>(formType, locale),
    [locale]
  );

  const toolbarActions = useCallback(
    (_context: ToolbarActionContext): ToolbarAction[] => [
      {
        id: "recalculate-prices",
        label: t("toolbarActions.recalculatePrices"),
        icon: <RefreshCw className="h-4 w-4" />,
        loading: isRecalculatingPrices,
        onClick: handleRecalculatePrices,
        disabled: (ctx: ToolbarActionContext) =>
          !ctx.hasListAction || ctx.isExporting,
        tooltip: t("toolbarActions.recalculatePricesTooltip"),
      },
      {
        id: "mobile-hidden-action",
        label: t("toolbarActions.detailsOnlyAction"),
        onClick: async () => {
          toast.success(t("toasts.detailsOnlyActionSuccess"));
        },
        showInIconMode: false,
        variant: "secondary",
      },
    ],
    [handleRecalculatePrices, isRecalculatingPrices, t]
  );

  return (
    <DataTable
      className="w-full"
      columnTypeMapping={{
        name: "text",
        brand: "text",
        category: "select",
        price: "number",
        status: "select",
        website: "text",
        createdAt: "date",
        isActive: "select",
      }}
      DescriptionComponent={CustomDescription}
      description={t("tableDescription")}
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
      title={t("tableTitle")}
      toolbarActions={toolbarActions}
      toolbarActionsPlacement="between-create-export"
      translations={getTableTranslations(locale)}
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
  const enableCalculationsSetting = useBooleanQuerySetting(
    "excfg-cl",
    DEFAULT_TABLE_SETTINGS.enableCalculations
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
  const enableRowClickEditSetting = useBooleanQuerySetting(
    "excfg-re",
    DEFAULT_TABLE_SETTINGS.enableRowClickEdit
  );
  const showSelectionColumnSetting = useBooleanQuerySetting(
    "excfg-sc",
    DEFAULT_TABLE_SETTINGS.showSelectionColumn
  );
  const showActionsColumnSetting = useBooleanQuerySetting(
    "excfg-ac",
    DEFAULT_TABLE_SETTINGS.showActionsColumn
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
  const allowCreateSetting = useBooleanQuerySetting(
    "excfg-cr",
    DEFAULT_TABLE_SETTINGS.allowCreate
  );
  const allowEditSetting = useBooleanQuerySetting(
    "excfg-ed",
    DEFAULT_TABLE_SETTINGS.allowEdit
  );
  const allowDuplicateSetting = useBooleanQuerySetting(
    "excfg-du",
    DEFAULT_TABLE_SETTINGS.allowDuplicate
  );
  const allowDeleteSetting = useBooleanQuerySetting(
    "excfg-de",
    DEFAULT_TABLE_SETTINGS.allowDelete
  );
  const allowBulkEditSetting = useBooleanQuerySetting(
    "excfg-be",
    DEFAULT_TABLE_SETTINGS.allowBulkEdit
  );
  const allowBulkDeleteSetting = useBooleanQuerySetting(
    "excfg-bd",
    DEFAULT_TABLE_SETTINGS.allowBulkDelete
  );
  const allowInlineEditSetting = useBooleanQuerySetting(
    "excfg-ie",
    DEFAULT_TABLE_SETTINGS.allowInlineEdit
  );
  const showToolbarSetting = useBooleanQuerySetting(
    "excfg-tb",
    DEFAULT_TABLE_SETTINGS.showToolbar
  );
  const showToolbarHeaderSetting = useBooleanQuerySetting(
    "excfg-th",
    DEFAULT_TABLE_SETTINGS.showToolbarHeader
  );
  const [densityQueryValue, setDensityQueryValue] = useQueryState("excfg-dn");
  const densityMode = useMemo(
    () => parseDensityQueryValue(densityQueryValue),
    [densityQueryValue]
  );
  const fullWidthSetting = useBooleanQuerySetting("excfg-fw", false);

  const setDensityMode = useCallback(
    (nextDensity: ExampleDensityMode) => {
      setDensityQueryValue(nextDensity);
    },
    [setDensityQueryValue]
  );

  const resetDensityMode = useCallback(() => {
    setDensityQueryValue(null);
  }, [setDensityQueryValue]);

  const tableSettings = useMemo<ExampleTableSettings>(
    () =>
      resolveConflictingEditModes({
        allowBulkDelete: allowBulkDeleteSetting.value,
        allowBulkEdit: allowBulkEditSetting.value,
        allowCreate: allowCreateSetting.value,
        allowDelete: allowDeleteSetting.value,
        allowDuplicate: allowDuplicateSetting.value,
        allowEdit: allowEditSetting.value,
        allowInlineEdit: allowInlineEditSetting.value,
        actionsAsIcons: actionsAsIconsSetting.value,
        bulkExport: bulkExportSetting.value,
        enableColumnDnd: enableColumnDndSetting.value,
        enableColumnFilters: enableColumnFiltersSetting.value,
        enableCalculations: enableCalculationsSetting.value,
        enableGrouping: enableGroupingSetting.value,
        enablePagination: enablePaginationSetting.value,
        enableRowClickEdit: enableRowClickEditSetting.value,
        enableRowSelection: enableRowSelectionSetting.value,
        enableSorting: enableSortingSetting.value,
        export: exportSetting.value,
        showActionsColumn: showActionsColumnSetting.value,
        showSelectionColumn: showSelectionColumnSetting.value,
        showToolbar: showToolbarSetting.value,
        showToolbarHeader: showToolbarHeaderSetting.value,
      }),
    [
      allowBulkDeleteSetting.value,
      allowBulkEditSetting.value,
      allowCreateSetting.value,
      allowDeleteSetting.value,
      allowDuplicateSetting.value,
      allowEditSetting.value,
      allowInlineEditSetting.value,
      actionsAsIconsSetting.value,
      bulkExportSetting.value,
      enableColumnDndSetting.value,
      enableColumnFiltersSetting.value,
      enableCalculationsSetting.value,
      enableGroupingSetting.value,
      enablePaginationSetting.value,
      enableRowClickEditSetting.value,
      enableRowSelectionSetting.value,
      enableSortingSetting.value,
      exportSetting.value,
      showActionsColumnSetting.value,
      showSelectionColumnSetting.value,
      showToolbarSetting.value,
      showToolbarHeaderSetting.value,
    ]
  );

  const settingControllers = useMemo<
    Record<TableSettingKey, BooleanQuerySettingController>
  >(
    () => ({
      allowBulkDelete: allowBulkDeleteSetting,
      allowBulkEdit: allowBulkEditSetting,
      allowCreate: allowCreateSetting,
      allowDelete: allowDeleteSetting,
      allowDuplicate: allowDuplicateSetting,
      allowEdit: allowEditSetting,
      allowInlineEdit: allowInlineEditSetting,
      actionsAsIcons: actionsAsIconsSetting,
      bulkExport: bulkExportSetting,
      enableColumnDnd: enableColumnDndSetting,
      enableColumnFilters: enableColumnFiltersSetting,
      enableCalculations: enableCalculationsSetting,
      enableGrouping: enableGroupingSetting,
      enablePagination: enablePaginationSetting,
      enableRowClickEdit: enableRowClickEditSetting,
      enableRowSelection: enableRowSelectionSetting,
      enableSorting: enableSortingSetting,
      export: exportSetting,
      showActionsColumn: showActionsColumnSetting,
      showSelectionColumn: showSelectionColumnSetting,
      showToolbar: showToolbarSetting,
      showToolbarHeader: showToolbarHeaderSetting,
    }),
    [
      allowBulkDeleteSetting,
      allowBulkEditSetting,
      allowCreateSetting,
      allowDeleteSetting,
      allowDuplicateSetting,
      allowEditSetting,
      allowInlineEditSetting,
      actionsAsIconsSetting,
      bulkExportSetting,
      enableColumnDndSetting,
      enableColumnFiltersSetting,
      enableCalculationsSetting,
      enableGroupingSetting,
      enablePaginationSetting,
      enableRowClickEditSetting,
      enableRowSelectionSetting,
      enableSortingSetting,
      exportSetting,
      showActionsColumnSetting,
      showSelectionColumnSetting,
      showToolbarSetting,
      showToolbarHeaderSetting,
    ]
  );

  const setTableSetting = useCallback(
    (key: TableSettingKey, value: boolean) => {
      if (key === "enableRowClickEdit" && value) {
        settingControllers.allowInlineEdit.setValue(false);
        settingControllers.enableRowClickEdit.setValue(true);
        return;
      }

      if (key === "allowInlineEdit" && value) {
        settingControllers.enableRowClickEdit.setValue(false);
        settingControllers.allowInlineEdit.setValue(true);
        return;
      }

      settingControllers[key].setValue(value);
    },
    [settingControllers]
  );

  useEffect(() => {
    if (
      enableRowClickEditSetting.value !== true ||
      allowInlineEditSetting.value !== true
    ) {
      return;
    }

    allowInlineEditSetting.setValue(false);
  }, [
    enableRowClickEditSetting.value,
    allowInlineEditSetting.value,
    allowInlineEditSetting.setValue,
  ]);

  const resetTableSettings = useCallback(() => {
    for (const key of TABLE_SETTING_KEYS) {
      settingControllers[key].resetValue();
    }
    resetDensityMode();
  }, [settingControllers, resetDensityMode]);

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

          {/* Data Table */}
          <Card>
            <CardContent>
              <QueryClientProvider client={queryClient}>
                <BulkActionsSection
                  densityMode={densityMode}
                  tableActions={localTableActions}
                  tableSettings={tableSettings}
                />
              </QueryClientProvider>
            </CardContent>
          </Card>

          <div className="mt-8">
            <ExampleSettingsPanel
              density={densityMode}
              onDensityChange={setDensityMode}
              onResetData={handleResetData}
              onResetSettings={resetTableSettings}
              onSettingChange={setTableSetting}
              tableSettings={tableSettings}
            />
          </div>

          {/* Code Example */}
          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="font-display text-2xl">
                {t("configurationUsed")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-md bg-muted p-4">
                <pre className="text-muted-foreground text-sm">
                  {`// 1. Configuration via provider
const getTableConfig = (tableType: string) => {
  if (tableType === "products") {
    return {
      table: { 
        allowCreate: true,
        allowEdit: true,
        allowDuplicate: true,
        allowDelete: true,
        allowBulkEdit: true,
        allowBulkDelete: true,
        allowInlineEdit: true,
        enableRowSelection: true,
        enableColumnFilters: true,
        enableCalculations: false,
        enableColumnDnd: true,
        enableSorting: true,
        enableGrouping: true,
        enablePagination: true,
        enableRowClickEdit: false,
        export: true,
        bulkExport: true,
        showToolbar: true,
        showToolbarHeader: true,
        density: "medium",
        actionsAsIcons: false
      },
      columns: {
        definitions: [
          { id: "name", type: "text", header: "Product Name" },
          { id: "brand", type: "text", header: "Brand" },
          {
            id: "category",
            type: "select",
            displayVariant: "tag",
            header: "Category",
            tagColorMap: {
              Electronics: "bg-blue-500/80 text-white dark:bg-blue-600/90",
              Furniture: "bg-amber-500/80 text-white dark:bg-amber-600/90"
            }
          },
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
          {
            id: "status",
            type: "select",
            displayVariant: "tag",
            header: "Status",
            tagColorMap: {
              available: "bg-green-500/80 text-white dark:bg-green-600/90",
              low_stock: "bg-orange-500/80 text-white dark:bg-orange-600/90",
              out_of_stock: "bg-red-500/80 text-white dark:bg-red-600/90"
            }
          },
          { id: "createdAt", type: "date", header: "Created" },
          { id: "isActive", type: "boolean", header: "Active" },
          { id: "actions", type: "actions", header: "Actions" }
        ],
        visible: [
          "select",
          "name",
          "brand",
          "category",
          "price",
          "status",
          "createdAt",
          "isActive",
          "actions"
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
    category: 'select',  // select with tag display variant
    price: 'number',
    status: 'select',    // select with tag display variant  
    website: 'text',
    createdAt: 'date',
    isActive: 'select'   // boolean -> select for true/false
  }}
/>

// Local data API with pagination, filtering, and sorting.
// Edits persist in localStorage and can be reset from the settings panel.`}
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
