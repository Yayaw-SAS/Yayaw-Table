/**
 * Framework-neutral controller of the file tree view, shared by the React and
 * Vue editions: server-first loading (children, subtree and tree-matches
 * scopes with client fallbacks), caching, selection, focus, keyboard
 * commands, drag state, optimistic moves with rollback and undo, rename,
 * folder creation and deletion. Views subscribe and render its state.
 */
import {
  buildFileTreeIndex,
  collectFileTreeSubtree,
  defaultExpandedIds,
  FILETREE_HOVER_EXPAND_MS,
  FILETREE_MAX_NODES,
  FILETREE_PAGE_SIZE,
  FILETREE_ROOT,
  FILETREE_ROOT_TARGET,
  FILETREE_UNFILED,
  type FileTreeActions,
  type FileTreeChildren,
  type FileTreeClick,
  type FileTreeCommand,
  type FileTreeHooks,
  type FileTreeIndex,
  type FileTreeKey,
  type FileTreeLabelKey,
  type FileTreeMoveContext,
  type FileTreeMoveResult,
  type FileTreeTranslate,
  type FileTreeVisibleRow,
  fileTreeAncestorRows,
  fileTreeAncestors,
  fileTreeDropParent,
  fileTreeKeyCommand,
  fileTreeLabel,
  fileTreePathText,
  fileTreeRange,
  fileTreeSelectionAfterClick,
  fileTreeUndoGroups,
  flattenFileTree,
  hasFileTreeQuery,
  isFolderRow,
  isNodeRow,
  moveReasonLabel,
  nameOf,
  parentIdOf,
  type ResolvedFileTreeSettings,
  serializeFileTreeExpanded,
  sortFileTreeIds,
  validateFileTreeMove,
} from "./filetree-model";
import {
  canCreateFolderUnder,
  createFolderRecord,
  newFolderName,
} from "./folder-directory";
import { type ContractRecord, compatibleListParams } from "./table-contracts";

type Row = Record<string, unknown>;

export interface FileTreeListMeta {
  pageCount?: number;
  totalCount?: number;
  scope?: string;
  childCounts?: Record<string, number>;
  sizes?: Record<string, number>;
  ancestors?: unknown[];
  truncated?: boolean;
}

export type FileTreeListAction = (params: ContractRecord) => Promise<{
  data: unknown[];
  meta?: FileTreeListMeta | Record<string, unknown>;
}>;

export interface FileTreeNotification {
  type: "success" | "error" | "info";
  message: string;
  /** Present on moves: reverts them. */
  undo?: () => void;
  undoLabel?: string;
}

export interface FileTreeEvents {
  /** Open a file (preview or record view) or a folder's record. */
  open: (row: Row) => void;
  notify: (notification: FileTreeNotification) => void;
  /** Move DOM focus to this row (the view scrolls it into its window first). */
  focus: (id: string) => void;
  /** Save the open folders in the view. */
  persist: (state: { expanded: string[]; expandedAll: boolean }) => void;
  /** The folder shown in breadcrumbs changed (URL key `<tableId>-folder`). */
  folder: (id: string | null) => void;
  /** Ask the view to confirm deleting these ids. */
  requestDelete: (ids: string[]) => void;
  /** Open the row menu of this id (Shift+F10, context menu key). */
  menu: (id: string) => void;
  /** Reload the table's own data after a mutation. */
  refresh?: () => Promise<void> | void;
}

export interface FileTreeMutationResult {
  success: boolean;
  error?: string;
}

export interface FileTreeControllerOptions {
  list?: FileTreeListAction;
  /** Rows used when there is no list action. */
  rows: readonly Row[];
  /** The view's query (search, filters, sort) as list parameters. */
  params: ContractRecord;
  settings: ResolvedFileTreeSettings;
  hooks: FileTreeHooks;
  getRowId: (row: Row) => string;
  tree?: FileTreeActions;
  patchRow?: (row: Row, patch: Row) => Promise<FileTreeMutationResult>;
  createRecord?: (values: Row) => Promise<FileTreeMutationResult>;
  deleteRow?: (row: Row) => Promise<FileTreeMutationResult>;
  canEditRow?: (row: Row) => boolean;
  canDeleteRow?: (row: Row) => boolean;
  canCreate?: boolean;
  multiple?: boolean;
  locale: string;
  translate?: FileTreeTranslate;
  /** Changes after each table mutation; the tree reloads what it shows. */
  revision?: number;
  events: FileTreeEvents;
}

export interface FileTreeDragState {
  ids: string[];
  overId?: string;
  /** Folder receiving the drop (null is the root). */
  parentId?: string | null;
  valid: boolean;
  message?: string;
}

export type FileTreeMenuKey =
  | "info"
  | "preview"
  | "open"
  | "rename"
  | "move"
  | "new-folder"
  | "delete";

export interface FileTreeMenuItem {
  key: FileTreeMenuKey;
  label: string;
  danger: boolean;
}

export interface FileTreeCrumb {
  id: string | null;
  name: string;
}

export interface FileTreeState {
  status: "loading" | "ready" | "error";
  error?: string;
  rows: FileTreeVisibleRow[];
  focusedId?: string;
  selection: ReadonlySet<string>;
  cut: ReadonlySet<string>;
  renamingId?: string;
  renameError?: string;
  /** Parent of the inline "new folder" row; undefined when none. */
  draftParent?: string | null;
  drag?: FileTreeDragState;
  searching: boolean;
  matches: ReadonlySet<string>;
  notice?: string;
  announcement: string;
  busy: boolean;
  expanding: boolean;
  summary: { folders: number; files: number };
  canExpandAll: boolean;
  canCollapseAll: boolean;
  currentFolder: string | null;
  crumbs: FileTreeCrumb[];
  phone: boolean;
  drillId: string | null;
  uploads: ReadonlyMap<string, number>;
  version: number;
}

interface ChildrenEntry extends FileTreeChildren {
  page: number;
}

type LoadResult = Awaited<ReturnType<FileTreeListAction>>;

const EMPTY_SET: ReadonlySet<string> = new Set();
const keyOf = (parent: string | null | undefined) => parent ?? FILETREE_ROOT;
const parentOfKey = (key: string) => (key === FILETREE_ROOT ? null : key);
const errorText = (cause: unknown) =>
  cause instanceof Error ? cause.message : String(cause);
const isRecord = (value: unknown): value is Row =>
  typeof value === "object" && value !== null;
const MAX_UNDO = 20;
const QUERY_KEYS = [
  "search",
  "filters",
  "advancedFilters",
  "advancedFilterJoin",
] as const;

function metaOf(result: LoadResult): FileTreeListMeta {
  return (result.meta ?? {}) as FileTreeListMeta;
}

/** Every page of a list request, up to `cap` rows. */
async function fetchPages(
  list: FileTreeListAction,
  params: ContractRecord,
  cap: number,
  page = 1,
  collected: Row[] = []
): Promise<{ rows: Row[]; truncated: boolean }> {
  const result = await list({ ...params, page });
  const batch = result.data.filter(isRecord);
  collected.push(...batch);
  const meta = metaOf(result);
  const pageSize = Number(params.pageSize) || batch.length;
  const done =
    batch.length === 0 ||
    (meta.pageCount ? page >= meta.pageCount : batch.length < pageSize) ||
    (meta.totalCount !== undefined && collected.length >= meta.totalCount);
  if (collected.length > cap) {
    return { rows: collected.slice(0, cap), truncated: true };
  }
  return done
    ? { rows: collected, truncated: false }
    : fetchPages(list, params, cap, page + 1, collected);
}

export class FileTreeController {
  private options: FileTreeControllerOptions;
  private readonly listeners = new Set<() => void>();
  private readonly nodes = new Map<string, Row>();
  private readonly parents = new Map<string, string | null>();
  private readonly entries = new Map<string, ChildrenEntry>();
  private readonly childCounts = new Map<string, number>();
  private readonly sizes = new Map<string, number>();
  private clientFolders: Set<string> | undefined;
  private mode: "unknown" | "server" | "client" = "unknown";
  private expanded = new Set<string>();
  private expandedAll = false;
  private autoDepth = false;
  private searchMatches: Set<string> | undefined;
  private selection = new Set<string>();
  private anchorId: string | undefined;
  private focusedId: string | undefined;
  private cutIds: string[] = [];
  private renamingId: string | undefined;
  private renameError: string | undefined;
  private draftParent: string | null | undefined;
  private drag: FileTreeDragState | undefined;
  private hoverTimer: ReturnType<typeof setTimeout> | undefined;
  private typeahead: { buffer: string; at: number } | undefined;
  private notice: string | undefined;
  private announcement = "";
  private status: FileTreeState["status"] = "loading";
  private error: string | undefined;
  private busy = false;
  private expanding = false;
  private phone = false;
  private drillId: string | null = null;
  private readonly uploads = new Map<string, number>();
  private readonly undoStack: (() => Promise<void>)[] = [];
  private generation = 0;
  /** Changes when the cache is cleared; older answers are dropped. */
  private epoch = 0;
  private readonly refetch = new Set<string>();
  private queryKey = "";
  private structureKey = "";
  private displayKey = "";
  private lastPersisted = "";
  private lastFolder: string | null | undefined;
  private version = 0;
  private snapshot: FileTreeState | undefined;
  private started = false;
  private disposed = false;

  constructor(options: FileTreeControllerOptions) {
    this.options = options;
    this.queryKey = this.computeQueryKey();
    this.structureKey = this.computeStructureKey();
    this.displayKey = this.computeDisplayKey();
  }

  // ------------------------------------------------------------ subscription

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getState = (): FileTreeState => {
    if (!this.snapshot) {
      this.snapshot = this.buildState();
    }
    return this.snapshot;
  };

  private emit(): void {
    this.snapshot = undefined;
    this.version += 1;
    for (const listener of this.listeners) {
      listener();
    }
    this.reportFolder();
  }

  /** Load the tree; `folderId` opens a linked folder. */
  start(folderId?: string): void {
    if (this.started) {
      return;
    }
    this.started = true;
    this.disposed = false;
    this.applySavedExpanded();
    this.reload(true).then(
      () => (folderId ? this.openFolder(folderId) : undefined),
      () => undefined
    );
  }

  /** Stop pending work; `start` may run again (React strict mode remounts). */
  dispose(): void {
    this.disposed = true;
    this.started = false;
    this.generation += 1;
    this.clearHoverTimer();
  }

  /** New options from the view; reloads only when the data they describe changed. */
  setOptions(next: FileTreeControllerOptions): void {
    const previous = this.options;
    this.options = next;
    const queryKey = this.computeQueryKey();
    const structureKey = this.computeStructureKey();
    const expandedKey = JSON.stringify([
      next.settings.expanded,
      next.settings.expandedAll,
    ]);
    const structureChanged = structureKey !== this.structureKey;
    const queryChanged = queryKey !== this.queryKey;
    this.queryKey = queryKey;
    this.structureKey = structureKey;
    if (!this.started) {
      return;
    }
    if (structureChanged || queryChanged) {
      this.reload(true).catch(() => undefined);
      return;
    }
    if (expandedKey !== this.lastPersisted && next.settings.expandedSaved) {
      this.applySavedExpanded();
      this.ensureExpandedLoaded();
    }
    const revisionChanged = previous.revision !== next.revision;
    const rowsChanged = !next.list && previous.rows !== next.rows;
    if (revisionChanged || rowsChanged) {
      this.reload(false).catch(() => undefined);
      return;
    }
    const displayKey = this.computeDisplayKey();
    if (displayKey !== this.displayKey) {
      this.displayKey = displayKey;
      this.emit();
    }
  }

  private computeDisplayKey(): string {
    const { locale, multiple, settings } = this.options;
    return JSON.stringify([locale, multiple, settings.rootLabel]);
  }

  private computeQueryKey(): string {
    const params = compatibleListParams(this.options.params);
    return JSON.stringify(QUERY_KEYS.map((key) => params[key]));
  }

  private computeStructureKey(): string {
    const { settings } = this.options;
    return JSON.stringify([
      settings.parentColumn,
      settings.kindColumn,
      settings.nameColumn,
      settings.sort,
      settings.foldersFirst,
      this.sortParams(),
    ]);
  }

  // ------------------------------------------------------------ accessors

  row(id: string): Row | undefined {
    return this.nodes.get(id);
  }

  name(id: string | null): string {
    if (id === null) {
      return this.rootLabel();
    }
    if (id === FILETREE_UNFILED) {
      return this.label("unfiled");
    }
    return nameOf(this.nodes.get(id), this.options.settings.nameColumn);
  }

  rootLabel(): string {
    return this.options.settings.rootLabel ?? this.label("root");
  }

  label(
    key: FileTreeLabelKey,
    params?: Record<string, string | number>
  ): string {
    return fileTreeLabel(
      key,
      this.options.locale,
      this.options.translate,
      params
    );
  }

  parentOf = (id: string): string | null | undefined => this.parents.get(id);

  isFolder = (id: string): boolean => {
    if (id === FILETREE_UNFILED) {
      return true;
    }
    if (this.clientFolders) {
      return this.clientFolders.has(id);
    }
    const row = this.nodes.get(id);
    if (!row) {
      return false;
    }
    const known =
      (this.childCounts.get(id) ?? 0) > 0 ||
      (this.entries.get(id)?.ids.length ?? 0) > 0;
    return isFolderRow(row, this.options.settings, this.options.hooks, known);
  };

  /** Host totals for a folder (`meta.sizes`). */
  folderSize(id: string): number | undefined {
    return this.sizes.get(id);
  }

  isVirtual(id: string): boolean {
    return id === FILETREE_UNFILED;
  }

  canRename(id: string): boolean {
    const row = this.nodes.get(id);
    return Boolean(
      row &&
        this.options.patchRow &&
        this.options.canEditRow?.(row) !== false &&
        this.options.hooks.canRename?.(row) !== false
    );
  }

  canDelete(ids: readonly string[]): boolean {
    return (
      Boolean(this.options.deleteRow) &&
      ids.length > 0 &&
      ids.every((id) => {
        const row = this.nodes.get(id);
        return (
          Boolean(row) && this.options.canDeleteRow?.(row as Row) !== false
        );
      })
    );
  }

  canMoveIds(ids: readonly string[]): boolean {
    const movable = Boolean(this.options.tree?.move ?? this.options.patchRow);
    return (
      movable &&
      ids.length > 0 &&
      ids.every((id) => {
        const row = this.nodes.get(id);
        return (
          Boolean(row) &&
          (this.options.tree?.move !== undefined ||
            this.options.canEditRow?.(row as Row) !== false)
        );
      })
    );
  }

  canCreateFolderIn(parentId: string | null): boolean {
    if (parentId === FILETREE_UNFILED) {
      return false;
    }
    const parent =
      parentId === null ? null : (this.nodes.get(parentId) ?? null);
    return canCreateFolderUnder(parent, {
      tree: this.options.tree,
      createRecord: this.options.createRecord,
      canCreate: this.options.canCreate,
      hooks: this.options.hooks,
    });
  }

  /** Ids an action applies to: the selection when it holds the row, else the row. */
  actionIds(id?: string): string[] {
    if (id && !this.selection.has(id)) {
      return id === FILETREE_UNFILED ? [] : [id];
    }
    if (this.selection.size) {
      return [...this.selection];
    }
    const focused = this.focusedId;
    return focused && focused !== FILETREE_UNFILED && this.nodes.has(focused)
      ? [focused]
      : [];
  }

  /** Root first, the folder last. */
  crumbs(folderId: string | null): FileTreeCrumb[] {
    const root: FileTreeCrumb = { id: null, name: this.rootLabel() };
    if (folderId === null) {
      return [root];
    }
    const ids = [...fileTreeAncestors(folderId, this.parentOf), folderId];
    return [root, ...ids.map((id) => ({ id, name: this.name(id) }))];
  }

  pathText(folderId: string | null): string {
    return fileTreePathText(this.crumbs(folderId).map((crumb) => crumb.name));
  }

  /** Check a move without doing it (drag feedback, the Move to dialog). */
  checkMove(ids: readonly string[], parentId: string | null) {
    return validateFileTreeMove(ids, parentId, this.moveContext());
  }

  moveReason(
    ids: readonly string[],
    parentId: string | null
  ): string | undefined {
    const check = this.checkMove(ids, parentId);
    return check.ok ? undefined : this.label(moveReasonLabel(check.reason));
  }

  /** Known folders for the Move to dialog: a folders-only tree, or matches with their path. */
  folderRows(
    expanded: ReadonlySet<string>,
    query: string
  ): {
    id: string | null;
    name: string;
    level: number;
    path?: string;
    expanded: boolean;
    hasChildren: boolean;
  }[] {
    const needle = query.trim().toLocaleLowerCase();
    if (needle) {
      return [...this.nodes.keys()]
        .filter(
          (id) =>
            this.isFolder(id) &&
            this.name(id).toLocaleLowerCase().includes(needle)
        )
        .map((id) => ({
          id,
          name: this.name(id),
          level: 1,
          path: this.pathText(this.parents.get(id) ?? null),
          expanded: false,
          hasChildren: false,
        }));
    }
    const rows = flattenFileTree({
      children: (key) => {
        const entry = this.entries.get(key);
        return entry
          ? {
              ...entry,
              ids: entry.ids.filter(
                (id) => this.isFolder(id) && id !== FILETREE_UNFILED
              ),
              total: undefined,
              hasMore: false,
            }
          : undefined;
      },
      isFolder: this.isFolder,
      name: (id) => this.name(id),
      expanded,
      childCount: (id) => this.childCounts.get(id),
    }).filter(isNodeRow);
    return [
      {
        id: null,
        name: this.rootLabel(),
        level: 0,
        expanded: true,
        hasChildren: true,
      },
      ...rows.map((row) => ({
        id: row.id,
        name: row.name,
        level: row.level,
        expanded: row.expanded,
        hasChildren: row.hasChildren,
      })),
    ];
  }

  /** Row menu entries available for this row, in order. */
  menuItems(
    id: string,
    options: { preview?: boolean } = {}
  ): FileTreeMenuItem[] {
    if (id === FILETREE_UNFILED || !this.nodes.has(id)) {
      return [];
    }
    const ids = this.actionIds(id);
    const folder = this.isFolder(id);
    const items: [FileTreeMenuKey, FileTreeLabelKey, boolean][] = [
      ["info", "info", true],
      ["preview", "preview", Boolean(options.preview) && !folder],
      ["open", "open", true],
      ["rename", "rename", ids.length === 1 && this.canRename(id)],
      ["move", "moveTo", this.canMoveIds(ids)],
      ["new-folder", "newFolder", folder && this.canCreateFolderIn(id)],
      ["delete", "delete", this.canDelete(ids)],
    ];
    return items
      .filter(([, , shown]) => shown)
      .map(([key, labelKey]) => ({
        key,
        label: this.label(labelKey),
        danger: key === "delete",
      }));
  }

  // ------------------------------------------------------------ state

  private buildState(): FileTreeState {
    const rows = this.visibleRows();
    const nodeRows = rows.filter(isNodeRow);
    const currentFolder = this.currentFolder();
    return {
      status: this.status,
      error: this.error,
      rows,
      focusedId: this.focusedId ?? nodeRows[0]?.id,
      selection: new Set(this.selection),
      cut: new Set(this.cutIds),
      renamingId: this.renamingId,
      renameError: this.renameError,
      draftParent: this.draftParent,
      drag: this.drag,
      searching: this.searchMatches !== undefined,
      matches: this.searchMatches ?? EMPTY_SET,
      notice: this.notice,
      announcement: this.announcement,
      busy: this.busy,
      expanding: this.expanding,
      summary: this.summary(),
      canExpandAll:
        !this.phone &&
        nodeRows.some((row) => row.folder && row.hasChildren && !row.expanded),
      canCollapseAll: !this.phone && nodeRows.some((row) => row.expanded),
      currentFolder,
      crumbs: this.crumbs(currentFolder),
      phone: this.phone,
      drillId: this.drillId,
      uploads: new Map(this.uploads),
      version: this.version,
    };
  }

  private visibleRows(): FileTreeVisibleRow[] {
    return flattenFileTree({
      children: (key) => this.entries.get(key),
      isFolder: this.isFolder,
      name: (id) => this.name(id),
      expanded: this.phone ? EMPTY_SET : this.expanded,
      childCount: (id) => this.childCounts.get(id),
      draftParent: this.draftParent,
      rootKey: this.phone ? keyOf(this.drillId) : FILETREE_ROOT,
    });
  }

  private summary(): { folders: number; files: number } {
    const seen = new Set<string>();
    for (const entry of this.entries.values()) {
      for (const id of entry.ids) {
        if (id !== FILETREE_UNFILED) {
          seen.add(id);
        }
      }
    }
    let folders = 0;
    for (const id of seen) {
      folders += Number(this.isFolder(id));
    }
    return { folders, files: seen.size - folders };
  }

  private currentFolder(): string | null {
    if (this.phone) {
      return this.drillId;
    }
    const focused = this.focusedId;
    if (!(focused && this.nodes.has(focused))) {
      return null;
    }
    return this.isFolder(focused)
      ? focused
      : (this.parents.get(focused) ?? null);
  }

  private reportFolder(): void {
    if (this.status !== "ready") {
      return;
    }
    const folder = this.currentFolder();
    const reported = folder === FILETREE_UNFILED ? null : folder;
    if (reported !== this.lastFolder) {
      this.lastFolder = reported;
      this.options.events.folder(reported);
    }
  }

  private announce(text: string): void {
    this.announcement = text;
  }

  private moveContext(): FileTreeMoveContext {
    return {
      parentOf: this.parentOf,
      isFolder: this.isFolder,
      row: (id) => this.nodes.get(id),
      canMove: this.options.hooks.canMove,
    };
  }

  // ------------------------------------------------------------ loading

  private sortParams(): ContractRecord {
    const sort = this.options.settings.sort;
    return sort
      ? {
          orderBy: { [sort.id]: sort.desc ? "desc" : "asc" },
          sorting: [{ id: sort.id, desc: Boolean(sort.desc) }],
        }
      : {};
  }

  /** The view's parameters without its search and filters (children, subtree). */
  private baseParams(pageSize = FILETREE_PAGE_SIZE): ContractRecord {
    const {
      search: _search,
      q: _q,
      globalSearch: _global,
      filters: _filters,
      advancedFilters: _advanced,
      ...rest
    } = this.options.params;
    return compatibleListParams({
      ...rest,
      ...this.sortParams(),
      page: 1,
      pageSize,
    });
  }

  private reset(): void {
    this.epoch += 1;
    this.refetch.clear();
    this.nodes.clear();
    this.parents.clear();
    this.entries.clear();
    this.childCounts.clear();
    this.sizes.clear();
    this.clientFolders = undefined;
    this.searchMatches = undefined;
    this.notice = undefined;
  }

  /** Load what the tree shows; `fresh` forgets the cache (new query or columns). */
  async reload(fresh: boolean): Promise<void> {
    this.generation += 1;
    const generation = this.generation;
    if (fresh) {
      this.reset();
      this.status = "loading";
      if (this.mode === "client") {
        this.mode = "unknown";
      }
    }
    this.emit();
    try {
      if (hasFileTreeQuery(this.options.params)) {
        await this.loadMatches(generation);
      } else if (this.mode === "client" || !this.options.list) {
        await this.loadClient(generation);
      } else {
        await this.reloadServer(generation, fresh);
      }
      if (generation === this.generation) {
        this.status = "ready";
        this.error = undefined;
      }
    } catch (cause) {
      if (generation === this.generation) {
        this.status = "error";
        this.error = errorText(cause);
      }
    }
    if (generation === this.generation && !this.disposed) {
      this.emit();
    }
  }

  private async reloadServer(
    generation: number,
    fresh: boolean
  ): Promise<void> {
    if (fresh || !this.entries.size) {
      await this.loadChildren(FILETREE_ROOT);
      if (this.mode === "client" || generation !== this.generation) {
        return;
      }
      if (this.expandedAll) {
        await this.expandAll({ persist: false });
        return;
      }
      this.ensureExpandedLoaded();
      return;
    }
    const keys = [...this.entries.keys()].filter(
      (key) => key === FILETREE_ROOT || this.expanded.has(key)
    );
    await Promise.all(
      keys.map((key) => this.loadChildren(key, { replace: true }))
    );
  }

  private listChildren(key: string, page: number): Promise<LoadResult> {
    const list = this.options.list;
    if (!list) {
      return Promise.resolve({ data: [] });
    }
    return list({
      ...this.baseParams(),
      page,
      scope: { kind: "children", parentId: parentOfKey(key) },
    });
  }

  /** Load a folder's children (first page, or the next with `more`). */
  async loadChildren(
    key: string,
    options: { more?: boolean; replace?: boolean } = {}
  ): Promise<void> {
    if (
      this.mode === "client" ||
      this.searchMatches ||
      key === FILETREE_UNFILED
    ) {
      return;
    }
    const current = this.entries.get(key);
    if (current?.loading) {
      // A reload asked while a request is in flight runs once it answers.
      if (options.replace) {
        this.refetch.add(key);
      }
      return;
    }
    const epoch = this.epoch;
    const page = options.more && current ? current.page + 1 : 1;
    this.entries.set(key, {
      ids: current?.ids ?? [],
      total: current?.total,
      loaded: Boolean(current?.loaded),
      loading: true,
      page: current?.page ?? 0,
    });
    this.announce(this.label("loading"));
    this.emit();
    let result: LoadResult;
    try {
      result = await this.listChildren(key, page);
    } catch (cause) {
      if (epoch === this.epoch) {
        this.entries.set(key, {
          ids: current?.ids ?? [],
          loaded: true,
          page: current?.page ?? 0,
          error: errorText(cause),
        });
        this.emit();
      }
      return;
    }
    // Answers from before a new query or columns are dropped.
    if (epoch !== this.epoch) {
      return;
    }
    if (this.mode === "unknown") {
      if (metaOf(result).scope !== "applied") {
        // The host ignores the children scope: build the tree in memory.
        this.mode = "client";
        await this.loadClient(this.generation);
        return;
      }
      this.mode = "server";
    }
    this.absorbChildren(key, result, page, Boolean(options.replace));
    this.emit();
    if (this.refetch.delete(key)) {
      await this.loadChildren(key, { replace: true });
      return;
    }
    this.afterChildrenLoaded(key);
  }

  private absorbChildren(
    key: string,
    result: LoadResult,
    page: number,
    replace: boolean
  ): void {
    const meta = metaOf(result);
    const parentId = parentOfKey(key);
    const batch = result.data.filter(isRecord);
    const ids: string[] = [];
    for (const row of batch) {
      const id = this.options.getRowId(row);
      if (!id) {
        continue;
      }
      this.nodes.set(id, row);
      this.parents.set(id, parentId);
      ids.push(id);
    }
    this.absorbMeta(meta);
    const previous = this.entries.get(key);
    const kept = page > 1 && !replace ? (previous?.ids ?? []) : [];
    const merged = [...new Set([...kept, ...ids])];
    const hasTotal = typeof meta.totalCount === "number";
    const morePages = meta.pageCount
      ? page < meta.pageCount
      : batch.length >= FILETREE_PAGE_SIZE;
    this.entries.set(key, {
      ids: this.sortIds(merged),
      total: hasTotal ? meta.totalCount : undefined,
      hasMore: !hasTotal && morePages,
      loaded: true,
      page,
    });
    if (parentId !== null && hasTotal) {
      this.childCounts.set(parentId, Number(meta.totalCount));
    }
    this.announce(
      this.label("loaded", {
        count: hasTotal ? Number(meta.totalCount) : merged.length,
      })
    );
  }

  private absorbMeta(meta: FileTreeListMeta): void {
    for (const [id, count] of Object.entries(meta.childCounts ?? {})) {
      this.childCounts.set(id, Number(count));
    }
    for (const [id, size] of Object.entries(meta.sizes ?? {})) {
      this.sizes.set(id, Number(size));
    }
  }

  private afterChildrenLoaded(key: string): void {
    const depth = this.options.settings.defaultExpandedDepth;
    if (this.autoDepth) {
      const level =
        key === FILETREE_ROOT
          ? 0
          : fileTreeAncestors(key, this.parentOf).length + 1;
      if (level < depth) {
        for (const id of this.entries.get(key)?.ids ?? []) {
          if (
            id !== FILETREE_UNFILED &&
            this.isFolder(id) &&
            this.childCounts.get(id) !== 0
          ) {
            this.expanded.add(id);
          }
        }
      }
    }
    this.ensureExpandedLoaded();
  }

  /** Load the children of every open folder on screen that has none yet. */
  private ensureExpandedLoaded(): void {
    if (this.mode !== "server" || this.searchMatches) {
      this.emit();
      return;
    }
    const missing = flattenFileTree({
      children: (key) => this.entries.get(key),
      isFolder: this.isFolder,
      name: (id) => this.name(id),
      expanded: this.expanded,
      childCount: (id) => this.childCounts.get(id),
    }).filter(
      (row) => row.type === "node" && row.expanded && !this.entries.has(row.id)
    );
    for (const row of missing) {
      this.loadChildren(row.id).catch(() => undefined);
    }
    if (!missing.length) {
      this.emit();
    }
  }

  private sortIds(ids: readonly string[]): string[] {
    const { settings, locale } = this.options;
    return sortFileTreeIds(ids, this.nodes, {
      nameColumn: settings.nameColumn,
      foldersFirst: settings.foldersFirst,
      sort: settings.sort,
      locale,
      isFolder: (row) => this.isFolder(this.options.getRowId(row)),
    });
  }

  private async loadAllRows(
    params: ContractRecord
  ): Promise<{ rows: Row[]; truncated: boolean }> {
    const list = this.options.list;
    if (!list) {
      return { rows: [...this.options.rows], truncated: false };
    }
    return await fetchPages(
      list,
      { ...params, pageSize: 100 },
      FILETREE_MAX_NODES
    );
  }

  /** Client fallback: every row (capped) through the list action, then the tree in memory. */
  private async loadClient(generation: number): Promise<void> {
    const { rows, truncated } = await this.loadAllRows(this.baseParams(100));
    if (generation !== this.generation) {
      return;
    }
    this.mode = "client";
    this.applyIndex(this.buildIndex(rows));
    this.notice = truncated
      ? this.label("truncated", { count: FILETREE_MAX_NODES })
      : undefined;
    if (this.expandedAll) {
      this.expandEveryKnownFolder();
    } else if (this.autoDepth) {
      this.expanded = new Set(
        defaultExpandedIds(
          (key) => this.entries.get(key)?.ids,
          this.isFolder,
          this.options.settings.defaultExpandedDepth
        )
      );
    }
    this.announce(this.label("loaded", { count: rows.length }));
  }

  private buildIndex(rows: readonly Row[]): FileTreeIndex {
    return buildFileTreeIndex(rows, {
      getRowId: this.options.getRowId,
      settings: this.options.settings,
      hooks: this.options.hooks,
      locale: this.options.locale,
    });
  }

  private applyIndex(index: FileTreeIndex): void {
    this.nodes.clear();
    this.parents.clear();
    this.entries.clear();
    for (const [id, row] of index.rows) {
      this.nodes.set(id, row);
    }
    for (const [id, parent] of index.parentOf) {
      this.parents.set(
        id,
        parent === FILETREE_UNFILED ? FILETREE_UNFILED : parent
      );
    }
    this.parents.set(FILETREE_UNFILED, null);
    for (const [key, ids] of index.children) {
      this.entries.set(key, { ids, total: ids.length, loaded: true, page: 1 });
    }
    this.clientFolders = index.folders;
  }

  /** Search: matches with their ancestors (`tree-matches` scope, or loaded rows). */
  private async loadMatches(generation: number): Promise<void> {
    const list = this.options.list;
    let matches: Row[] = [...this.options.rows];
    let ancestors: Row[] = [];
    let truncated = false;
    if (list) {
      const params = compatibleListParams({
        ...this.options.params,
        ...this.sortParams(),
        page: 1,
        pageSize: FILETREE_MAX_NODES,
      });
      const result = await list({ ...params, scope: { kind: "tree-matches" } });
      const meta = metaOf(result);
      if (meta.scope === "applied") {
        matches = result.data.filter(isRecord);
        ancestors = (meta.ancestors ?? []).filter(isRecord);
        truncated = Boolean(meta.truncated);
      } else {
        const found = await fetchPages(
          list,
          { ...params, pageSize: 100 },
          FILETREE_MAX_NODES
        );
        const all = await this.loadAllRows(this.baseParams(100));
        matches = found.rows;
        truncated = found.truncated || all.truncated;
        ancestors = fileTreeAncestorRows(
          matches,
          all.rows,
          this.options.settings.parentColumn,
          this.options.getRowId
        );
      }
    }
    if (generation !== this.generation) {
      return;
    }
    const index = this.buildIndex([...ancestors, ...matches]);
    this.applyIndex(index);
    // Matched folders are leaves of the results: their other content is not searched.
    for (const id of index.folders) {
      if (!this.entries.has(id)) {
        this.entries.set(id, { ids: [], total: 0, loaded: true, page: 1 });
        this.childCounts.set(id, 0);
      }
    }
    this.searchMatches = new Set(matches.map(this.options.getRowId));
    this.expanded = new Set(
      [...index.children.keys()].filter((key) => key !== FILETREE_ROOT)
    );
    this.notice = truncated
      ? this.label("truncated", { count: FILETREE_MAX_NODES })
      : undefined;
    this.announce(this.label("loaded", { count: matches.length }));
  }

  /** Children of a folder once, for the Move to dialog and the phone drill-down. */
  ensureChildren(id: string | null): void {
    const key = keyOf(id);
    if (!this.entries.has(key)) {
      this.loadChildren(key).catch(() => undefined);
    }
  }

  loadMore(parentId: string | null): void {
    this.loadChildren(keyOf(parentId), { more: true }).catch(() => undefined);
  }

  // ------------------------------------------------------------ expansion

  private applySavedExpanded(): void {
    const { settings } = this.options;
    this.expandedAll = settings.expandedAll;
    this.autoDepth = !settings.expandedSaved;
    if (settings.expandedSaved) {
      this.expanded = new Set(settings.expanded);
    }
    this.lastPersisted = JSON.stringify([
      settings.expanded,
      settings.expandedAll,
    ]);
  }

  private persist(): void {
    this.autoDepth = false;
    if (this.searchMatches) {
      return;
    }
    const expanded = this.expandedAll
      ? []
      : serializeFileTreeExpanded(this.expanded);
    this.lastPersisted = JSON.stringify([expanded, this.expandedAll]);
    this.options.events.persist({ expanded, expandedAll: this.expandedAll });
  }

  expand(id: string, persist = true): void {
    if (!this.isFolder(id) || this.expanded.has(id)) {
      return;
    }
    this.expanded.add(id);
    if (persist) {
      this.persist();
    }
    if (
      this.mode === "server" &&
      !this.entries.has(id) &&
      !this.searchMatches
    ) {
      this.loadChildren(id).catch(() => undefined);
      return;
    }
    this.emit();
  }

  collapse(id: string): void {
    if (!this.expanded.delete(id)) {
      return;
    }
    this.expandedAll = false;
    const focused = this.focusedId;
    if (focused && fileTreeAncestors(focused, this.parentOf).includes(id)) {
      this.focusedId = id;
    }
    this.persist();
    this.emit();
  }

  toggle(id: string): void {
    if (this.expanded.has(id)) {
      this.collapse(id);
    } else {
      this.expand(id);
    }
  }

  private expandEveryKnownFolder(): number {
    const subtree = collectFileTreeSubtree(
      FILETREE_ROOT,
      (key) => this.entries.get(key)?.ids,
      this.isFolder,
      Number.POSITIVE_INFINITY
    );
    this.expanded = new Set(subtree.folders);
    return subtree.count;
  }

  /**
   * Open every folder, not only the loaded ones: the `subtree` scope when the
   * host applies it, otherwise folders are loaded level by level up to
   * `FILETREE_MAX_NODES` nodes, with a notice when the tree is larger.
   */
  async expandAll(options: { persist?: boolean } = {}): Promise<void> {
    this.expanding = true;
    this.notice = undefined;
    this.emit();
    let truncated = false;
    try {
      if (this.mode === "server" && !this.searchMatches) {
        truncated = await this.loadSubtree();
      }
    } catch (cause) {
      this.options.events.notify({ type: "error", message: errorText(cause) });
    }
    const count = this.expandEveryKnownFolder();
    this.expandedAll = !truncated;
    this.expanding = false;
    if (truncated) {
      this.notice = this.label("expandedFirst", { count });
    }
    if (options.persist !== false) {
      this.persist();
    }
    this.emit();
  }

  private async loadSubtree(): Promise<boolean> {
    const list = this.options.list;
    if (!list) {
      return false;
    }
    const generation = this.generation;
    const result = await list({
      ...this.baseParams(FILETREE_MAX_NODES),
      scope: { kind: "subtree", parentId: null },
    });
    if (generation !== this.generation) {
      return false;
    }
    const meta = metaOf(result);
    if (meta.scope !== "applied") {
      return await this.loadLevels(
        (this.entries.get(FILETREE_ROOT)?.ids ?? []).filter(this.isFolder),
        this.entries.get(FILETREE_ROOT)?.ids.length ?? 0,
        generation
      );
    }
    this.absorbSubtree(result.data.filter(isRecord), meta);
    return Boolean(meta.truncated) || result.data.length >= FILETREE_MAX_NODES;
  }

  private absorbSubtree(rows: Row[], meta: FileTreeListMeta): void {
    this.absorbMeta(meta);
    const grouped = new Map<string, string[]>();
    for (const row of rows) {
      const id = this.options.getRowId(row);
      const parent = parentIdOf(row, this.options.settings.parentColumn);
      this.nodes.set(id, row);
      this.parents.set(id, parent);
      const key = keyOf(parent);
      grouped.set(key, [...(grouped.get(key) ?? []), id]);
    }
    for (const [key, ids] of grouped) {
      const previous = this.entries.get(key);
      const merged = [...new Set([...(previous?.ids ?? []), ...ids])];
      const count =
        key === FILETREE_ROOT ? undefined : this.childCounts.get(key);
      this.entries.set(key, {
        ids: this.sortIds(merged),
        total: Math.max(count ?? merged.length, merged.length),
        loaded: true,
        page: Math.max(1, previous?.page ?? 1),
      });
    }
    for (const id of this.nodes.keys()) {
      if (this.isFolder(id) && !this.entries.has(id)) {
        this.entries.set(id, { ids: [], total: 0, loaded: true, page: 1 });
      }
    }
  }

  /** Breadth-first loading of folders, one level per round, until the cap. */
  private async loadLevels(
    level: string[],
    count: number,
    generation: number
  ): Promise<boolean> {
    if (!level.length || generation !== this.generation) {
      return false;
    }
    if (count >= FILETREE_MAX_NODES) {
      return true;
    }
    const pending = level.filter((id) => !this.entries.get(id)?.loaded);
    await Promise.all(pending.map((id) => this.loadChildren(id)));
    const children = level.flatMap((id) => this.entries.get(id)?.ids ?? []);
    const next = children.filter(this.isFolder);
    return await this.loadLevels(next, count + children.length, generation);
  }

  collapseAll(): void {
    this.expanded.clear();
    this.expandedAll = false;
    this.notice = undefined;
    const focused = this.focusedId;
    if (focused) {
      this.focusedId = fileTreeAncestors(focused, this.parentOf)[0] ?? focused;
    }
    this.persist();
    this.emit();
  }

  /** `*`: open every folder beside this row. */
  expandSiblings(id: string): void {
    const key = keyOf(this.parents.get(id) ?? null);
    for (const sibling of this.entries.get(key)?.ids ?? []) {
      if (this.isFolder(sibling)) {
        this.expand(sibling, false);
      }
    }
    this.persist();
    this.emit();
  }

  /** Open a linked folder: its ancestors open and the folder focused. */
  async openFolder(id: string): Promise<void> {
    const path = await this.resolvePath(id);
    if (!path) {
      return;
    }
    if (this.phone) {
      this.drill(id);
      return;
    }
    for (const ancestor of [...path, id]) {
      this.expanded.add(ancestor);
    }
    this.autoDepth = false;
    if (this.mode === "server") {
      await Promise.all(
        [...path, id]
          .filter((key) => !this.entries.has(key))
          .map((key) => this.loadChildren(key))
      );
    }
    this.focus(id);
  }

  private async resolvePath(id: string): Promise<string[] | undefined> {
    if (
      this.nodes.has(id) &&
      (this.mode === "client" || this.parents.has(id))
    ) {
      return fileTreeAncestors(id, this.parentOf);
    }
    const path = this.options.tree?.path;
    if (!path) {
      return;
    }
    try {
      const rows = (await path(id)).filter(isRecord);
      const ids = rows.map(this.options.getRowId).filter((item) => item !== id);
      let parent: string | null = null;
      for (const row of rows) {
        const rowId = this.options.getRowId(row);
        this.nodes.set(rowId, row);
        this.parents.set(rowId, parent);
        parent = rowId;
      }
      return ids;
    } catch (cause) {
      this.options.events.notify({ type: "error", message: errorText(cause) });
    }
  }

  // ------------------------------------------------------------ phone

  setPhone(phone: boolean): void {
    if (phone === this.phone) {
      return;
    }
    this.phone = phone;
    if (phone) {
      this.drillId = this.currentFolderForDrill();
      this.ensureChildren(this.drillId);
    }
    this.emit();
  }

  private currentFolderForDrill(): string | null {
    const focused = this.focusedId;
    if (!(focused && this.nodes.has(focused))) {
      return null;
    }
    return this.isFolder(focused)
      ? focused
      : (this.parents.get(focused) ?? null);
  }

  /** Phones: show this folder's content (null is the root). */
  drill(id: string | null): void {
    this.drillId = id;
    this.focusedId = undefined;
    this.ensureChildren(id);
    this.emit();
  }

  back(): void {
    const parent =
      this.drillId === null ? null : (this.parents.get(this.drillId) ?? null);
    this.drill(parent);
  }

  // ------------------------------------------------------------ focus and selection

  focus(id: string): void {
    this.focusedId = id;
    this.emit();
    this.options.events.focus(id);
  }

  /** Remember focus without moving DOM focus (the row got it from a click). */
  setFocused(id: string): void {
    if (this.focusedId !== id) {
      this.focusedId = id;
      this.emit();
    }
  }

  click(id: string, click: FileTreeClick = {}): void {
    if (this.phone) {
      // Phones open on tap; checkboxes select.
      this.setFocused(id);
      return;
    }
    const state = this.getState();
    const next = fileTreeSelectionAfterClick(
      state.rows,
      this.selection,
      this.anchorId,
      id,
      click,
      this.options.multiple !== false
    );
    this.selection = next.selection;
    this.anchorId = next.anchorId;
    this.focusedId = id;
    this.emit();
  }

  /** The row checkbox: toggle, or with Shift the range from the anchor. */
  toggleSelected(id: string, shiftKey = false): void {
    if (id === FILETREE_UNFILED) {
      return;
    }
    if (shiftKey && this.options.multiple !== false) {
      const range = fileTreeRange(this.getState().rows, this.anchorId, id);
      this.selection = new Set([
        ...this.selection,
        ...range.filter((item) => item !== FILETREE_UNFILED),
      ]);
    } else if (this.selection.has(id)) {
      this.selection.delete(id);
    } else {
      this.selection =
        this.options.multiple === false
          ? new Set([id])
          : new Set([...this.selection, id]);
    }
    this.anchorId = id;
    this.focusedId = id;
    this.emit();
  }

  setSelection(ids: Iterable<string>): void {
    this.selection = new Set([...ids].filter((id) => id !== FILETREE_UNFILED));
    this.emit();
  }

  selectAll(): void {
    const ids = this.getState()
      .rows.filter(isNodeRow)
      .map((row) => row.id);
    this.setSelection(this.options.multiple === false ? ids.slice(0, 1) : ids);
  }

  clearSelection(): void {
    this.selection.clear();
    this.emit();
  }

  /** Double click or Enter: folders open or close, files open. */
  activate(id: string): void {
    if (this.isFolder(id)) {
      if (this.phone) {
        this.drill(id);
        return;
      }
      this.toggle(id);
      return;
    }
    const row = this.nodes.get(id);
    if (row) {
      this.options.events.open(row);
    }
  }

  // ------------------------------------------------------------ keyboard

  /** Handle a key on the tree; true when the view should prevent its default. */
  keydown(event: FileTreeKey): boolean {
    if (this.renamingId || this.draftParent !== undefined) {
      return false;
    }
    const state = this.getState();
    const command = fileTreeKeyCommand(event, {
      rows: state.rows,
      focusedId: state.focusedId,
      typeahead: this.typeahead,
      now: Date.now(),
    });
    return this.run(command);
  }

  private run(command: FileTreeCommand): boolean {
    const handlers: Partial<Record<FileTreeCommand["type"], () => void>> = {
      focus: () =>
        this.runFocus(command as Extract<FileTreeCommand, { type: "focus" }>),
      expand: () => this.expand((command as { id: string }).id),
      collapse: () => this.collapse((command as { id: string }).id),
      toggle: () => this.toggle((command as { id: string }).id),
      open: () => this.activate((command as { id: string }).id),
      select: () => this.toggleSelected((command as { id: string }).id),
      "select-all": () => this.selectAll(),
      clear: () => this.escape(),
      rename: () => this.startRename((command as { id: string }).id),
      cut: () => this.cut(),
      paste: () => this.paste((command as { id: string }).id),
      delete: () => this.requestDelete(),
      undo: () => {
        this.undo().catch(() => undefined);
      },
      menu: () => this.options.events.menu((command as { id: string }).id),
      "expand-siblings": () =>
        this.expandSiblings((command as { id: string }).id),
      "expand-all": () => {
        this.expandAll().catch(() => undefined);
      },
      "collapse-all": () => this.collapseAll(),
      more: () =>
        this.loadMore((command as { parentId: string | null }).parentId),
      typeahead: () =>
        this.runTypeahead(
          command as Extract<FileTreeCommand, { type: "typeahead" }>
        ),
    };
    const handler = handlers[command.type];
    if (!handler) {
      return false;
    }
    handler();
    return true;
  }

  private runFocus(command: Extract<FileTreeCommand, { type: "focus" }>): void {
    if (command.extend && this.options.multiple !== false) {
      const anchor = this.anchorId ?? this.focusedId;
      const range = fileTreeRange(this.getState().rows, anchor, command.id);
      this.selection = new Set(range.filter((id) => id !== FILETREE_UNFILED));
      this.anchorId = anchor;
    }
    this.focus(command.id);
  }

  private runTypeahead(
    command: Extract<FileTreeCommand, { type: "typeahead" }>
  ): void {
    this.typeahead = { buffer: command.buffer, at: Date.now() };
    if (command.id) {
      this.focus(command.id);
    }
  }

  /** Escape: cancel a drag, then a cut, then clear the selection. */
  escape(): void {
    if (this.drag) {
      this.dragCancel();
      return;
    }
    if (this.cutIds.length) {
      this.cutIds = [];
      this.emit();
      return;
    }
    this.clearSelection();
  }

  requestDelete(id?: string): void {
    const ids = this.actionIds(id);
    if (this.canDelete(ids)) {
      this.options.events.requestDelete(ids);
    }
  }

  // ------------------------------------------------------------ cut and paste

  cut(id?: string): void {
    const ids = this.actionIds(id);
    if (!this.canMoveIds(ids)) {
      return;
    }
    this.cutIds = ids;
    this.announce(this.label("cutReady", { count: ids.length }));
    this.options.events.notify({
      type: "info",
      message: this.label("cutReady", { count: ids.length }),
    });
    this.emit();
  }

  paste(targetId: string): void {
    if (!this.cutIds.length) {
      return;
    }
    const parentId =
      targetId === FILETREE_ROOT_TARGET
        ? null
        : fileTreeDropParent(targetId, this.moveContext());
    const ids = this.cutIds;
    this.cutIds = [];
    this.move(ids, parentId).catch(() => undefined);
  }

  // ------------------------------------------------------------ drag and drop

  dragStart(id: string): void {
    if (!this.nodes.has(id) || this.phone) {
      return;
    }
    if (!this.selection.has(id)) {
      this.selection = new Set([id]);
      this.anchorId = id;
    }
    const ids = [...this.selection];
    if (!this.canMoveIds(ids)) {
      return;
    }
    this.drag = { ids, valid: false };
    this.emit();
  }

  get dragging(): boolean {
    return this.drag !== undefined;
  }

  /** The pointer is over this row (or the root header, or nothing). */
  dragOver(overId: string | undefined): void {
    const drag = this.drag;
    if (!drag || drag.overId === overId) {
      return;
    }
    this.clearHoverTimer();
    const target =
      overId === FILETREE_ROOT_TARGET ||
      overId === FILETREE_UNFILED ||
      (overId !== undefined && this.nodes.has(overId));
    if (!target) {
      this.drag = { ids: drag.ids, valid: false };
      this.emit();
      return;
    }
    const parentId =
      overId === FILETREE_ROOT_TARGET
        ? null
        : fileTreeDropParent(overId, this.moveContext());
    const check = this.checkMove(drag.ids, parentId);
    this.drag = {
      ids: drag.ids,
      overId,
      parentId,
      valid: check.ok,
      message: check.ok
        ? this.moveMessage(check.ids, parentId)
        : this.label(moveReasonLabel(check.reason)),
    };
    const expandable =
      overId !== FILETREE_ROOT_TARGET &&
      this.isFolder(overId) &&
      !this.expanded.has(overId);
    if (expandable) {
      this.hoverTimer = setTimeout(() => {
        if (this.drag?.overId === overId) {
          this.expand(overId);
        }
      }, FILETREE_HOVER_EXPAND_MS);
    }
    this.emit();
  }

  private moveMessage(ids: string[], parentId: string | null): string {
    const path = this.pathText(parentId);
    return ids.length === 1
      ? this.label("moveItem", { name: this.name(ids[0] ?? ""), path })
      : this.label("moveItems", { count: ids.length, path });
  }

  dragEnd(): void {
    const drag = this.drag;
    this.clearHoverTimer();
    this.drag = undefined;
    if (drag?.valid && drag.parentId !== undefined) {
      this.move(drag.ids, drag.parentId).catch(() => undefined);
      return;
    }
    this.emit();
  }

  dragCancel(): void {
    this.clearHoverTimer();
    this.drag = undefined;
    this.emit();
  }

  private clearHoverTimer(): void {
    if (this.hoverTimer) {
      clearTimeout(this.hoverTimer);
      this.hoverTimer = undefined;
    }
  }

  // ------------------------------------------------------------ moves

  /**
   * Move nodes into a folder (null is the root): shown at once, sent with
   * `actions.tree.move` or `update` of the parent column, rolled back on
   * failure, and undoable from the notification or Ctrl/Cmd+Z.
   */
  async move(
    ids: readonly string[],
    parentId: string | null,
    options: { undoable?: boolean } = {}
  ): Promise<boolean> {
    const check = this.checkMove(ids, parentId);
    if (!check.ok) {
      this.options.events.notify({
        type: check.reason === "unchanged" ? "info" : "error",
        message: this.label(moveReasonLabel(check.reason)),
      });
      return false;
    }
    const origins = new Map(
      check.ids.map((id) => [id, this.parents.get(id) ?? null])
    );
    const snapshot = this.snapshotStructure();
    this.applyMove(check.ids, parentId);
    this.busy = true;
    this.emit();
    const { moved, failed } = await this.sendMove(check.ids, parentId);
    this.busy = false;
    if (failed.length) {
      this.restoreStructure(snapshot);
      this.applyMove(moved, parentId);
    }
    this.reportMove(
      moved,
      failed,
      parentId,
      origins,
      options.undoable !== false
    );
    await this.afterMove(moved, parentId, origins);
    return failed.length === 0;
  }

  private async sendMove(
    ids: string[],
    parentId: string | null
  ): Promise<{ moved: string[]; failed: { id: string; error?: string }[] }> {
    const { tree, patchRow, settings } = this.options;
    try {
      if (tree?.move) {
        const result: FileTreeMoveResult =
          (await tree.move({ ids, parentId })) ?? {};
        const failed = result.failed ?? [];
        const failedIds = new Set(failed.map((item) => item.id));
        return {
          moved: result.moved ?? ids.filter((id) => !failedIds.has(id)),
          failed,
        };
      }
      if (!patchRow) {
        return { moved: [], failed: ids.map((id) => ({ id })) };
      }
      const outcomes = await Promise.all(
        ids.map(async (id) => {
          const row = this.nodes.get(id) ?? { id };
          return {
            id,
            result: await patchRow(row, { [settings.parentColumn]: parentId }),
          };
        })
      );
      return {
        moved: outcomes
          .filter((item) => item.result.success)
          .map((item) => item.id),
        failed: outcomes
          .filter((item) => !item.result.success)
          .map((item) => ({ id: item.id, error: item.result.error })),
      };
    } catch (cause) {
      return {
        moved: [],
        failed: ids.map((id) => ({ id, error: errorText(cause) })),
      };
    }
  }

  private reportMove(
    moved: string[],
    failed: { id: string; error?: string }[],
    parentId: string | null,
    origins: Map<string, string | null>,
    undoable: boolean
  ): void {
    const path = this.pathText(parentId);
    if (moved.length) {
      const message =
        moved.length === 1
          ? this.label("movedOne", { name: this.name(moved[0] ?? ""), path })
          : this.label("moved", { count: moved.length, path });
      const undo = undoable ? this.undoFor(moved, origins) : undefined;
      if (undo) {
        this.undoStack.push(undo);
        this.undoStack.splice(0, Math.max(0, this.undoStack.length - MAX_UNDO));
      }
      this.announce(message);
      this.options.events.notify({
        type: "success",
        message,
        undo: undo ? () => this.runUndo(undo) : undefined,
        undoLabel: this.label("undo"),
      });
    }
    if (failed.length) {
      const reason = failed.find((item) => item.error)?.error;
      this.options.events.notify({
        type: "error",
        message: reason ?? this.label("moveFailed", { count: failed.length }),
      });
    }
  }

  private undoFor(
    moved: string[],
    origins: Map<string, string | null>
  ): () => Promise<void> {
    const groups = fileTreeUndoGroups(moved, (id) => origins.get(id));
    return async () => {
      await groups.reduce<Promise<unknown>>(
        (previous, group) =>
          previous.then(() =>
            this.move(group.ids, group.parentId, { undoable: false })
          ),
        Promise.resolve()
      );
      this.options.events.notify({
        type: "info",
        message: this.label("undone"),
      });
    };
  }

  private runUndo(undo: () => Promise<void>): void {
    const index = this.undoStack.lastIndexOf(undo);
    if (index >= 0) {
      this.undoStack.splice(index, 1);
    }
    undo().catch(() => undefined);
  }

  /** Revert the last move (Ctrl/Cmd+Z). */
  async undo(): Promise<void> {
    const undo = this.undoStack.pop();
    if (undo) {
      await undo();
    }
  }

  private async afterMove(
    moved: string[],
    parentId: string | null,
    origins: Map<string, string | null>
  ): Promise<void> {
    if (!moved.length) {
      this.emit();
      return;
    }
    // Show where the items went: the folder and its ancestors open.
    if (parentId !== null && !this.phone) {
      for (const id of [
        ...fileTreeAncestors(parentId, this.parentOf),
        parentId,
      ]) {
        this.expanded.add(id);
      }
      this.persist();
    }
    this.focusedId = moved[0];
    const keys = new Set([
      keyOf(parentId),
      ...[...origins.values()].map(keyOf),
    ]);
    if (this.mode === "server") {
      await Promise.all(
        [...keys]
          .filter((key) => this.entries.has(key))
          .map((key) => this.loadChildren(key, { replace: true }))
      );
      this.ensureExpandedLoaded();
    }
    this.emit();
    if (moved[0]) {
      this.options.events.focus(moved[0]);
    }
    await this.options.events.refresh?.();
  }

  private snapshotStructure() {
    return {
      entries: new Map(
        [...this.entries].map(([key, entry]) => [
          key,
          { ...entry, ids: [...entry.ids] },
        ])
      ),
      parents: new Map(this.parents),
      nodes: new Map(this.nodes),
      childCounts: new Map(this.childCounts),
    };
  }

  private restoreStructure(
    snapshot: ReturnType<FileTreeController["snapshotStructure"]>
  ): void {
    for (const [target, source] of [
      [this.entries, snapshot.entries],
      [this.parents, snapshot.parents],
      [this.nodes, snapshot.nodes],
      [this.childCounts, snapshot.childCounts],
    ] as [Map<string, unknown>, Map<string, unknown>][]) {
      target.clear();
      for (const [key, value] of source) {
        target.set(key, value);
      }
    }
  }

  private applyMove(ids: readonly string[], parentId: string | null): void {
    const { parentColumn } = this.options.settings;
    const targetKey = keyOf(parentId);
    for (const id of ids) {
      const from = keyOf(this.parents.get(id) ?? null);
      this.detach(id, from);
      this.parents.set(id, parentId);
      const row = this.nodes.get(id);
      if (row) {
        this.nodes.set(id, { ...row, [parentColumn]: parentId });
      }
      const target = this.entries.get(targetKey);
      if (target?.loaded) {
        target.ids = this.sortIds([
          ...target.ids.filter((item) => item !== id),
          id,
        ]);
        target.total = (target.total ?? target.ids.length - 1) + 1;
      }
      if (parentId !== null) {
        this.childCounts.set(
          parentId,
          target?.loaded
            ? (target.total ?? target.ids.length)
            : (this.childCounts.get(parentId) ?? 0) + 1
        );
        this.clientFolders?.add(parentId);
      }
    }
  }

  private detach(id: string, from: string): void {
    const source = this.entries.get(from);
    if (source) {
      source.ids = source.ids.filter((item) => item !== id);
      source.total =
        source.total === undefined ? undefined : Math.max(0, source.total - 1);
    }
    const parent = parentOfKey(from);
    if (parent !== null && this.childCounts.has(parent)) {
      this.childCounts.set(
        parent,
        Math.max(0, (this.childCounts.get(parent) ?? 1) - 1)
      );
    }
    if (from === FILETREE_UNFILED && source && !source.ids.length) {
      const root = this.entries.get(FILETREE_ROOT);
      if (root) {
        root.ids = root.ids.filter((item) => item !== FILETREE_UNFILED);
      }
    }
  }

  // ------------------------------------------------------------ rename

  startRename(id: string): void {
    if (!this.canRename(id)) {
      return;
    }
    this.renamingId = id;
    this.renameError = undefined;
    this.emit();
  }

  cancelRename(): void {
    const id = this.renamingId;
    this.renamingId = undefined;
    this.renameError = undefined;
    this.emit();
    if (id) {
      this.options.events.focus(id);
    }
  }

  /** Save the name; a server error (a name clash) stays on the row. */
  async commitRename(value: string): Promise<void> {
    const id = this.renamingId;
    const row = id ? this.nodes.get(id) : undefined;
    const name = value.trim();
    const unchanged = !name || (id !== undefined && name === this.name(id));
    if (!(id && row && this.options.patchRow) || unchanged) {
      this.cancelRename();
      return;
    }
    const { nameColumn } = this.options.settings;
    this.busy = true;
    this.emit();
    let result: FileTreeMutationResult;
    try {
      result = await this.options.patchRow(row, { [nameColumn]: name });
    } catch (cause) {
      result = { success: false, error: errorText(cause) };
    }
    this.busy = false;
    if (!result.success) {
      this.renameError = result.error ?? this.label("moveFailed", { count: 1 });
      this.emit();
      return;
    }
    this.nodes.set(id, { ...row, [nameColumn]: name });
    const key = keyOf(this.parents.get(id) ?? null);
    const entry = this.entries.get(key);
    if (entry) {
      entry.ids = this.sortIds(entry.ids);
    }
    this.renamingId = undefined;
    this.renameError = undefined;
    this.announce(this.label("renamed", { name }));
    this.emit();
    this.options.events.focus(id);
    await this.options.events.refresh?.();
  }

  // ------------------------------------------------------------ new folder

  /** The folder a new folder goes into: the one in the breadcrumbs. */
  newFolderParent(): string | null {
    const folder = this.currentFolder();
    return folder === FILETREE_UNFILED ? null : folder;
  }

  startCreateFolder(parentId: string | null = this.newFolderParent()): void {
    if (!this.canCreateFolderIn(parentId)) {
      return;
    }
    if (parentId !== null && !this.phone) {
      this.expand(parentId);
    }
    this.draftParent = parentId;
    this.emit();
  }

  cancelCreateFolder(): void {
    this.draftParent = undefined;
    this.emit();
  }

  /** Create through `actions.tree.createFolder`, or `create` with the kind column set to "folder". */
  async commitCreateFolder(value: string): Promise<void> {
    const parentId = this.draftParent;
    if (parentId === undefined) {
      return;
    }
    const name = newFolderName(
      value,
      this.options.locale,
      this.options.translate
    );
    this.draftParent = undefined;
    this.busy = true;
    this.emit();
    try {
      const id = await this.sendCreateFolder(parentId, name);
      this.announce(this.label("created", { name }));
      this.options.events.notify({
        type: "success",
        message: this.label("created", { name }),
      });
      await this.reloadFolder(parentId);
      const created = id ?? this.findChild(parentId, name);
      if (created) {
        this.focus(created);
      }
      await this.options.events.refresh?.();
    } catch (cause) {
      this.options.events.notify({ type: "error", message: errorText(cause) });
    } finally {
      this.busy = false;
      this.emit();
    }
  }

  private findChild(parentId: string | null, name: string): string | undefined {
    return this.entries
      .get(keyOf(parentId))
      ?.ids.find((id) => this.isFolder(id) && this.name(id) === name);
  }

  private async sendCreateFolder(
    parentId: string | null,
    name: string
  ): Promise<string | undefined> {
    const { id, row } = await createFolderRecord({
      tree: this.options.tree,
      createRecord: this.options.createRecord,
      settings: this.options.settings,
      parentId,
      name,
      getRowId: this.options.getRowId,
      failure: this.label("moveFailed", { count: 1 }),
    });
    if (id && row) {
      this.nodes.set(id, row);
      this.parents.set(id, parentId);
      this.clientFolders?.add(id);
    }
    return id;
  }

  private async reloadFolder(parentId: string | null): Promise<void> {
    if (this.mode === "server") {
      await this.loadChildren(keyOf(parentId), { replace: true });
      return;
    }
    await this.reload(false);
  }

  // ------------------------------------------------------------ delete

  /** Delete through the table's delete action; the host decides what happens to a folder's content. */
  async remove(ids: readonly string[]): Promise<void> {
    const deleteRow = this.options.deleteRow;
    if (!deleteRow) {
      return;
    }
    this.busy = true;
    this.emit();
    const outcomes = await Promise.all(
      ids.map(async (id) => {
        const row = this.nodes.get(id);
        try {
          return {
            id,
            result: row ? await deleteRow(row) : { success: false },
          };
        } catch (cause) {
          return { id, result: { success: false, error: errorText(cause) } };
        }
      })
    );
    this.busy = false;
    const deleted = outcomes
      .filter((item) => item.result.success)
      .map((item) => item.id);
    const failed = outcomes.filter((item) => !item.result.success);
    for (const id of deleted) {
      this.detach(id, keyOf(this.parents.get(id) ?? null));
      this.selection.delete(id);
    }
    if (deleted.length) {
      this.options.events.notify({
        type: "success",
        message: this.label("deleted", { count: deleted.length }),
      });
    }
    const reason = failed.find((item) => item.result.error)?.result.error;
    if (failed.length) {
      this.options.events.notify({
        type: "error",
        message: reason ?? this.label("moveFailed", { count: failed.length }),
      });
    }
    this.emit();
    await this.options.events.refresh?.();
  }

  // ------------------------------------------------------------ desktop files

  /** Files dropped from the desktop onto a folder, handed to the host's `onDropFiles`. */
  async dropFiles(targetId: string | null, files: File[]): Promise<void> {
    const upload = this.options.hooks.onDropFiles;
    if (!(upload && files.length)) {
      return;
    }
    const parentId =
      targetId === null || targetId === FILETREE_ROOT_TARGET
        ? null
        : fileTreeDropParent(targetId, this.moveContext());
    const key = keyOf(parentId);
    this.uploads.set(key, (this.uploads.get(key) ?? 0) + files.length);
    this.emit();
    try {
      await upload({ parentId, files });
    } catch (cause) {
      this.options.events.notify({ type: "error", message: errorText(cause) });
    } finally {
      const left = (this.uploads.get(key) ?? files.length) - files.length;
      if (left > 0) {
        this.uploads.set(key, left);
      } else {
        this.uploads.delete(key);
      }
    }
    await this.reloadFolder(parentId);
    await this.options.events.refresh?.();
  }
}
