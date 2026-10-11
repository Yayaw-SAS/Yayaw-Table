"use client";

import { Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsMobile } from "../../hooks/use-mobile";
import type { TableCatalogueColumnConfig } from "../../hooks/use-table-config";
import { useTableUrlState } from "../../hooks/use-table-url-state";
import { useLocale, useTranslations } from "../../providers/table-provider";
import { translatedOr } from "../../providers/translation-cache";
import type {
  TableDisplayMode,
  TableKanbanConfig,
  TableKanbanViewConfig,
} from "../../types/display-types";
import {
  StackMenu,
  StackMenuContent,
  StackMenuView,
} from "../../ui-custom/stack-menu";
import {
  kanbanLaneCandidates,
  kanbanLaneSettings,
  mergeKanbanLanes,
  withKanbanLaneSettings,
} from "../../utils/kanban-lanes";
import {
  emptyGroupLabel,
  fieldText,
  groupValueKey,
} from "../../utils/table-contracts";
import { TableTooltip } from "../../utils/table-tooltip";
import { KanbanLaneSettingsEditor } from "./kanban-lane-settings";
import type { GroupPickerColumn } from "./sections/group-picker";
import { GroupPicker } from "./sections/group-picker";
import { ViewSettingsPanel } from "./view-settings-panel";

interface TableKanbanGroupingMenuProps {
  embedded?: boolean;
  className?: string;
  columns: GroupPickerColumn[];
  controlColumns?: GroupPickerColumn[];
  defaultConfig?: TableKanbanConfig;
  defaultDisplayMode?: TableDisplayMode;
  defaultGroupBy?: string;
  enabled?: boolean;
  /** Column definitions: the grouped column's options and value labels. */
  laneColumns?: TableCatalogueColumnConfig[];
  /** Loaded records: the lanes they fill, offered before the board shows them. */
  laneRows?: Record<string, unknown>[];
  tableId: string;
}

const noop = () => undefined;

function mergeKanbanConfig({
  defaults,
  override,
}: {
  defaults?: TableKanbanConfig;
  override?: TableKanbanViewConfig;
}): TableKanbanConfig {
  return {
    ...defaults,
    ...override,
  };
}

function getDefaultPropertyColumnIds({
  columns,
  groupBy,
  titleColumn,
}: {
  columns: GroupPickerColumn[];
  groupBy?: string;
  titleColumn?: string;
}): string[] {
  return columns
    .filter((column) => column.id !== groupBy && column.id !== titleColumn)
    .map((column) => column.id);
}

export function TableKanbanGroupingMenu({
  embedded = false,
  className,
  columns,
  controlColumns,
  defaultConfig,
  defaultDisplayMode,
  defaultGroupBy,
  enabled = true,
  laneColumns,
  laneRows,
  tableId,
}: TableKanbanGroupingMenuProps) {
  const { t } = useTranslations();
  const locale = useLocale();
  const compact = useIsMobile();
  const {
    displayModeParam,
    groupingParam,
    kanbanParam,
    setGroupingFromUI,
    setKanbanFromUI,
  } = useTableUrlState({
    defaultDisplayMode,
    tableId,
  });
  const propertyColumns = controlColumns ?? columns;
  const activeConfig = mergeKanbanConfig({
    defaults: defaultConfig,
    override: kanbanParam,
  });
  const activeGroupBy = groupingParam[0] || defaultGroupBy || "";
  const activeColumn = columns.find((column) => column.id === activeGroupBy);
  const activeTitleColumn =
    activeConfig.titleColumn ||
    propertyColumns.find((column) => column.id !== activeGroupBy)?.id;
  const activePropertyColumnIds =
    activeConfig.cardColumnIds ??
    getDefaultPropertyColumnIds({
      columns: propertyColumns,
      groupBy: activeGroupBy,
      titleColumn: activeTitleColumn,
    });
  const showCardLabels = activeConfig.showCardLabels === true;
  const hasGroupOverride = groupingParam.length > 0;
  const hasOverride =
    Object.keys(kanbanParam || {}).length > 0 || hasGroupOverride;
  const triggerLabel =
    activeColumn?.label || activeGroupBy || t("menu.select_column");
  const groupLabel = t("menu.group");
  const pickerColumns =
    activeGroupBy && !activeColumn
      ? [...columns, { id: activeGroupBy, label: activeGroupBy, type: "text" }]
      : columns;
  const updateKanban = (patch: TableKanbanViewConfig) => {
    const nextConfig: TableKanbanViewConfig = {
      ...kanbanParam,
      ...patch,
    };

    for (const key of Object.keys(nextConfig) as Array<
      keyof TableKanbanViewConfig
    >) {
      if (nextConfig[key] === undefined) {
        delete nextConfig[key];
      }
    }

    setKanbanFromUI(nextConfig);
  };

  const laneColumn = laneColumns?.find((column) => column.id === activeGroupBy);
  const laneSettings = kanbanLaneSettings(
    mergeKanbanLanes(defaultConfig?.lanes, kanbanParam.lanes),
    activeGroupBy
  );
  const laneField = laneColumn?.accessorKey ?? activeGroupBy;
  const lanes = activeGroupBy
    ? kanbanLaneCandidates({
        label: (value) =>
          (value && (fieldText(value, laneColumn, locale) || value)) ||
          emptyGroupLabel(locale),
        // The board's own order: fixed groups, then values as rows bring them.
        options:
          defaultConfig?.groupBy === activeGroupBy
            ? (defaultConfig.groups ?? []).map((group) => ({
                value: groupValueKey(group.value),
                label: group.label,
              }))
            : [],
        settings: laneSettings,
        values: [
          ...(laneRows ?? []).map((row) =>
            groupValueKey(row[String(laneField)])
          ),
          ...(Array.isArray(laneColumn?.options)
            ? (laneColumn.options as { value?: unknown }[])
                .filter((option) => option?.value !== undefined)
                .map((option) => groupValueKey(option.value))
            : []),
        ],
      })
    : [];
  const laneLabel = (key: string, fallback: string) => (lane: string) =>
    translatedOr(t, `views.kanban.${key}`, fallback, { lane });
  const setLanes = (settings: Parameters<typeof withKanbanLaneSettings>[2]) =>
    updateKanban({
      lanes: withKanbanLaneSettings(kanbanParam.lanes, activeGroupBy, settings),
    });

  if (!enabled || displayModeParam !== "kanban" || columns.length === 0) {
    return null;
  }

  const content = (
    <StackMenuContent>
      <div className="flex min-h-0 w-full flex-col gap-3 p-3">
        {!embedded && (
          <GroupPicker
            columns={pickerColumns}
            disableRemoveLastGroup={
              !hasGroupOverride && Boolean(defaultGroupBy)
            }
            grouping={activeGroupBy ? [activeGroupBy] : []}
            maxGroups={1}
            onChange={(next) => {
              setGroupingFromUI(next.slice(0, 1));
            }}
            onCollapseAll={noop}
            onExpandAll={noop}
            onReset={() => {
              setKanbanFromUI(undefined);
              setGroupingFromUI([]);
            }}
            resetDisabled={!hasOverride}
            showExpandCollapse={false}
          />
        )}

        <ViewSettingsPanel
          fields={[
            {
              id: "title",
              label: t("views.kanban.titleColumn"),
              value: activeTitleColumn ?? "",
              options: propertyColumns
                .filter((column) => column.id !== activeGroupBy)
                .map((column) => ({ value: column.id, label: column.label })),
              onChange: (titleColumn) => updateKanban({ titleColumn }),
            },
          ]}
          properties={{
            label: t("views.kanban.properties"),
            options: propertyColumns
              .filter(
                (column) =>
                  column.id !== activeGroupBy && column.id !== activeTitleColumn
              )
              .map((column) => ({ value: column.id, label: column.label })),
            value: activePropertyColumnIds,
            onChange: (cardColumnIds) => updateKanban({ cardColumnIds }),
            showLabels: showCardLabels,
            showLabelsLabel: t("views.kanban.showLabels"),
            onShowLabelsChange: (showCardLabels) =>
              updateKanban({ showCardLabels }),
          }}
        >
          <KanbanLaneSettingsEditor
            labels={{
              lanes: translatedOr(t, "views.kanban.lanes", "Lanes"),
              showLane: laneLabel("showLane", "Show {lane}"),
              moveLaneUp: laneLabel("moveLaneUp", "Move {lane} up"),
              moveLaneDown: laneLabel("moveLaneDown", "Move {lane} down"),
              resetLanes: translatedOr(
                t,
                "views.kanban.resetLanes",
                "Reset lanes"
              ),
            }}
            lanes={lanes}
            onChange={setLanes}
            onReset={() => setLanes(undefined)}
            resettable={Boolean(
              kanbanParam.lanes &&
                Object.hasOwn(kanbanParam.lanes, activeGroupBy)
            )}
            settings={laneSettings}
          />
        </ViewSettingsPanel>
      </div>
    </StackMenuContent>
  );
  if (embedded) {
    return content;
  }

  return (
    <StackMenu
      align="start"
      asDropdown
      compact={compact}
      defaultView="group"
      trigger={
        <TableTooltip label={`${groupLabel}: ${triggerLabel}`}>
          <Button
            aria-label={`${groupLabel}: ${triggerLabel}`}
            className={cn("h-8 max-w-[16rem] gap-1.5 px-2 text-xs", className)}
            size="sm"
            type="button"
            variant="outline"
          >
            <Layers className="size-4 shrink-0" />
            <span className="truncate">{triggerLabel}</span>
          </Button>
        </TableTooltip>
      }
    >
      <StackMenuView name="group" title={groupLabel}>
        {content}
      </StackMenuView>
    </StackMenu>
  );
}
