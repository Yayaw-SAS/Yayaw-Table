'use client';

import type { GroupingState } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, Check, Group, Minus, X } from 'lucide-react';
import { useMemo } from 'react';
import {
  StackMenuContent,
  StackMenuItem,
  StackMenuView,
} from '@/src/components/ui-custom/stack-menu';
import { useTableUrlState } from '../../../hooks/use-table-url-state';
import { useTranslations } from '../../../providers/table-provider';

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
}

export function TableGroupingMenu({
  columns,
  grouping,
  setGrouping,
  tableId: _tableId,
}: TableGroupingMenuProps) {
  const { t } = useTranslations();
  const { setExpandedFromUI } = useTableUrlState({ tableId: _tableId });

  // Get groupable columns
  const groupableColumns = useMemo(
    () => columns.filter((col) => col.canGroup !== false),
    [columns]
  );

  // Skip rendering if no groupable columns
  if (groupableColumns.length === 0) {
    return null;
  }

  return (
    <StackMenuView name="group">
      <StackMenuContent>
        {/* Active groups (ordered) */}
        {grouping.length > 0 && (
          <>
            {grouping.map((id, index) => {
              const col = groupableColumns.find((c) => c.id === id);
              const label = col?.label || id;
              return (
                <StackMenuItem
                  endIcon={
                    <div className="flex items-center gap-2">
                      {/* Move up */}
                      <button
                        aria-label={t('common.move_up')}
                        className="text-muted-foreground hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (index === 0) {
                            return;
                          }
                          const next = [...grouping];
                          const tmp = next[index - 1];
                          next[index - 1] = next[index];
                          next[index] = tmp;
                          setGrouping(next);
                        }}
                        type="button"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      {/* Move down */}
                      <button
                        aria-label={t('common.move_down')}
                        className="text-muted-foreground hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (index === grouping.length - 1) {
                            return;
                          }
                          const next = [...grouping];
                          const tmp = next[index + 1];
                          next[index + 1] = next[index];
                          next[index] = tmp;
                          setGrouping(next);
                        }}
                        type="button"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      {/* Remove */}
                      <button
                        aria-label={t('common.remove')}
                        className="text-muted-foreground hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          setGrouping(grouping.filter((gid) => gid !== id));
                        }}
                        type="button"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                    </div>
                  }
                  icon={
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs">
                      {index + 1}
                    </span>
                  }
                  key={`active-${id}`}
                >
                  {label}
                </StackMenuItem>
              );
            })}

            {/* Collapse all groups */}
            <StackMenuItem
              icon={<ArrowUp className="h-5 w-5 rotate-180" />}
              onClick={() => setExpandedFromUI({})}
            >
              {t('common.collapse_all')}
            </StackMenuItem>

            <StackMenuItem
              icon={<ArrowDown className="h-5 w-5" />}
              onClick={() => setExpandedFromUI({ '': true })}
            >
              {t('common.expand_all')}
            </StackMenuItem>

            {/* Reset grouping */}
            <StackMenuItem
              icon={<X className="h-5 w-5" />}
              onClick={() => setGrouping([])}
            >
              {t('common.reset')}
            </StackMenuItem>
          </>
        )}

        {/* Available columns */}
        {groupableColumns.map((column) => {
          const isGrouped = grouping.includes(column.id);
          if (isGrouped) {
            return null;
          }
          return (
            <StackMenuItem
              endIcon={<Check className="h-4 w-4 opacity-0" />}
              icon={<Group className="h-5 w-5" />}
              key={column.id}
              onClick={() => setGrouping([...grouping, column.id])}
            >
              {column.label}
            </StackMenuItem>
          );
        })}
      </StackMenuContent>
    </StackMenuView>
  );
}
