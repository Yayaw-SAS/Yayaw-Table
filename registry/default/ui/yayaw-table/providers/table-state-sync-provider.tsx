"use client";

import { createContext, type ReactNode, useContext, useMemo } from "react";
import { resolveColumnOrder } from "../utils/table-view-state";

/** A sort as the table state and the list contract carry it. */
export type TableSorting = { id: string; desc: boolean }[];

/**
 * The columns a table shows when its URL carries none: the data columns in
 * their configured order, and whether each one shows. The URL carries only
 * what differs from them, never the `select` and `actions` columns.
 */
export interface TableColumnDefaults {
  order: string[];
  visibility: Record<string, boolean>;
}

const NO_SORTING: TableSorting = [];
const TableStateSyncContext = createContext(true);
const TableDefaultSortingContext = createContext<TableSorting>(NO_SORTING);
const TableColumnDefaultsContext = createContext<TableColumnDefaults>({
  order: [],
  visibility: {},
});
const TableInstanceContext = createContext<string | undefined>(undefined);

export function TableStateSyncProvider({
  children,
  columns,
  defaultSorting,
  enabled,
}: {
  children: ReactNode;
  /** The table's configured columns (`columns`): what its URL leaves out. */
  columns?: {
    definitions: readonly { id: string }[];
    order?: string[];
    visible?: string[];
  };
  /**
   * The table's configured sort (`columns.sort`): the sort a table starts
   * from and returns to on reset when neither the URL nor a view sets one.
   */
  defaultSorting?: TableSorting;
  enabled: boolean;
}) {
  const sortingKey = JSON.stringify(defaultSorting ?? NO_SORTING);
  // One reference per configured sort, so state derived from it stays stable.
  const sorting = useMemo(
    () => JSON.parse(sortingKey) as TableSorting,
    [sortingKey]
  );
  const columnsKey = JSON.stringify([
    columns?.definitions.map((column) => column.id) ?? [],
    columns?.order ?? [],
    columns?.visible ?? [],
  ]);
  const columnDefaults = useMemo(() => {
    const [ids, order, visible] = JSON.parse(columnsKey) as string[][];
    const dataColumn = (id: string) => id !== "select" && id !== "actions";
    return {
      order: resolveColumnOrder(order, ids).filter(dataColumn),
      // As the table shows them: the listed columns, or all without a list.
      visibility: Object.fromEntries(
        ids
          .filter(dataColumn)
          .map((id) => [id, visible.length === 0 || visible.includes(id)])
      ),
    };
  }, [columnsKey]);
  return (
    <TableStateSyncContext.Provider value={enabled}>
      <TableDefaultSortingContext.Provider value={sorting}>
        <TableColumnDefaultsContext.Provider value={columnDefaults}>
          {children}
        </TableColumnDefaultsContext.Provider>
      </TableDefaultSortingContext.Provider>
    </TableStateSyncContext.Provider>
  );
}

export const useTableStateSync = (): boolean =>
  useContext(TableStateSyncContext);

/** The configured sort of the enclosing table (`columns.sort`), `[]` when none. */
export const useTableDefaultSorting = (): TableSorting =>
  useContext(TableDefaultSortingContext);

/** The enclosing table's default columns, none outside a table. */
export const useTableColumnDefaults = (): TableColumnDefaults =>
  useContext(TableColumnDefaultsContext);

/**
 * Scopes a table instance's URL keys: `<instanceId>-view`,
 * `<instanceId>-historyIndex` and `<instanceId>-…` instead of `view`,
 * `historyIndex` and `<tableId>-…`, so several tables share a page.
 */
export function TableInstanceProvider({
  children,
  instanceId,
}: {
  children: ReactNode;
  instanceId?: string;
}) {
  return (
    <TableInstanceContext.Provider value={instanceId || undefined}>
      {children}
    </TableInstanceContext.Provider>
  );
}

export const useTableInstanceId = (): string | undefined =>
  useContext(TableInstanceContext);

/** URL keys of a table: shared `view`/`historyIndex` unless the instance is scoped. */
export function tableUrlKeys(
  tableId: string,
  instanceId?: string
): { prefix: string; view: string; historyIndex: string } {
  return instanceId
    ? {
        prefix: instanceId,
        view: `${instanceId}-view`,
        historyIndex: `${instanceId}-historyIndex`,
      }
    : { prefix: tableId, view: "view", historyIndex: "historyIndex" };
}
