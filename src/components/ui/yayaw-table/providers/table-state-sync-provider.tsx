"use client";

import { createContext, type ReactNode, useContext } from "react";

const TableStateSyncContext = createContext(true);

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
