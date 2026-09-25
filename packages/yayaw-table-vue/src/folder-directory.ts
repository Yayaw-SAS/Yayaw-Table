/**
 * The folders of a table whose rows form a file tree, outside the File tree
 * view: "New folder" in every view, the folder filter of the filter menus and
 * the facet panel's folder facet. Shared by the React and Vue editions
 * (synced to Vue); pure, apart from the loader calling the host's `list`.
 */
import type { FacetFolderLabel, FacetTranslate } from "./facets-model";
import {
  buildFileTreeIndex,
  FILETREE_MAX_NODES,
  FILETREE_ROOT,
  FILETREE_UNFILED,
  type FileTreeActions,
  type FileTreeHooks,
  type FileTreeTranslate,
  fileTreeAncestors,
  fileTreeLabel,
  fileTreePathText,
  isFileTreeAvailable,
  nameOf,
  normalizeFileTreeViewConfig,
  type ResolvedFileTreeSettings,
  resolveFileTreeSettings,
  rowIdOf,
} from "./filetree-model";
import { loadScopedRows, type ScopedRowsRequest } from "./scoped-rows";
import {
  compatibleListParams,
  normalizeFilterEnvelope,
  recordValue,
} from "./table-contracts";

type Row = Record<string, unknown>;

/** A folder, where it sits and its place in the tree's order. */
export interface FolderEntry {
  id: string;
  name: string;
  parentId: string | null;
  /** Names of its ancestors, root first. */
  ancestors: string[];
  /** Folder levels above it (0 at the root). */
  depth: number;
  /** Place in the tree's order (folders first, natural names). */
  order: number;
  /** The folder's record (for the host's `canCreateFolder`). */
  row: Row;
}

export interface FolderDirectory {
  /** Every folder known, in the tree's order. */
  folders: FolderEntry[];
  /** Only the first rows were read (`FILETREE_MAX_NODES`): some folders may be missing. */
  truncated: boolean;
}

/** The file tree of a table: its settings when its rows form a tree, else undefined. */
export function folderTreeOf(
  filetree: unknown,
  columns: readonly { id: string; header?: string; type?: string }[]
): ResolvedFileTreeSettings | undefined {
  if (!isFileTreeAvailable(filetree, columns)) {
    return;
  }
  return resolveFileTreeSettings(
    columns,
    normalizeFileTreeViewConfig(filetree)
  );
}

/** Host options of `table.filetree` read outside the File tree view. */
export interface FolderTableOptions {
  /** "New folder" in the toolbar of the other views (default true). */
  newFolderAction: boolean;
  /** The parent column filters with a folder picker (default true). */
  folderFilter: boolean;
}

/** `table.filetree.newFolderAction` and `folderFilter`, on unless `false`. */
export function folderTableOptions(filetree: unknown): FolderTableOptions {
  const source = recordValue(filetree);
  return {
    newFolderAction: source.newFolderAction !== false,
    folderFilter: source.folderFilter !== false,
  };
}

// Directory -------------------------------------------------------------------------

export interface FolderDirectoryInput {
  settings: Pick<
    ResolvedFileTreeSettings,
    "foldersFirst" | "kindColumn" | "nameColumn" | "parentColumn" | "sort"
  >;
  hooks?: Pick<FileTreeHooks, "isFolder">;
  getRowId?: (row: Row) => string;
  locale?: string;
}

/** The folders among rows, with their ancestors, in the tree's order. */
export function buildFolderDirectory(
  rows: readonly Row[],
  input: FolderDirectoryInput,
  truncated = false
): FolderDirectory {
  const index = buildFileTreeIndex(rows, {
    getRowId: input.getRowId,
    settings: input.settings,
    hooks: input.hooks,
    locale: input.locale,
  });
  const parentOf = (id: string) => {
    const parent = index.parentOf.get(id);
    return parent === FILETREE_UNFILED ? null : parent;
  };
  const name = (id: string) =>
    nameOf(index.rows.get(id), input.settings.nameColumn);
  const folders: FolderEntry[] = [];
  const visit = (key: string) => {
    for (const id of index.children.get(key) ?? []) {
      if (id === FILETREE_UNFILED || !index.folders.has(id)) {
        continue;
      }
      const ancestors = fileTreeAncestors(id, parentOf);
      folders.push({
        id,
        name: name(id),
        parentId: parentOf(id) ?? null,
        ancestors: ancestors.map(name),
        depth: ancestors.length,
        order: folders.length,
        row: index.rows.get(id) ?? {},
      });
      visit(id);
    }
  };
  visit(FILETREE_ROOT);
  // Folders under Unfiled (an unknown parent) come after the tree.
  for (const id of index.children.get(FILETREE_UNFILED) ?? []) {
    if (index.folders.has(id) && !folders.some((entry) => entry.id === id)) {
      folders.push({
        id,
        name: name(id),
        parentId: null,
        ancestors: [],
        depth: 0,
        order: folders.length,
        row: index.rows.get(id) ?? {},
      });
      visit(id);
    }
  }
  return { folders, truncated };
}

export interface FolderDirectoryRequest extends FolderDirectoryInput {
  /** `actions.list`; asked for the whole tree with the `subtree` scope. */
  list?: ScopedRowsRequest["list"];
  /** The rows, for tables without a list action. */
  rows?: readonly Row[];
  maxRows?: number;
  signal?: AbortSignal;
}

const isRecord = (value: unknown): value is Row =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Every folder of the table: `list` with the `subtree` scope from the root
 * (and a kind rule when a kind column says which rows are folders), as "Expand
 * all" asks, or every row loaded page by page when the host ignores the
 * scope; at most `maxRows` rows (2,000).
 */
export async function loadFolderDirectory(
  request: FolderDirectoryRequest
): Promise<FolderDirectory> {
  const { list, settings } = request;
  const maxRows = request.maxRows ?? FILETREE_MAX_NODES;
  if (!list) {
    return buildFolderDirectory(request.rows ?? [], request);
  }
  const kindRules = settings.kindColumn
    ? [
        {
          id: "folders",
          columnId: settings.kindColumn,
          type: "select",
          operator: "isAnyOf",
          values: ["folder"],
          isActive: true,
        },
      ]
    : [];
  const answer = await list(
    compatibleListParams({
      page: 1,
      pageSize: maxRows,
      advancedFilters: kindRules,
      scope: { kind: "subtree", parentId: null },
    })
  );
  request.signal?.throwIfAborted();
  const meta = recordValue(answer.meta);
  if (meta.scope === "applied") {
    const rows = (answer.data ?? []).filter(isRecord);
    return buildFolderDirectory(
      rows.slice(0, maxRows),
      request,
      meta.truncated === true || rows.length > maxRows
    );
  }
  const loaded = await loadScopedRows({
    list,
    params: { advancedFilters: kindRules },
    maxRows,
    signal: request.signal,
  });
  return buildFolderDirectory(loaded.rows, request, loaded.truncated);
}

/** A folder by id. */
export const folderById = (
  directory: FolderDirectory | undefined,
  id: string | null | undefined
): FolderEntry | undefined =>
  id ? directory?.folders.find((entry) => entry.id === id) : undefined;

/** "Campaigns › 2026 › Spring launch": the folder with its ancestors. */
export const folderPathText = (entry: FolderEntry): string =>
  fileTreePathText([...entry.ancestors, entry.name]);

/** Where a folder sits: its ancestors ("Campaigns › 2026"), or the root's label. */
export const folderLocationText = (
  entry: FolderEntry,
  rootLabel: string
): string =>
  entry.ancestors.length ? fileTreePathText(entry.ancestors) : rootLabel;

const DIACRITICS = /\p{M}/gu;
const fold = (text: string) =>
  text.normalize("NFD").replace(DIACRITICS, "").toLocaleLowerCase();

/** Folders whose name or location contains the search, in the tree's order. */
export function searchFolders(
  directory: FolderDirectory | undefined,
  query: string
): FolderEntry[] {
  const needle = fold(query.trim());
  const folders = directory?.folders ?? [];
  return needle
    ? folders.filter((entry) => fold(folderPathText(entry)).includes(needle))
    : folders;
}

/** The label the root has in folder pickers and filters ("Root"). */
export const rootFolderLabel = (
  locale: string,
  translate?: FileTreeTranslate
): string => fileTreeLabel("rootFolder", locale, translate);

/**
 * A folder's facet label: its name, its location as detail, its place in the
 * tree. An id no folder has (a deleted parent) reads as itself, "Unfiled".
 */
export function folderFacetLabel(
  directory: FolderDirectory | undefined,
  id: string,
  locale: string,
  translate?: FacetTranslate
): FacetFolderLabel {
  const entry = folderById(directory, id);
  if (!entry) {
    return {
      label: id,
      detail: fileTreeLabel("unfiled", locale, translate),
    };
  }
  return {
    label: entry.name,
    detail: folderLocationText(entry, rootFolderLabel(locale, translate)),
    order: entry.order,
  };
}

// The folder filter -------------------------------------------------------------------

/** What a folder filter holds: the root, or folders (any of them). */
export interface FolderChoice {
  root: boolean;
  ids: string[];
}

/** A folder filter rule's choice: `isEmpty` is the root, `isAnyOf` the folders. */
export function folderChoiceOf(rule: {
  operator?: unknown;
  values?: unknown;
}): FolderChoice {
  if (rule.operator === "isEmpty") {
    return { root: true, ids: [] };
  }
  const values = Array.isArray(rule.values) ? rule.values : [rule.values];
  return {
    root: false,
    ids: [
      ...new Set(
        values
          .filter(
            (value) =>
              (typeof value === "string" || typeof value === "number") &&
              value !== ""
          )
          .map(String)
      ),
    ],
  };
}

/**
 * The operator and values after a click in the folder picker: the root
 * (`null`) is chosen alone (`isEmpty`); a folder joins or leaves the chosen
 * folders (`isAnyOf`) and replaces the root.
 */
export function toggleFolderChoice(
  current: { operator?: unknown; values?: unknown },
  id: string | null
): { operator: "isAnyOf" | "isEmpty"; values: string[] } {
  const choice = folderChoiceOf(current);
  if (id === null) {
    return choice.root
      ? { operator: "isAnyOf", values: [] }
      : { operator: "isEmpty", values: [] };
  }
  const ids = choice.ids.includes(id)
    ? choice.ids.filter((item) => item !== id)
    : [...choice.ids, id];
  return { operator: "isAnyOf", values: ids };
}

/** A folder choice is complete: the root or at least one folder. */
export const folderChoiceComplete = (current: {
  operator?: unknown;
  values?: unknown;
}): boolean => {
  const choice = folderChoiceOf(current);
  return choice.root || choice.ids.length > 0;
};

/** The operators the folder filter writes. */
export const FOLDER_FILTER_OPERATORS = ["isAnyOf", "isEmpty"] as const;

/**
 * A folder rule's text for filter chips: "Root", or the folders' names
 * ("Spring launch, 2026"); ids no folder has read as themselves.
 */
export function folderChoiceText(
  current: { operator?: unknown; values?: unknown },
  directory: FolderDirectory | undefined,
  locale: string,
  translate?: FileTreeTranslate
): string {
  const choice = folderChoiceOf(current);
  if (choice.root) {
    return rootFolderLabel(locale, translate);
  }
  return choice.ids
    .map((id) => folderById(directory, id)?.name ?? id)
    .join(", ");
}

// New folder ------------------------------------------------------------------------

/** Modes that show "New folder" in the toolbar: every mode listing records but the File tree, which has its own. */
const MODES_WITHOUT_NEW_FOLDER = new Set(["filetree", "form", "gantt"]);

export const newFolderShownIn = (mode: string): boolean =>
  !MODES_WITHOUT_NEW_FOLDER.has(mode);

/**
 * The name a new folder gets, as in the File tree: the text typed, trimmed,
 * or "New folder".
 */
export const newFolderName = (
  value: string,
  locale: string,
  translate?: FileTreeTranslate
): string => value.trim() || fileTreeLabel("newFolderName", locale, translate);

export interface FolderCreation {
  tree?: Pick<FileTreeActions, "createFolder">;
  /** `create` through the table (with the kind column set to "folder"). */
  createRecord?: (values: Row) => Promise<{ success: boolean; error?: string }>;
  canCreate?: boolean;
  hooks?: Pick<FileTreeHooks, "canCreateFolder">;
}

/**
 * Whether a folder can be created under a parent (`null` is the root):
 * `actions.tree.createFolder`, or `create` when records can be created, and
 * the host's `canCreateFolder`, as in the File tree.
 */
export function canCreateFolderUnder(
  parent: Row | null,
  creation: FolderCreation
): boolean {
  const creatable = Boolean(
    creation.tree?.createFolder ?? (creation.canCreate && creation.createRecord)
  );
  return creatable && creation.hooks?.canCreateFolder?.(parent) !== false;
}

/**
 * Creates a folder through `actions.tree.createFolder`, or `create` with the
 * kind column set to "folder", as the File tree does. Answers the new
 * folder's id when the host returns its row; throws the host's error.
 */
export async function createFolderRecord(
  input: FolderCreation & {
    settings: Pick<
      ResolvedFileTreeSettings,
      "kindColumn" | "nameColumn" | "parentColumn"
    >;
    parentId: string | null;
    name: string;
    getRowId?: (row: Row) => string;
    /** Message when the host answers a failure without one. */
    failure: string;
  }
): Promise<{ id?: string; row?: Row }> {
  const { settings, parentId, name } = input;
  if (input.tree?.createFolder) {
    const row = await input.tree.createFolder({ parentId, name });
    if (!isRecord(row)) {
      return {};
    }
    const id = (input.getRowId ?? rowIdOf)(row);
    return { ...(id ? { id } : {}), row };
  }
  const result = await input.createRecord?.({
    [settings.nameColumn]: name,
    [settings.parentColumn]: parentId,
    ...(settings.kindColumn ? { [settings.kindColumn]: "folder" } : {}),
  });
  if (!result?.success) {
    throw new Error(result?.error ?? input.failure);
  }
  return {};
}

/**
 * The folder a new folder goes into by default: the one the view is filtered
 * on (one folder), else the root.
 */
export function defaultNewFolderParent(
  advancedFilters: unknown,
  parentColumn: string
): string | null {
  const rules = normalizeFilterEnvelope(advancedFilters).filters.filter(
    (filter) =>
      filter.isActive !== false &&
      filter.columnId === parentColumn &&
      ["isAnyOf", "is", "equals", "in"].includes(String(filter.operator))
  );
  const choice = rules[0] ? folderChoiceOf(rules[0]) : undefined;
  return choice?.ids.length === 1 ? (choice.ids[0] ?? null) : null;
}
