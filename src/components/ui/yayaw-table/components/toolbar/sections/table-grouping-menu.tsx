"use client";

import type { GroupingState } from "@tanstack/react-table";
import { useMemo } from "react";
import { StackMenuContent, StackMenuView } from "@/components/ui/custom/stack-menu";
import { useTableConfig } from "../../../hooks/use-table-config";
import { useTableUrlState } from "../../../hooks/use-table-url-state";
import { useTranslations } from "../../../providers/table-provider";
import { GroupPicker } from "./group-picker";

export interface TableGroupingMenuProps {
  columns: {
    canFilter?: boolean;
    canGroup?: boolean;
    canHide?: boolean;
    canSort?: boolean;
    id: string;
    label: string;
  }[];
  grouping: GroupingState;
  invalidateTable: () => Promise<void>;
  setGrouping: (state: GroupingState) => void;
  tableId: string;
  tableType?: string;
}

export function TableGroupingMenu({
  columns,
  grouping,
  setGrouping,
  tableId: _tableId,
  tableType,
}: TableGroupingMenuProps) {
  const _t = useTranslations();
  const { setExpandedFromUI } = useTableUrlState({ tableId: _tableId });
  const { config } = useTableConfig(tableType || _tableId);

  // Get groupable columns with types from config
  const groupableColumns = useMemo(() => {
    // Exclude system/action columns and those that explicitly disable grouping
    const filteredColumns = columns.filter(
      (col) => col.id !== "actions" && col.canGroup !== false
    );

    // Map each column to include its type from the config
    return filteredColumns.map((col) => {
      const configColumn = config.columns.definitions.find(
        (def) => def.id === col.id
      );
      return {
        ...col,
        type: configColumn?.type || "text",
      };
    });
  }, [columns, config.columns.definitions]);

  // Always render the wrapper view; show empty state content when no columns

  return (
    <StackMenuView name="group">
      <StackMenuContent>
        <GroupPicker
          columns={groupableColumns.map((c) => ({
            id: c.id,
            label: c.label,
            type: c.type || "text",
          }))}
          grouping={grouping as string[]}
          onChange={(next) => setGrouping(next as typeof grouping)}
          onCollapseAll={() => setExpandedFromUI({})}
          onExpandAll={() => setExpandedFromUI({ _all: true })}
          onReset={() => setGrouping([])}
        />
      </StackMenuContent>
    </StackMenuView>
  );
}
