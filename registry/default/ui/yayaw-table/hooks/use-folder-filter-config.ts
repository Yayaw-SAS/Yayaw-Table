"use client";

import { useCallback, useMemo } from "react";
import { translateWithFallback } from "../components/filters/i18n-utils";
import { useTranslations } from "../providers/table-provider";
import type {
  ColumnsFilterConfig,
  FilterOperators,
} from "../types/filter-types";
import { fileTreeLabel } from "../utils/filetree-model";
import {
  FOLDER_FILTER_OPERATORS,
  folderTableOptions,
  folderTreeOf,
  rootFolderLabel,
} from "../utils/folder-directory";
import { normalizeFilterEnvelope } from "../utils/table-contracts";
import { useFolderDirectory } from "./use-folder-directory";
import { useTableConfig } from "./use-table-config";

/**
 * The filter menus' columns with the file tree's parent column filtering
 * through a folder picker (the root and the folders, with their locations),
 * unless `table.filetree.folderFilter` is false. Folders load when a rule on
 * the column needs its names; the picker loads them when it opens.
 */
export function useFolderFilterConfig({
  advancedFilters,
  columnsConfig,
  tableId,
  tableType,
}: {
  advancedFilters: unknown;
  columnsConfig: ColumnsFilterConfig;
  tableId: string;
  tableType: string;
}): ColumnsFilterConfig {
  const { config } = useTableConfig(tableType);
  const { locale, t } = useTranslations();
  const filetree = config.table.filetree;
  const definitions = config.columns.definitions;
  const tree = useMemo(
    () => folderTreeOf(filetree, definitions),
    [definitions, filetree]
  );
  const column = tree?.parentColumn;
  const enabled = Boolean(
    column && folderTableOptions(filetree).folderFilter && columnsConfig[column]
  );
  const hasRule = normalizeFilterEnvelope(advancedFilters).filters.some(
    (filter) => filter.columnId === column
  );
  const { directory } = useFolderDirectory({
    enabled: enabled && hasRule,
    tableId,
    tableType,
  });
  const translate = useCallback(
    (key: string, fallback: string) =>
      translateWithFallback(t, `filetree.${key}`, fallback),
    [t]
  );
  return useMemo(() => {
    const base = column ? columnsConfig[column] : undefined;
    if (!(enabled && column && base)) {
      return columnsConfig;
    }
    const label = (key: Parameters<typeof fileTreeLabel>[0]) =>
      fileTreeLabel(key, locale, translate);
    return {
      ...columnsConfig,
      [column]: {
        ...base,
        type: "select",
        faceted: false,
        operators: [...FOLDER_FILTER_OPERATORS] as FilterOperators["select"][],
        options:
          directory?.folders.map((entry) => ({
            value: entry.id,
            label: entry.name,
          })) ?? [],
        folder: {
          tableId,
          tableType,
          directory,
          rootLabel: rootFolderLabel(locale, translate),
          inLabel: label("inFolder"),
          label: base.label ?? label("folder"),
          searchLabel: label("searchFolders"),
          loadingLabel: label("loading"),
          emptyLabel: label("noFolders"),
        },
      },
    };
  }, [
    column,
    columnsConfig,
    directory,
    enabled,
    locale,
    tableId,
    tableType,
    translate,
  ]);
}
