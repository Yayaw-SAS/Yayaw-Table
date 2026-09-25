"use client";

import { useFolderDirectory } from "../../hooks/use-folder-directory";
import type { FolderFilterConfig } from "../../types/filter-types";
import {
  folderChoiceOf,
  toggleFolderChoice,
} from "../../utils/folder-directory";
import { FolderPicker } from "../folders/folder-picker";

/**
 * The value of a parent column's filter: the root alone (`isEmpty`), or any
 * of the chosen folders (`isAnyOf`), picked in a searchable list with their
 * locations.
 */
export function FolderFilterInput({
  disabled,
  folder,
  onOperatorChange,
  onValueChange,
  operator,
  value,
}: {
  disabled?: boolean;
  folder: FolderFilterConfig;
  onOperatorChange: (operator: "isAnyOf" | "isEmpty") => void;
  onValueChange: (values: string[]) => void;
  operator: string;
  value: unknown;
}) {
  const choice = folderChoiceOf({ operator, values: value });
  const { directory, loading } = useFolderDirectory({
    tableId: folder.tableId,
    tableType: folder.tableType,
  });
  return (
    <FolderPicker
      directory={directory}
      disabled={() => Boolean(disabled)}
      emptyLabel={folder.emptyLabel}
      label={folder.label}
      loading={loading}
      loadingLabel={folder.loadingLabel}
      onPick={(id) => {
        const next = toggleFolderChoice({ operator, values: value }, id);
        onOperatorChange(next.operator);
        onValueChange(next.values);
      }}
      rootLabel={folder.rootLabel}
      searchLabel={folder.searchLabel}
      selected={(id) => (id === null ? choice.root : choice.ids.includes(id))}
    />
  );
}
