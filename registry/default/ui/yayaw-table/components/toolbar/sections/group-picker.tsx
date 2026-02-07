"use client";

import { ArrowDown, ArrowUp, Minus, Plus } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/ui/shadcn/button";
import { Separator } from "@/ui/shadcn/separator";
import { useTranslations } from "../../../providers/table-provider";
import { ColumnIcon } from "../../../utils/column-icons";

export interface GroupPickerColumn {
  id: string;
  label: string;
  type?: string;
}

export interface GroupPickerProps {
  columns: GroupPickerColumn[];
  grouping: string[];
  onChange: (next: string[]) => void;
  onReset: () => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}

/**
 * Compact, a11y-safe grouping picker using chips + searchable list.
 * No nested buttons; can be embedded in any menu/popover safely.
 */
export function GroupPicker({
  columns,
  grouping,
  onChange,
  onExpandAll,
  onCollapseAll,
}: GroupPickerProps) {
  const { t } = useTranslations();

  const groupedColumns = useMemo(
    () =>
      grouping
        .map((id) => columns.find((c) => c.id === id))
        .filter(Boolean) as GroupPickerColumn[],
    [columns, grouping]
  );

  const availableColumns = useMemo(() => {
    return (
      columns
        // Exclude actions column from grouping options
        .filter((c) => c.id !== "actions")
        .filter((c) => !grouping.includes(c.id))
        .filter((c) => {
          // Block "select" as subgroup - only allow as main group
          if (c.id === "select" && grouping.length > 0) {
            return false;
          }
          // Block other columns if "select" is already the main group
          if (grouping[0] === "select" && c.id !== "select") {
            return false;
          }
          return true;
        })
    );
  }, [columns, grouping]);

  const activeCount = grouping.length;
  // const availableCount = availableColumns.length; // count not shown in UI

  const move = (index: number, dir: -1 | 1) => {
    const next = [...grouping];
    const target = index + dir;
    if (target < 0 || target >= next.length) {
      return;
    }
    const tmp = next[target];
    next[target] = next[index];
    next[index] = tmp;
    onChange(next);
  };

  return (
    <div className="flex min-h-0 flex-col gap-2">
      {/* Active groups section */}
      <div className="mb-1 px-3">
        <div className="mb-3 flex items-center justify-between">
          <div className="px-2 font-medium text-foreground text-sm">
            {activeCount > 0
              ? t("menu.current_groups", { count: activeCount })
              : t("menu.select_column")}
          </div>
          <div className="flex items-center gap-2">
            <Button
              disabled={activeCount === 0}
              onClick={() => onChange([])}
              size="sm"
              variant="outline"
            >
              {t("common.reset")}
            </Button>
          </div>
        </div>

        {grouping.length > 0 && (
          <div className="space-y-1">
            {groupedColumns.map((col, index) => (
              <div className="group flex items-center py-1.5" key={col.id}>
                <div className="px-2">
                  <span className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-full bg-muted text-[10px]">
                    {index + 1}
                  </span>
                </div>
                <Button
                  className="h-7 flex-1 justify-start px-1 text-left"
                  size="sm"
                  variant="ghost"
                >
                  <div className="flex items-center gap-2">
                    <ColumnIcon
                      className="h-3.5 w-3.5"
                      columnType={col.type || "text"}
                    />
                    <span className="text-sm">{col.label}</span>
                  </div>
                </Button>
                <div className="ml-auto flex items-center gap-2 pr-3">
                  <Button
                    aria-label="Move up"
                    className="h-7 w-7 p-0"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    size="sm"
                    variant="ghost"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    aria-label="Move down"
                    className="h-7 w-7 p-0"
                    disabled={index === grouping.length - 1}
                    onClick={() => move(index, 1)}
                    size="sm"
                    variant="ghost"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    aria-label="Remove"
                    className="h-7 w-7 p-0"
                    onClick={() =>
                      onChange(grouping.filter((id) => id !== col.id))
                    }
                    size="sm"
                    variant="ghost"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            <div className="mt-3 mb-1 flex items-center justify-between px-2">
              <Button
                className="h-auto p-0 text-xs underline"
                onClick={onCollapseAll}
                size="sm"
                type="button"
                variant="link"
              >
                Collapse all
              </Button>
              <Button
                className="h-auto p-0 text-xs underline"
                onClick={onExpandAll}
                size="sm"
                type="button"
                variant="link"
              >
                Expand all
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Separator between active groups and available list (only when active) */}
      {grouping.length > 0 && (
        <div className="px-3">
          <Separator className="my-2" />
        </div>
      )}

      {/* Available columns section */}
      <div className="min-h-0 flex-1 overflow-auto">
        {availableColumns.length === 0 ? (
          <div className="px-3 py-2 text-muted-foreground text-sm">
            {grouping.length >= 2
              ? "Maximum 2 levels reached"
              : t("filters.noResults")}
          </div>
        ) : (
          availableColumns.map((column) => {
            const isMax = grouping.length >= 2;
            return (
              <Button
                className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isMax}
                key={column.id}
                onClick={() => {
                  if (isMax) {
                    return;
                  }
                  onChange([...grouping, column.id]);
                }}
                type="button"
                variant="ghost"
              >
                <span className="flex items-center gap-2">
                  <ColumnIcon
                    className="h-3.5 w-3.5"
                    columnType={column.type || "text"}
                  />
                  <span className="text-sm">{column.label}</span>
                </span>
                <span className="flex h-5 w-5 items-center justify-center">
                  <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                </span>
              </Button>
            );
          })
        )}
      </div>
    </div>
  );
}
