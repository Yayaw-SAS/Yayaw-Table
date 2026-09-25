"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useTableActions, useTranslations } from "../providers/table-provider";
import type { FileTreeHooks } from "../utils/filetree-model";
import {
  type FolderDirectory,
  folderTreeOf,
  loadFolderDirectory,
} from "../utils/folder-directory";
import type { ScopedRowsRequest } from "../utils/scoped-rows";
import { useTableConfig } from "./use-table-config";

/** The host hooks of `table.filetree` (`isFolder`, `canCreateFolder`…). */
export const fileTreeHooksOf = (filetree: unknown): FileTreeHooks =>
  filetree && typeof filetree === "object" ? (filetree as FileTreeHooks) : {};

/**
 * The table's file tree settings when its rows form a tree (a parent column),
 * and every folder with its location, loaded on first use through `list`
 * (the `subtree` scope, else pages) and again after the table's data changes.
 */
export function useFolderDirectory({
  enabled = true,
  tableId,
  tableType,
}: {
  enabled?: boolean;
  tableId: string;
  tableType: string;
}) {
  const { config } = useTableConfig(tableType);
  const getTableActions = useTableActions();
  const { locale } = useTranslations();
  const filetree = config.table.filetree;
  const definitions = config.columns.definitions;
  const tree = useMemo(
    () => folderTreeOf(filetree, definitions),
    [definitions, filetree]
  );
  const list = getTableActions?.(tableType)?.list as
    | ScopedRowsRequest["list"]
    | undefined;
  const query = useQuery<FolderDirectory>({
    enabled: enabled && Boolean(tree),
    queryFn: ({ signal }) => {
      if (!tree) {
        return { folders: [], truncated: false };
      }
      return loadFolderDirectory({
        list,
        settings: tree,
        hooks: fileTreeHooksOf(filetree),
        locale,
        signal,
      });
    },
    queryKey: ["tableData", tableId, "folders", tree?.parentColumn ?? ""],
    staleTime: 30_000,
  });
  return {
    tree,
    directory: query.data,
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
