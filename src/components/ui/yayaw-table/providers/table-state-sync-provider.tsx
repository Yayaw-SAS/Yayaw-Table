"use client";

import { createContext, type ReactNode, useContext, useMemo } from "react";

/** A sort as the table state and the list contract carry it. */
export type TableSorting = { id: string; desc: boolean }[];

const NO_SORTING: TableSorting = [];
const TableStateSyncContext = createContext(true);
const TableDefaultSortingContext = createContext<TableSorting>(NO_SORTING);
const TableInstanceContext = createContext<string | undefined>(undefined);

export function TableStateSyncProvider({
  children,
  defaultSorting,
  enabled,
}: {
  children: ReactNode;
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
  return (
    <TableStateSyncContext.Provider value={enabled}>
      <TableDefaultSortingContext.Provider value={sorting}>
        {children}
      </TableDefaultSortingContext.Provider>
    </TableStateSyncContext.Provider>
  );
}

export const useTableStateSync = (): boolean =>
  useContext(TableStateSyncContext);

/** The configured sort of the enclosing table (`columns.sort`), `[]` when none. */
export const useTableDefaultSorting = (): TableSorting =>
  useContext(TableDefaultSortingContext);

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
