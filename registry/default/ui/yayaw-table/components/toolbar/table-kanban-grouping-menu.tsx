"use client";

import { Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsMobile } from "../../hooks/use-mobile";
import { useTableUrlState } from "../../hooks/use-table-url-state";
import { useTranslations } from "../../providers/table-provider";
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
import { TableTooltip } from "../../utils/table-tooltip";
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
  tableId,
}: TableKanbanGroupingMenuProps) {
  const { t } = useTranslations();
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
        />
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
