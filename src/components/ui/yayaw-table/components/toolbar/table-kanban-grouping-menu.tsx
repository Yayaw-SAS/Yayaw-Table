"use client";

import { Check, Layers, SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/src/components/ui/button";
import { Separator } from "@/src/components/ui/separator";
import {
  StackMenu,
  StackMenuContent,
  StackMenuView,
} from "@/components/ui/custom/stack-menu";
import { useTableUrlState } from "../../hooks/use-table-url-state";
import { useTranslations } from "../../providers/table-provider";
import type {
  TableDisplayMode,
  TableKanbanConfig,
  TableKanbanViewConfig,
} from "../../types/display-types";
import { ColumnIcon } from "../../utils/column-icons";
import type { GroupPickerColumn } from "./sections/group-picker";
import { GroupPicker } from "./sections/group-picker";

interface TableKanbanGroupingMenuProps {
  className?: string;
  columns: GroupPickerColumn[];
  controlColumns?: GroupPickerColumn[];
  defaultConfig?: TableKanbanConfig;
  defaultDisplayMode?: TableDisplayMode;
  defaultGroupBy?: string;
  enabled?: boolean;
  tableId: string;
}

interface ChoiceButtonProps {
  active: boolean;
  icon?: ReactNode;
  label: string;
  onClick: () => void;
}

const noop = () => undefined;

function ChoiceButton({ active, icon, label, onClick }: ChoiceButtonProps) {
  return (
    <Button
      className="flex h-8 w-full items-center justify-between px-3 text-left"
      onClick={onClick}
      size="sm"
      type="button"
      variant="ghost"
    >
      <span className="flex min-w-0 items-center gap-2">
        {icon}
        <span className="truncate text-sm">{label}</span>
      </span>
      {active ? <Check className="h-3.5 w-3.5 text-primary" /> : null}
    </Button>
  );
}

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
  const {
    displayModeParam,
    kanbanParam,
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
  const activeGroupBy = activeConfig.groupBy || defaultGroupBy || "";
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
  const hasOverride = Object.keys(kanbanParam || {}).length > 0;
  const hasGroupOverride = Boolean(kanbanParam?.groupBy);
  const triggerLabel = activeColumn?.label || activeGroupBy || t("menu.select_column");
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

  return (
    <StackMenu
      align="start"
      asDropdown
      defaultView="group"
      trigger={
        <Button
          aria-label={`${groupLabel}: ${triggerLabel}`}
          className={cn("h-8 max-w-[16rem] gap-1.5 px-2 text-xs", className)}
          size="sm"
          title={`${groupLabel}: ${triggerLabel}`}
          type="button"
          variant="outline"
        >
          <Layers className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate font-medium">{triggerLabel}</span>
        </Button>
      }
    >
      <StackMenuView name="group" title={groupLabel}>
        <StackMenuContent>
          <div className="flex min-h-0 w-[320px] flex-col gap-3 p-3">
            <GroupPicker
              columns={pickerColumns}
              disableRemoveLastGroup={
                !hasGroupOverride && Boolean(defaultGroupBy)
              }
              grouping={activeGroupBy ? [activeGroupBy] : []}
              maxGroups={1}
              onChange={(next) => {
                updateKanban({ groupBy: next[0] });
              }}
              onCollapseAll={noop}
              onExpandAll={noop}
              onReset={() => setKanbanFromUI(undefined)}
              resetDisabled={!hasOverride}
              showExpandCollapse={false}
            />

            <Separator />

            <div>
              <div className="px-1 pb-1 text-muted-foreground text-xs">
                {t("views.kanban.titleColumn")}
              </div>
              {propertyColumns
                .filter((column) => column.id !== activeGroupBy)
                .map((column) => (
                  <ChoiceButton
                    active={activeTitleColumn === column.id}
                    icon={
                      <ColumnIcon
                        className="h-3.5 w-3.5"
                        columnId={column.id}
                        columnType={column.type || "text"}
                      />
                    }
                    key={column.id}
                    label={column.label}
                    onClick={() => updateKanban({ titleColumn: column.id })}
                  />
                ))}
            </div>

            <Separator />

            <div>
              <div className="px-1 pb-1 text-muted-foreground text-xs">
                {t("views.kanban.properties")}
              </div>
              {propertyColumns
                .filter(
                  (column) =>
                    column.id !== activeGroupBy &&
                    column.id !== activeTitleColumn
                )
                .map((column) => {
                  const isActive = activePropertyColumnIds.includes(column.id);
                  return (
                    <ChoiceButton
                      active={isActive}
                      icon={
                        <ColumnIcon
                          className="h-3.5 w-3.5"
                          columnId={column.id}
                          columnType={column.type || "text"}
                        />
                      }
                      key={column.id}
                      label={column.label}
                      onClick={() => {
                        updateKanban({
                          cardColumnIds: isActive
                            ? activePropertyColumnIds.filter(
                                (id) => id !== column.id
                              )
                            : [...activePropertyColumnIds, column.id],
                        });
                      }}
                    />
                  );
                })}
            </div>

            <Separator />

            <ChoiceButton
              active={showCardLabels}
              icon={<SlidersHorizontal className="h-3.5 w-3.5" />}
              label={t("views.kanban.showLabels")}
              onClick={() =>
                updateKanban({ showCardLabels: !showCardLabels })
              }
            />
          </div>
        </StackMenuContent>
      </StackMenuView>
    </StackMenu>
  );
}
