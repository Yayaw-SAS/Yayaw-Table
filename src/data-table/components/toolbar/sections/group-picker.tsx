'use client';

import { ArrowDown, ArrowUp, Minus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ColumnIcon } from '../../../utils/column-icons';

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
  onReset,
  onExpandAll,
  onCollapseAll,
}: GroupPickerProps) {
  const [query, setQuery] = useState('');

  const groupedColumns = useMemo(
    () =>
      grouping
        .map((id) => columns.find((c) => c.id === id))
        .filter(Boolean) as GroupPickerColumn[],
    [columns, grouping]
  );

  const availableColumns = useMemo(() => {
    const lower = query.toLowerCase();
    return columns
      .filter((c) => !grouping.includes(c.id))
      .filter((c) => {
        // Block "select" as subgroup - only allow as main group
        if (c.id === 'select' && grouping.length > 0) {
          return false;
        }
        // Block other columns if "select" is already the main group
        if (grouping[0] === 'select' && c.id !== 'select') {
          return false;
        }
        return lower ? c.label.toLowerCase().includes(lower) : true;
      });
  }, [columns, grouping, query]);

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
    <div className="flex flex-col gap-2">
      {/* Active groups as chips */}
      {grouping.length > 0 && (
        <div className="mb-1 flex flex-wrap items-center gap-2 px-3">
          {groupedColumns.map((col, index) => (
            <Badge
              className="flex items-center gap-2"
              key={col.id}
              variant="secondary"
            >
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs">
                {index + 1}
              </span>
              <ColumnIcon columnType={col.type || 'text'} />
              <span>{col.label}</span>
              <div className="flex items-center gap-1 pl-1">
                <button
                  aria-label="Move up"
                  className="text-muted-foreground hover:text-foreground disabled:opacity-40"
                  disabled={index === 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    move(index, -1);
                  }}
                  type="button"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  aria-label="Move down"
                  className="text-muted-foreground hover:text-foreground disabled:opacity-40"
                  disabled={index === grouping.length - 1}
                  onClick={(e) => {
                    e.stopPropagation();
                    move(index, 1);
                  }}
                  type="button"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button
                  aria-label="Remove"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(grouping.filter((id) => id !== col.id));
                  }}
                  type="button"
                >
                  <Minus className="h-4 w-4" />
                </button>
              </div>
            </Badge>
          ))}
        </div>
      )}

      {/* Controls: search + expand/collapse/reset */}
      <div className="px-3">
        <div className="relative mb-2">
          <Search className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-2 h-4 w-4 text-muted-foreground" />
          <Input
            className="h-8 w-full pl-8"
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search columns…"
            value={query}
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            className="text-xs underline"
            onClick={onCollapseAll}
            type="button"
          >
            Collapse all
          </button>
          <button
            className="text-xs underline"
            onClick={onExpandAll}
            type="button"
          >
            Expand all
          </button>
          <button className="text-xs underline" onClick={onReset} type="button">
            Reset
          </button>
        </div>
      </div>

      {/* Available columns */}
      <div className="max-h-64 overflow-auto">
        {availableColumns.length === 0 ? (
          <div className="px-3 py-2 text-muted-foreground text-sm">
            {grouping.length >= 2 ? 'Maximum 2 levels reached' : 'No columns'}
          </div>
        ) : (
          availableColumns.map((column) => (
            <button
              className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-muted"
              key={column.id}
              onClick={() => {
                // Limit to maximum 2 levels of grouping
                if (grouping.length >= 2) {
                  return;
                }
                onChange([...grouping, column.id]);
              }}
              type="button"
            >
              <span className="flex items-center gap-2">
                <ColumnIcon columnType={column.type || 'text'} />
                {column.label}
              </span>
              <span className="text-muted-foreground text-xs">
                {grouping.length >= 2 ? 'Max reached' : 'Add'}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
