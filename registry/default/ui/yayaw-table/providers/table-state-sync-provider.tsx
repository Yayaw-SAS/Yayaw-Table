"use client";

import { createContext, type ReactNode, useContext } from "react";

const TableStateSyncContext = createContext(true);
const TableInstanceContext = createContext<string | undefined>(undefined);

export function TableStateSyncProvider({
  children,
  enabled,
}: {
  children: ReactNode;
  enabled: boolean;
}) {
  return (
    <TableStateSyncContext.Provider value={enabled}>
      {children}
    </TableStateSyncContext.Provider>
  );
}

export const useTableStateSync = (): boolean =>
  useContext(TableStateSyncContext);

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
