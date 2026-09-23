"use client";

import { StackMenuContent } from "@/components/ui/custom/stack-menu";
import { Button } from "@/src/components/ui/button";
import { useTableUrlState } from "../../hooks/use-table-url-state";
import { useTranslations } from "../../providers/table-provider";
import type {
  TableDisplayMode,
  TableListConfig,
  TableListViewConfig,
} from "../../types/display-types";
import type { GalleryMenuColumn } from "./table-gallery-menu";
import { resolveListSettings } from "../../utils/list-view";
import { translateWithFallback } from "../filters/i18n-utils";
import { ViewSettingsPanel } from "./view-settings-panel";

interface TableListMenuProps {
  columns: GalleryMenuColumn[];
  defaultConfig?: TableListConfig;
  defaultDisplayMode?: TableDisplayMode;
  tableId: string;
}

/** List settings: the title column, the properties after it and their labels. */
export function TableListMenu({
  columns,
  defaultConfig,
  defaultDisplayMode,
  tableId,
}: TableListMenuProps) {
  const { t } = useTranslations();
  const { displayModeParam, listParam, setListFromUI } = useTableUrlState({
    defaultDisplayMode,
    tableId,
  });
  if (displayModeParam !== "list" || columns.length === 0) {
    return null;
  }

  const active = resolveListSettings(defaultConfig, listParam);
  const label = (key: string, fallback: string) =>
    translateWithFallback(t, `views.list.${key}`, fallback);
  const countOptions = (max: number) => [
    { value: "", label: label("all", "All") },
    ...Array.from({ length: max + 1 }, (_, count) => ({
      value: String(count),
      label: String(count),
    })),
  ];
  const toCount = (value: string) => (value === "" ? undefined : Number(value));
  const titleColumn = active.titleColumn || columns[0]?.id;
  const propertyColumns = columns.filter((column) => column.id !== titleColumn);
  const update = (patch: TableListViewConfig) => {
    const next: TableListViewConfig = { ...listParam };
    for (const [key, value] of Object.entries(patch) as [
      keyof TableListViewConfig,
      TableListViewConfig[keyof TableListViewConfig],
    ][]) {
      if (value === undefined) {
        Reflect.deleteProperty(next, key);
      } else {
        Object.assign(next, { [key]: value });
      }
    }
    setListFromUI(next);
  };
  const options = (items: GalleryMenuColumn[]) =>
    items.map((column) => ({ value: column.id, label: column.label }));

  return (
    <StackMenuContent className="p-3">
      <ViewSettingsPanel
        fields={[
          {
            id: "title",
            label: t("views.gallery.titleColumn"),
            value: titleColumn ?? "",
            options: options(columns),
            onChange: (value) => update({ titleColumn: value }),
          },
          {
            id: "wrap",
            label: label("title", "Title"),
            value: active.wrap ? "wrap" : "truncate",
            options: [
              { value: "truncate", label: label("truncate", "One line") },
              { value: "wrap", label: label("wrap", "Wrap") },
            ],
            onChange: (value) => update({ wrap: value === "wrap" }),
          },
          {
            id: "align",
            label: label("propertyAlign", "Properties"),
            value: active.propertyAlign,
            options: [
              { value: "end", label: label("alignEnd", "End of line") },
              { value: "start", label: label("alignStart", "After title") },
            ],
            onChange: (value) =>
              update({ propertyAlign: value === "start" ? "start" : "end" }),
          },
          {
            id: "maxProperties",
            label: label("maxProperties", "Properties shown"),
            value: String(active.maxProperties ?? ""),
            options: countOptions(6),
            onChange: (value) => update({ maxProperties: toCount(value) }),
          },
          {
            id: "mobileMaxProperties",
            label: label("mobileMaxProperties", "Properties on mobile"),
            value: String(active.mobileMaxProperties ?? ""),
            options: countOptions(4),
            onChange: (value) =>
              update({ mobileMaxProperties: toCount(value) }),
          },
          {
            id: "actions",
            label: label("actions", "Row actions"),
            value: active.showActions ? "show" : "hide",
            options: [
              { value: "show", label: label("show", "Shown") },
              { value: "hide", label: label("hide", "Hidden") },
            ],
            onChange: (value) => update({ showActions: value === "show" }),
          },
        ]}
        properties={{
          label: t("views.gallery.properties"),
          options: options(propertyColumns),
          value:
            active.cardColumnIds ?? propertyColumns.map((column) => column.id),
          onChange: (cardColumnIds) => update({ cardColumnIds }),
          showLabels: active.showCardLabels === true,
          showLabelsLabel: t("views.gallery.showLabels"),
          onShowLabelsChange: (showCardLabels) => update({ showCardLabels }),
        }}
      >
        <Button
          className="font-normal"
          disabled={Object.keys(listParam || {}).length === 0}
          onClick={() => setListFromUI(undefined)}
          size="sm"
          variant="outline"
        >
          {t("common.reset")}
        </Button>
      </ViewSettingsPanel>
    </StackMenuContent>
  );
}
