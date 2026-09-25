import { type ComputedRef, type Ref, ref, watch } from "vue";
import type {
  FileTreeHooks,
  ResolvedFileTreeSettings,
} from "../filetree-model";
import {
  type FolderDirectory,
  folderTreeOf,
  loadFolderDirectory,
} from "../folder-directory";
import type { ScopedRowsRequest } from "../scoped-rows";
import type { TableActions, TableConfig, TableRecord } from "../types";

/** The host hooks of `table.filetree` (`isFolder`, `canCreateFolder`…). */
export const fileTreeHooksOf = (filetree: unknown): FileTreeHooks =>
  filetree && typeof filetree === "object" ? (filetree as FileTreeHooks) : {};

/** The table's folders for pickers and facets, shared by its components. */
export interface FolderDirectoryStore {
  /** The file tree's settings when the table's rows form a tree (a parent column). */
  tree: ResolvedFileTreeSettings | undefined;
  directory: Ref<FolderDirectory | undefined>;
  loading: Ref<boolean>;
  /** Loads the folders on first use, then again after the table's data changes. */
  use: () => void;
}

/**
 * Every folder with its location, loaded through `list` (the `subtree`
 * scope, else pages) or from the local rows, when a picker or a facet first
 * needs them, and again at each `revision` (after the table's data changes).
 */
export function createFolderDirectoryStore<TData extends TableRecord>({
  actions,
  config,
  locale,
  revision,
  rows,
}: {
  actions: ComputedRef<TableActions<TData> | undefined>;
  config: TableConfig<TData>;
  locale: string;
  revision: Ref<number>;
  rows: () => readonly TData[];
}): FolderDirectoryStore {
  const tree = folderTreeOf(config.table.filetree, config.columns.definitions);
  const directory = ref<FolderDirectory>();
  const loading = ref(false);
  let used = false;
  let generation = 0;
  const load = async (): Promise<void> => {
    if (!tree) {
      return;
    }
    generation += 1;
    const current = generation;
    loading.value = true;
    try {
      const list = actions.value?.list;
      const result = await loadFolderDirectory({
        list: list
          ? ((async (params) =>
              await list(params as never)) as ScopedRowsRequest["list"])
          : undefined,
        rows: rows(),
        settings: tree,
        hooks: fileTreeHooksOf(config.table.filetree),
        locale,
      });
      if (current === generation) {
        directory.value = result;
      }
    } catch {
      // The picker keeps the folders it has; the tree view reports errors.
    } finally {
      if (current === generation) {
        loading.value = false;
      }
    }
  };
  watch(revision, () => {
    if (used) {
      load().catch(() => undefined);
    }
  });
  return {
    tree,
    directory,
    loading,
    use: () => {
      if (!used) {
        used = true;
        load().catch(() => undefined);
      }
    },
  };
}
