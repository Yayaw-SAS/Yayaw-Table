"use client";

import { Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/src/components/ui/button";
import {
  StackMenu,
  StackMenuContent,
  StackMenuView,
} from "@/components/ui/custom/stack-menu";
import { useTableUrlState } from "../../hooks/use-table-url-state";
import { useTranslations } from "../../providers/table-provider";
import type { TableDisplayMode } from "../../types/display-types";
import type { GroupPickerColumn } from "./sections/group-picker";
import { GroupPicker } from "./sections/group-picker";

interface TableKanbanGroupingMenuProps {
  className?: string;
  columns: GroupPickerColumn[];
  defaultDisplayMode?: TableDisplayMode;
  defaultGroupBy?: string;
  enabled?: boolean;
  tableId: string;
}

const noop = () => undefined;

export function TableKanbanGroupingMenu({
  className,
  columns,
  defaultDisplayMode,
  defaultGroupBy,
  enabled = true,
  tableId,
}: TableKanbanGroupingMenuProps) {
  const { t } = useTranslations();
  const {
    displayModeParam,
    kanbanGroupByParam,
    setKanbanGroupByFromUI,
  } = useTableUrlState({
    defaultDisplayMode,
    tableId,
  });
  const activeGroupBy = kanbanGroupByParam || defaultGroupBy || "";
  const activeColumn = columns.find((column) => column.id === activeGroupBy);
  const hasOverride = Boolean(kanbanGroupByParam);
  const triggerLabel = activeColumn?.label || activeGroupBy || t("menu.select_column");
  const groupLabel = t("menu.group");
  const pickerColumns =
    activeGroupBy && !activeColumn
      ? [...columns, { id: activeGroupBy, label: activeGroupBy, type: "text" }]
      : columns;

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
          <GroupPicker
            columns={pickerColumns}
            disableRemoveLastGroup={!hasOverride && Boolean(defaultGroupBy)}
            grouping={activeGroupBy ? [activeGroupBy] : []}
            maxGroups={1}
            onChange={(next) => {
              setKanbanGroupByFromUI(next[0]);
            }}
            onCollapseAll={noop}
            onExpandAll={noop}
            onReset={() => setKanbanGroupByFromUI(undefined)}
            resetDisabled={!hasOverride}
            showExpandCollapse={false}
          />
        </StackMenuContent>
      </StackMenuView>
    </StackMenu>
  );
}
