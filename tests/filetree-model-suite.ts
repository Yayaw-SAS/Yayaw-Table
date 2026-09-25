import assert from "node:assert/strict";
import {
  type AssetRequest,
  assetColumns,
  assetTableOptions,
  createAssetActions,
} from "../examples/assets";
import type * as Controller from "../src/components/ui/yayaw-table/utils/filetree-controller";
import type * as Model from "../src/components/ui/yayaw-table/utils/filetree-model";

type Row = Record<string, unknown>;
type ModelApi = Pick<
  typeof Model,
  | "FILETREE_ROOT"
  | "FILETREE_ROOT_TARGET"
  | "FILETREE_UNFILED"
  | "buildFileTreeIndex"
  | "collectFileTreeSubtree"
  | "compareFileTreeRows"
  | "defaultExpandedIds"
  | "detectParentColumn"
  | "fileTreeAncestorRows"
  | "fileTreeAutoScroll"
  | "fileTreeDropMark"
  | "fileTreeDropParent"
  | "fileTreeGridColumns"
  | "fileTreeIcon"
  | "fileTreeKeyCommand"
  | "fileTreeLabel"
  | "fileTreeRange"
  | "fileTreeScrollTo"
  | "fileTreeSelectionAfterClick"
  | "fileTreeSettingFields"
  | "fileTreeSummary"
  | "fileTreeUndoGroups"
  | "fileTreeWindow"
  | "flattenFileTree"
  | "formatFileSize"
  | "formatFileTreeValue"
  | "formatRelativeDate"
  | "hasFileTreeQuery"
  | "highlightFileTreeName"
  | "isFileTreeAvailable"
  | "normalizeFileTreeViewConfig"
  | "parseFileTreeExpanded"
  | "resolveFileTreeSettings"
  | "serializeFileTreeExpanded"
  | "validateFileTreeMove"
>;
/** Public members only, so each edition's own class copy fits. */
type ControllerInstance = InstanceType<typeof Controller.FileTreeController>;
type FileTree = Pick<ControllerInstance, keyof ControllerInstance>;
interface ControllerApi {
  FileTreeController: new (
    options: Controller.FileTreeControllerOptions
  ) => FileTree;
}
type Test = (name: string, run: () => void | Promise<void>) => void;
type Notification = Controller.FileTreeNotification;

const COLUMNS = assetColumns;
const FOLDER = (id: string, parentId: string | null, name = id): Row => ({
  id,
  name,
  parentId,
  kind: "folder",
});
const FILE = (id: string, parentId: string | null, name = id): Row => ({
  id,
  name,
  parentId,
  kind: "file",
});
const SETTINGS = {
  parentColumn: "parentId",
  kindColumn: "kind",
  nameColumn: "name",
  foldersFirst: true,
};

const flush = async (times = 12) => {
  for (let index = 0; index < times; index += 1) {
    // Controller work chains several promises; let every one settle.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

/** Visible node names, indented by level. */
const outline = (tree: FileTree) =>
  tree
    .getState()
    .rows.filter((row) => row.type === "node")
    .map((row) => `${"  ".repeat(row.level - 1)}${row.name}`);

interface SetupOptions {
  scopes?: boolean;
  tree?: boolean;
  settings?: Row;
  view?: Row;
  params?: Row;
  hooks?: Model.FileTreeHooks;
  multiple?: boolean;
}

function setup(api: ModelApi & ControllerApi, options: SetupOptions = {}) {
  const requests: AssetRequest[] = [];
  const host = createAssetActions({
    scopes: options.scopes,
    log: (request) => requests.push(request),
  });
  const notes: Notification[] = [];
  const persisted: { expanded: string[]; expandedAll: boolean }[] = [];
  const opened: Row[] = [];
  const deletes: string[][] = [];
  const settings = api.resolveFileTreeSettings(
    COLUMNS,
    { ...assetTableOptions.filetree, ...options.settings },
    options.view
  );
  const tree = new api.FileTreeController({
    list: host.list as Controller.FileTreeListAction,
    rows: [],
    params: options.params ?? {},
    settings,
    hooks: options.hooks ?? {},
    getRowId: (row) => String(row.id),
    tree: options.tree === false ? undefined : host.tree,
    patchRow: (row, patch) => host.update(String(row.id), patch),
    createRecord: (values) => host.create(values),
    deleteRow: (row) => host.delete(String(row.id)),
    canCreate: true,
    multiple: options.multiple,
    locale: "en",
    events: {
      open: (row) => opened.push(row),
      notify: (note) => notes.push(note),
      focus: () => undefined,
      persist: (state) => persisted.push(state),
      folder: () => undefined,
      requestDelete: (ids) => deletes.push(ids),
      menu: () => undefined,
    },
  });
  return { deletes, host, notes, opened, persisted, requests, tree };
}

function modelSettingsSuite(test: Test, api: ModelApi) {
  test("normalizes view settings and drops host callbacks", () => {
    assert.deepEqual(
      api.normalizeFileTreeViewConfig({
        parentColumn: " parentId ",
        isFolder: () => true,
        showDetails: true,
        defaultExpandedDepth: 7,
        expanded: ["a", "a", 3, null, ""],
        sort: { id: "size", desc: true, extra: 1 },
        columns: ["size"],
        unknown: "x",
      }),
      {
        parentColumn: "parentId",
        showDetails: true,
        columns: ["size"],
        expanded: ["a", "3"],
        sort: { id: "size", desc: true },
        defaultExpandedDepth: 2,
      }
    );
    assert.equal(
      api.normalizeFileTreeViewConfig({ onDropFiles: () => 1 }),
      undefined
    );
    assert.equal(api.normalizeFileTreeViewConfig([]), undefined);
    assert.equal(
      api.normalizeFileTreeViewConfig({ defaultExpandedDepth: -3 })
        ?.defaultExpandedDepth,
      0
    );
  });

  test("resolves settings: detection, defaults, view over table", () => {
    const detected = api.resolveFileTreeSettings([
      { id: "title", type: "text" },
      { id: "folder_id", type: "text" },
    ]);
    assert.equal(detected.parentColumn, "folder_id");
    assert.equal(detected.nameColumn, "title");
    assert.equal(detected.showDetails, false);
    assert.equal(detected.foldersFirst, true);
    assert.equal(detected.defaultExpandedDepth, 1);
    assert.equal(detected.expandedSaved, false);
    const resolved = api.resolveFileTreeSettings(
      COLUMNS,
      assetTableOptions.filetree,
      { showDetails: true, columns: ["size"], expanded: [] }
    );
    assert.deepEqual(resolved.columns, ["size"]);
    assert.equal(resolved.showDetails, true);
    assert.equal(resolved.expandedSaved, true);
    assert.deepEqual(
      api.resolveFileTreeSettings(COLUMNS, assetTableOptions.filetree).columns,
      ["size", "updatedAt"]
    );
  });

  test("offers the mode only with a parent column, never when turned off", () => {
    assert.equal(api.isFileTreeAvailable(undefined, COLUMNS), true);
    assert.equal(api.isFileTreeAvailable(false, COLUMNS), false);
    assert.equal(api.isFileTreeAvailable(undefined, [{ id: "name" }]), false);
    assert.equal(
      api.isFileTreeAvailable({ parentColumn: "owner" }, [{ id: "name" }]),
      true
    );
    assert.equal(api.detectParentColumn([{ id: "parentId" }]), "parentId");
  });

  test("builds the settings panel with column presets", () => {
    const updates: unknown[] = [];
    const fields = api.fileTreeSettingFields({
      columns: COLUMNS,
      defaults: assetTableOptions.filetree,
      view: {},
      locale: "en",
      update: (next) => updates.push(next),
    });
    assert.deepEqual(
      fields.map((field) => field.id),
      [
        "parentColumn",
        "nameColumn",
        "kindColumn",
        "sizeColumn",
        "updatedColumn",
        "columns",
        "showDetails",
        "foldersFirst",
        "defaultExpandedDepth",
      ]
    );
    const columns = fields.find((field) => field.id === "columns");
    assert.equal(columns?.value, "both");
    columns?.onChange("size");
    fields.find((field) => field.id === "showDetails")?.onChange("on");
    fields.find((field) => field.id === "kindColumn")?.onChange("");
    assert.deepEqual(updates, [
      { columns: ["size"] },
      { showDetails: true },
      {},
    ]);
  });
}

function modelTreeSuite(test: Test, api: ModelApi) {
  const compare = {
    nameColumn: "name",
    foldersFirst: true,
    locale: "en",
    isFolder: (row: Row) => row.kind === "folder",
  };
  test("sorts folders first, then names naturally and locale-aware", () => {
    const rows = [
      FILE("f10", null, "file10.txt"),
      FILE("f2", null, "file2.txt"),
      FOLDER("zeta", null, "Zeta"),
      FILE("eclair", null, "éclair.png"),
      FOLDER("alpha", null, "alpha"),
    ];
    const names = [...rows]
      .sort((left, right) => api.compareFileTreeRows(left, right, compare))
      .map((row) => row.name);
    assert.deepEqual(names, [
      "alpha",
      "Zeta",
      "éclair.png",
      "file2.txt",
      "file10.txt",
    ]);
    const desc = [...rows]
      .sort((left, right) =>
        api.compareFileTreeRows(left, right, {
          ...compare,
          sort: { id: "name", desc: true },
        })
      )
      .map((row) => row.name);
    assert.deepEqual(desc, [
      "Zeta",
      "alpha",
      "file10.txt",
      "file2.txt",
      "éclair.png",
    ]);
    const mixed = [...rows]
      .sort((left, right) =>
        api.compareFileTreeRows(left, right, {
          ...compare,
          foldersFirst: false,
        })
      )
      .map((row) => row.name);
    assert.equal(mixed[0], "alpha");
    assert.equal(mixed.at(-1), "Zeta");
  });

  test("puts unknown parents and cycles under Unfiled, never losing a node", () => {
    const index = api.buildFileTreeIndex(
      [
        FOLDER("root", null, "Root"),
        FILE("orphan", "missing", "Orphan"),
        FOLDER("a", "b", "A"),
        FOLDER("b", "a", "B"),
        FILE("inside", "a", "Inside"),
        FOLDER("self", "self", "Self"),
        FILE("kept", "root", "Kept"),
      ],
      { settings: SETTINGS }
    );
    assert.deepEqual(index.children.get(api.FILETREE_ROOT), [
      "root",
      api.FILETREE_UNFILED,
    ]);
    assert.equal(index.parentOf.get("orphan"), api.FILETREE_UNFILED);
    assert.equal(index.parentOf.get("self"), api.FILETREE_UNFILED);
    assert.equal(index.parentOf.get("inside"), "a");
    assert.equal(index.parentOf.get("kept"), "root");
    const unfiled = index.children.get(api.FILETREE_UNFILED) ?? [];
    assert.ok(unfiled.includes("orphan") && unfiled.includes("self"));
    // One node of the a↔b cycle is the entry; the other stays below it.
    assert.equal(unfiled.filter((id) => id === "a" || id === "b").length, 1);
    assert.equal(index.rows.size, 7);
  });

  test("folders come from the kind column, the host hook or children", () => {
    const index = api.buildFileTreeIndex(
      [
        { id: "p", name: "P", parentId: null },
        { id: "c", name: "C", parentId: "p" },
        { id: "h", name: "H", parentId: null },
        { id: "k", name: "K", parentId: null, kind: "file" },
      ],
      {
        settings: SETTINGS,
        hooks: { isFolder: (row) => row.id === "h" },
      }
    );
    assert.deepEqual([...index.folders].sort(), ["h", "p"]);
  });

  test("flattens open folders with levels and ARIA positions", () => {
    const index = api.buildFileTreeIndex(
      [
        FOLDER("docs", null, "Docs"),
        FILE("a", "docs", "a.txt"),
        FILE("b", "docs", "b.txt"),
        FOLDER("empty", null, "Empty"),
        FILE("readme", null, "README"),
      ],
      { settings: SETTINGS }
    );
    const input = {
      children: (key: string) => {
        const ids = index.children.get(key);
        return ids ? { ids, loaded: true } : undefined;
      },
      isFolder: (id: string) => index.folders.has(id),
      name: (id: string) => String(index.rows.get(id)?.name),
      expanded: new Set(["docs"]),
    };
    const rows = api.flattenFileTree(input);
    assert.deepEqual(
      rows.map((row) =>
        row.type === "node"
          ? [row.name, row.level, row.posinset, row.setsize]
          : row.type
      ),
      [
        ["Docs", 1, 1, 3],
        ["a.txt", 2, 1, 2],
        ["b.txt", 2, 2, 2],
        ["Empty", 1, 2, 3],
        ["README", 1, 3, 3],
      ]
    );
    const withEmpty = api.flattenFileTree({
      ...input,
      expanded: new Set(["empty"]),
    });
    assert.ok(
      withEmpty.some((row) => row.type === "empty" && row.parentId === "empty")
    );
    const draft = api.flattenFileTree({
      ...input,
      expanded: new Set(),
      draftParent: null,
    });
    assert.equal(draft[0]?.type, "draft");
    const phone = api.flattenFileTree({
      ...input,
      expanded: new Set(),
      rootKey: "docs",
    });
    assert.deepEqual(
      phone.map((row) => row.type === "node" && row.level),
      [1, 1]
    );
  });

  test("counts server totals in the set size and shows a Show more row", () => {
    const rows = api.flattenFileTree({
      children: (key) =>
        key === api.FILETREE_ROOT
          ? { ids: ["a", "b"], total: 250, loaded: true }
          : { ids: [], loaded: false, loading: true },
      isFolder: (id) => id === "a",
      name: (id) => id,
      expanded: new Set(["a"]),
      childCount: () => undefined,
    });
    assert.deepEqual(
      rows.map((row) => row.type),
      ["node", "loading", "node", "more"]
    );
    const first = rows[0];
    assert.equal(first?.type === "node" && first.setsize, 250);
    const more = rows.at(-1);
    assert.equal(more?.type === "more" && more.remaining, 248);
  });

  test("expand all walks breadth first and stops at the cap", () => {
    const children: Record<string, string[]> = {
      "": ["a", "b", "f1"],
      a: ["a1", "a2"],
      b: ["b1"],
      a1: ["deep"],
    };
    const folders = new Set(["a", "b", "a1"]);
    const all = api.collectFileTreeSubtree(
      "",
      (key) => children[key],
      (id) => folders.has(id)
    );
    assert.deepEqual(all, {
      folders: ["a", "b", "a1"],
      count: 7,
      truncated: false,
    });
    const capped = api.collectFileTreeSubtree(
      "",
      (key) => children[key],
      (id) => folders.has(id),
      4
    );
    assert.deepEqual(capped, {
      folders: ["a", "b", "a1"],
      count: 4,
      truncated: true,
    });
    assert.deepEqual(
      api.defaultExpandedIds(
        (key) => children[key],
        (id) => folders.has(id),
        0
      ),
      []
    );
    assert.deepEqual(
      api.defaultExpandedIds(
        (key) => children[key],
        (id) => folders.has(id),
        2
      ),
      ["a", "b", "a1"]
    );
  });

  test("serializes the open folders for saved views", () => {
    assert.deepEqual(
      api.serializeFileTreeExpanded(
        ["a", "b", "a", api.FILETREE_UNFILED, ""],
        2
      ),
      ["a", "b"]
    );
    assert.deepEqual(
      [...api.parseFileTreeExpanded(["x", 2, null])],
      ["x", "2"]
    );
    assert.equal(api.parseFileTreeExpanded("nope").size, 0);
  });
}

function modelMoveSuite(test: Test, api: ModelApi) {
  const parents: Record<string, string | null> = {
    brand: null,
    logos: "brand",
    logo: "logos",
    photos: null,
    team: "photos",
  };
  const folders = new Set(["brand", "logos", "photos"]);
  const context = {
    parentOf: (id: string) => parents[id],
    isFolder: (id: string) => folders.has(id) || id === api.FILETREE_UNFILED,
    row: (id: string) => (id in parents ? { id } : undefined),
  };
  test("refuses moves into itself, a descendant, a file or Unfiled", () => {
    const check = (ids: string[], parent: string | null, extra = {}) =>
      api.validateFileTreeMove(ids, parent, { ...context, ...extra });
    assert.deepEqual(check(["brand"], "brand"), { ok: false, reason: "self" });
    assert.deepEqual(check(["brand"], "logos"), {
      ok: false,
      reason: "descendant",
    });
    assert.deepEqual(check(["team"], "logo"), {
      ok: false,
      reason: "not-folder",
    });
    assert.deepEqual(check(["team"], api.FILETREE_UNFILED), {
      ok: false,
      reason: "virtual",
    });
    assert.deepEqual(check(["team"], "photos"), {
      ok: false,
      reason: "unchanged",
    });
    assert.deepEqual(
      check(["team"], "brand", {
        canMove: (_row: Row, target: Row | null) => target?.id !== "brand",
      }),
      { ok: false, reason: "permission" }
    );
    assert.deepEqual(check(["team", "logo"], "logos"), {
      ok: true,
      parentId: "logos",
      ids: ["team"],
    });
    assert.deepEqual(check(["logos"], null), {
      ok: true,
      parentId: null,
      ids: ["logos"],
    });
  });

  test("a drop onto a file lands in its folder; undo groups by origin", () => {
    assert.equal(api.fileTreeDropParent("logo", context), "logos");
    assert.equal(api.fileTreeDropParent("brand", context), "brand");
    assert.equal(api.fileTreeDropParent(null, context), null);
    assert.deepEqual(
      api.fileTreeUndoGroups(["logo", "team", "brand"], context.parentOf),
      [
        { parentId: "logos", ids: ["logo"] },
        { parentId: "photos", ids: ["team"] },
        { parentId: null, ids: ["brand"] },
      ]
    );
    const drag = { overId: "logo", parentId: "logos", valid: true };
    assert.equal(api.fileTreeDropMark("logos", drag), "valid");
    assert.equal(api.fileTreeDropMark("logo", drag), undefined);
    assert.equal(
      api.fileTreeDropMark("logo", { overId: "logo", valid: false }),
      "invalid"
    );
    assert.equal(
      api.fileTreeDropMark(api.FILETREE_ROOT_TARGET, {
        overId: api.FILETREE_ROOT_TARGET,
        parentId: null,
        valid: true,
      }),
      "valid"
    );
  });
}

function keyboardRows(api: ModelApi) {
  return api.flattenFileTree({
    children: (key) =>
      ({
        "": { ids: ["docs", "notes", "readme"], loaded: true },
        docs: { ids: ["a", "b"], loaded: true },
        notes: { ids: [], loaded: false },
      })[key] as Model.FileTreeChildren | undefined,
    isFolder: (id) => id === "docs" || id === "notes",
    name: (id) =>
      ({
        docs: "Docs",
        notes: "Notes",
        readme: "Readme",
        a: "Alpha",
        b: "Beta",
      })[id] ?? id,
    expanded: new Set(["docs"]),
    childCount: (id) => (id === "notes" ? 3 : undefined),
  });
}

function modelKeyboardSuite(test: Test, api: ModelApi) {
  const rows = keyboardRows(api);
  const key = (
    value: string,
    focusedId: string,
    extra: Partial<Model.FileTreeKey> = {}
  ) =>
    api.fileTreeKeyCommand(
      { key: value, ...extra },
      { rows, focusedId, now: 1000 }
    );
  test("arrows follow the tree pattern", () => {
    assert.deepEqual(key("ArrowDown", "docs"), {
      type: "focus",
      id: "a",
      extend: false,
    });
    assert.deepEqual(key("ArrowUp", "a"), {
      type: "focus",
      id: "docs",
      extend: false,
    });
    assert.deepEqual(key("ArrowDown", "b", { shiftKey: true }), {
      type: "focus",
      id: "notes",
      extend: true,
    });
    assert.deepEqual(key("ArrowRight", "docs"), { type: "focus", id: "a" });
    assert.deepEqual(key("ArrowRight", "notes"), {
      type: "expand",
      id: "notes",
    });
    assert.deepEqual(key("ArrowRight", "readme"), { type: "none" });
    assert.deepEqual(key("ArrowLeft", "docs"), {
      type: "collapse",
      id: "docs",
    });
    assert.deepEqual(key("ArrowLeft", "b"), { type: "focus", id: "docs" });
    assert.deepEqual(key("ArrowLeft", "readme"), { type: "none" });
    assert.deepEqual(key("Home", "b"), { type: "focus", id: "docs" });
    assert.deepEqual(key("End", "docs"), { type: "focus", id: "readme" });
    assert.deepEqual(key("ArrowDown", "readme"), { type: "none" });
  });

  test("keys open, select, rename, cut, paste, delete, undo and expand", () => {
    assert.deepEqual(key("Enter", "docs"), { type: "toggle", id: "docs" });
    assert.deepEqual(key("Enter", "readme"), { type: "open", id: "readme" });
    assert.deepEqual(key(" ", "readme"), { type: "select", id: "readme" });
    assert.deepEqual(key("F2", "readme"), { type: "rename", id: "readme" });
    assert.deepEqual(key("x", "readme", { ctrlKey: true }), { type: "cut" });
    assert.deepEqual(key("v", "docs", { metaKey: true }), {
      type: "paste",
      id: "docs",
    });
    assert.deepEqual(key("a", "docs", { ctrlKey: true }), {
      type: "select-all",
    });
    assert.deepEqual(key("z", "docs", { ctrlKey: true }), { type: "undo" });
    assert.deepEqual(key("Delete", "docs"), { type: "delete" });
    assert.deepEqual(key("Backspace", "docs"), { type: "delete" });
    assert.deepEqual(key("*", "readme"), {
      type: "expand-siblings",
      id: "readme",
    });
    assert.deepEqual(
      key("ArrowDown", "docs", { altKey: true, shiftKey: true }),
      { type: "expand-all" }
    );
    assert.deepEqual(key("ArrowUp", "docs", { altKey: true, shiftKey: true }), {
      type: "collapse-all",
    });
    assert.deepEqual(key("F10", "docs", { shiftKey: true }), {
      type: "menu",
      id: "docs",
    });
    assert.deepEqual(key("Escape", "docs"), { type: "clear" });
    assert.deepEqual(key("Tab", "docs"), { type: "none" });
  });

  test("type-ahead jumps to the next item starting with the letters", () => {
    assert.deepEqual(key("b", "docs"), {
      type: "typeahead",
      id: "b",
      buffer: "b",
    });
    assert.deepEqual(key("n", "b"), {
      type: "typeahead",
      id: "notes",
      buffer: "n",
    });
    const continued = api.fileTreeKeyCommand(
      { key: "e" },
      {
        rows,
        focusedId: "readme",
        typeahead: { buffer: "r", at: 900 },
        now: 1000,
      }
    );
    assert.deepEqual(continued, {
      type: "typeahead",
      id: "readme",
      buffer: "re",
    });
    const expired = api.fileTreeKeyCommand(
      { key: "a" },
      { rows, focusedId: "docs", typeahead: { buffer: "r", at: 0 }, now: 5000 }
    );
    assert.deepEqual(expired, { type: "typeahead", id: "a", buffer: "a" });
    assert.deepEqual(key("q", "docs"), {
      type: "typeahead",
      id: undefined,
      buffer: "q",
    });
  });

  test("clicks select one, toggle with Cmd/Ctrl and extend with Shift", () => {
    const empty = new Set<string>();
    assert.deepEqual(
      [
        ...api.fileTreeSelectionAfterClick(rows, empty, undefined, "a", {})
          .selection,
      ],
      ["a"]
    );
    const toggled = api.fileTreeSelectionAfterClick(
      rows,
      new Set(["a"]),
      "a",
      "readme",
      { metaKey: true }
    );
    assert.deepEqual([...toggled.selection], ["a", "readme"]);
    const untoggled = api.fileTreeSelectionAfterClick(
      rows,
      toggled.selection,
      "readme",
      "a",
      { ctrlKey: true }
    );
    assert.deepEqual([...untoggled.selection], ["readme"]);
    const range = api.fileTreeSelectionAfterClick(rows, empty, "a", "notes", {
      shiftKey: true,
    });
    assert.deepEqual([...range.selection], ["a", "b", "notes"]);
    const single = api.fileTreeSelectionAfterClick(
      rows,
      empty,
      "a",
      "notes",
      { shiftKey: true },
      false
    );
    assert.deepEqual([...single.selection], ["notes"]);
    assert.deepEqual(api.fileTreeRange(rows, "readme", "b"), [
      "b",
      "notes",
      "readme",
    ]);
  });
}

function modelFormatSuite(test: Test, api: ModelApi) {
  test("formats sizes, relative dates and values", () => {
    assert.equal(api.formatFileSize(999), "999 B");
    assert.equal(api.formatFileSize(1_234_567), "1.2 MB");
    assert.equal(api.formatFileSize(150_000_000), "150 MB");
    assert.equal(api.formatFileSize(null), "--");
    const now = new Date(2026, 8, 24, 12, 0);
    const at = (hours: number) => new Date(now.getTime() - hours * 3_600_000);
    assert.equal(api.formatRelativeDate(at(0.001), "en", now), "Just now");
    assert.equal(api.formatRelativeDate(at(0.5), "en", now), "30 minutes ago");
    assert.equal(api.formatRelativeDate(at(2), "en", now), "2 hours ago");
    assert.equal(api.formatRelativeDate(at(24), "en", now), "Yesterday");
    assert.equal(api.formatRelativeDate(at(24), "fr", now), "Hier");
    assert.equal(api.formatRelativeDate(at(72), "en", now), "3 days ago");
    assert.equal(
      api.formatRelativeDate(new Date(2026, 0, 5), "en", now),
      "Jan 5, 2026"
    );
    assert.equal(api.formatRelativeDate("nope", "en", now), "--");
    const settings = { sizeColumn: "size", updatedColumn: "updatedAt" };
    assert.equal(
      api.formatFileTreeValue(2048, { id: "size" }, { locale: "en", settings }),
      "2 kB"
    );
    assert.equal(
      api.formatFileTreeValue(
        null,
        { id: "size" },
        { locale: "en", settings, folder: true, folderSize: 5000 }
      ),
      "5 kB"
    );
    assert.equal(
      api.formatFileTreeValue(
        undefined,
        { id: "size" },
        { locale: "en", settings, folder: true }
      ),
      "--"
    );
    assert.equal(
      api.formatFileTreeValue("folder", COLUMNS[1], { locale: "en", settings }),
      "Folder"
    );
  });

  test("labels in English and French, overridable with filetree.<key>", () => {
    assert.equal(
      api.fileTreeLabel("showMore", "en", undefined, { count: 3 }),
      "Show more (3)"
    );
    assert.equal(
      api.fileTreeLabel("showMore", "fr-FR", undefined, { count: 3 }),
      "Afficher plus (3)"
    );
    assert.equal(api.fileTreeLabel("unfiled", "fr"), "Non classés");
    assert.equal(
      api.fileTreeLabel("intoSelf", "en"),
      "You can't move a folder into itself"
    );
    assert.equal(
      api.fileTreeLabel("newFolder", "en", (key, fallback) =>
        key === "newFolder" ? "Add folder" : fallback
      ),
      "Add folder"
    );
    assert.equal(
      api.fileTreeSummary({ folders: 6, files: 15 }, "en"),
      "6 folders · 15 files"
    );
    assert.equal(
      api.fileTreeSummary({ folders: 1, files: 1 }, "fr"),
      "1 dossier · 1 fichier"
    );
  });

  test("icons follow the folder state, the media contract, MIME type and extension", () => {
    const options = { folder: false, nameColumn: "name" };
    assert.equal(
      api.fileTreeIcon(
        { name: "x" },
        { ...options, folder: true, expanded: true }
      ).kind,
      "folder-open"
    );
    assert.equal(api.fileTreeIcon({ name: "a.pdf" }, options).kind, "document");
    assert.equal(api.fileTreeIcon({ name: "a.zip" }, options).kind, "archive");
    assert.equal(api.fileTreeIcon({ name: "a.tsx" }, options).kind, "code");
    assert.equal(
      api.fileTreeIcon(
        { name: "clip", mime: "video/mp4", url: "https://x/a" },
        { ...options, media: { urlColumn: "url", mimeTypeColumn: "mime" } }
      ).kind,
      "video"
    );
    assert.equal(api.fileTreeIcon({ name: "noext" }, options).kind, "file");
    assert.deepEqual(
      api.fileTreeIcon(
        { name: "x" },
        { ...options, getIcon: () => ({ src: "/i.svg" }) }
      ),
      { kind: "file", src: "/i.svg" }
    );
    assert.equal(
      api.fileTreeIcon({ name: "x" }, { ...options, getIcon: () => "audio" })
        .kind,
      "audio"
    );
  });

  test("search helpers: query detection, ancestors and highlights", () => {
    assert.equal(api.hasFileTreeQuery({}), false);
    assert.equal(api.hasFileTreeQuery({ search: " logo " }), true);
    assert.equal(api.hasFileTreeQuery({ filters: { kind: "" } }), false);
    assert.equal(api.hasFileTreeQuery({ filters: { kind: "file" } }), true);
    assert.equal(
      api.hasFileTreeQuery({
        advancedFilters: {
          filters: [{ columnId: "kind", operator: "is", values: ["file"] }],
          joinOperator: "and",
        },
      }),
      true
    );
    const all = [
      FOLDER("a", null),
      FOLDER("b", "a"),
      FILE("c", "b"),
      FILE("d", null),
    ];
    assert.deepEqual(
      api
        .fileTreeAncestorRows([FILE("c", "b")], all, "parentId")
        .map((row) => row.id),
      ["a", "b"]
    );
    assert.deepEqual(api.highlightFileTreeName("Banner banner", "BAN"), [
      { text: "Ban", match: true },
      { text: "ner ", match: false },
      { text: "ban", match: true },
      { text: "ner", match: false },
    ]);
  });

  test("windowing keeps a fixed-height slice and scrolls rows into view", () => {
    assert.deepEqual(
      api.fileTreeWindow({
        count: 1000,
        rowHeight: 40,
        scrollTop: 4000,
        viewport: 400,
        overscan: 2,
      }),
      { start: 98, end: 112, before: 3920, after: 35_520 }
    );
    assert.equal(api.fileTreeScrollTo(5, 40, 400, 200), 200);
    assert.equal(api.fileTreeScrollTo(20, 40, 400, 200), 640);
    assert.equal(api.fileTreeScrollTo(12, 40, 400, 200), 400);
    assert.ok(api.fileTreeAutoScroll(5, 0, 600) < 0);
    assert.ok(api.fileTreeAutoScroll(595, 0, 600) > 0);
    assert.equal(api.fileTreeAutoScroll(300, 0, 600), 0);
    assert.deepEqual(api.fileTreeGridColumns(2, true), {
      full: "2.5rem minmax(12rem, 1fr) minmax(6rem, 9rem) minmax(6rem, 9rem) 2.75rem",
      compact: "2.5rem minmax(0, 1fr) 2.75rem",
    });
  });
}

function controllerLoadSuite(test: Test, api: ModelApi & ControllerApi) {
  test("loads the root, then the open folders, with the children scope", async () => {
    const { requests, tree } = setup(api);
    tree.start();
    await flush();
    assert.deepEqual(requests.slice(0, 1), [
      { scope: "children", parentId: null },
    ]);
    assert.deepEqual(
      requests
        .filter((request) => request.scope === "children")
        .map((request) => request.parentId)
        .sort(),
      [null, "f-brand", "f-campaigns", "f-photos"].sort()
    );
    assert.deepEqual(outline(tree), [
      "Brand",
      "  Fonts",
      "  Logos",
      "  Brand guidelines.pdf",
      "Campaigns",
      "  2026",
      "Documents",
      "Photos",
      "  Office.jpg",
      "  Team.jpg",
      "  Workshop.jpg",
      "Podcast intro.mp3",
      "README.md",
    ]);
    assert.deepEqual(tree.getState().summary, { folders: 7, files: 6 });
    const brand = tree.getState().rows.find((row) => row.id === "f-brand");
    assert.equal(brand?.type === "node" && brand.childCount, 3);
    assert.equal(
      tree.folderSize("f-brand"),
      184_320 + 92_160 + 3_400_000 + 2_450_000
    );
  });

  test("a saved view opens its own folders; a closed folder loads on expand", async () => {
    const { requests, tree } = setup(api, {
      view: { expanded: ["f-campaigns", "f-2026"] },
    });
    tree.start();
    await flush();
    assert.deepEqual(outline(tree).slice(0, 6), [
      "Brand",
      "Campaigns",
      "  2026",
      "    Spring launch",
      "    Campaign brief.pdf",
      "Documents",
    ]);
    assert.equal(
      requests.some((request) => request.parentId === "f-brand"),
      false
    );
    tree.expand("f-brand");
    await flush();
    assert.ok(requests.some((request) => request.parentId === "f-brand"));
    assert.ok(outline(tree).includes("  Logos"));
  });

  test("builds the tree in memory when the host ignores the scopes", async () => {
    const { requests, tree } = setup(api, { scopes: false });
    tree.start();
    await flush();
    const state = tree.getState();
    assert.ok(state.rows.some((row) => row.id === api.FILETREE_UNFILED));
    assert.equal(tree.name(api.FILETREE_UNFILED), "Unfiled");
    assert.equal(
      requests.filter((request) => request.scope === "children").length,
      1
    );
    tree.expand(api.FILETREE_UNFILED);
    assert.ok(outline(tree).includes("  Old draft.docx"));
    assert.deepEqual(state.summary, { folders: 8, files: 15 });
  });

  test("new page rows while the first children load still show the tree built in memory", async () => {
    const { tree } = setup(api, { scopes: false });
    // Like React and Vue, read the state again after every change.
    let state = tree.getState();
    tree.subscribe(() => {
      state = tree.getState();
    });
    tree.start();
    tree.setOptions({ ...optionsOf(tree), revision: 1 });
    await flush();
    assert.equal(state.status, "ready");
    assert.ok(state.rows.some((row) => row.id === api.FILETREE_UNFILED));
    assert.ok(!state.rows.some((row) => row.type === "loading"));
  });

  test("pages big folders by 200 with Show more", async () => {
    const children = Array.from({ length: 250 }, (_, index) =>
      FILE(`f${index}`, null, `File ${index + 1}`)
    );
    const list: Controller.FileTreeListAction = (params) => {
      const page = Number(params.page);
      return Promise.resolve({
        data: children.slice((page - 1) * 200, page * 200),
        meta: { scope: "applied", totalCount: 250 },
      });
    };
    const tree = new api.FileTreeController({
      list,
      rows: [],
      params: {},
      settings: api.resolveFileTreeSettings([], SETTINGS),
      hooks: {},
      getRowId: (row) => String(row.id),
      locale: "en",
      events: {
        open: () => undefined,
        notify: () => undefined,
        focus: () => undefined,
        persist: () => undefined,
        folder: () => undefined,
        requestDelete: () => undefined,
        menu: () => undefined,
      },
    });
    tree.start();
    await flush();
    const more = tree.getState().rows.at(-1);
    assert.equal(more?.type === "more" && more.remaining, 50);
    assert.equal(
      tree.getState().rows.filter((row) => row.type === "node").length,
      200
    );
    tree.loadMore(null);
    await flush();
    assert.equal(
      tree.getState().rows.filter((row) => row.type === "node").length,
      250
    );
    assert.equal(
      tree.getState().rows.some((row) => row.type === "more"),
      false
    );
  });

  test("expand all uses the subtree scope; collapse all keeps root rows only", async () => {
    const { persisted, requests, tree } = setup(api);
    tree.start();
    await flush();
    await tree.expandAll();
    await flush();
    assert.ok(requests.some((request) => request.scope === "subtree"));
    assert.equal(outline(tree).length, 22);
    assert.ok(outline(tree).includes("      Banner 10.jpg"));
    assert.equal(tree.getState().canExpandAll, false);
    assert.deepEqual(persisted.at(-1), { expanded: [], expandedAll: true });
    tree.collapseAll();
    assert.deepEqual(outline(tree), [
      "Brand",
      "Campaigns",
      "Documents",
      "Photos",
      "Podcast intro.mp3",
      "README.md",
    ]);
    assert.equal(tree.getState().canCollapseAll, false);
    assert.deepEqual(persisted.at(-1), { expanded: [], expandedAll: false });
  });

  test("without the subtree scope, expand all loads folders level by level", async () => {
    const requests: AssetRequest[] = [];
    const host = createAssetActions({
      log: (request) => requests.push(request),
    });
    const list: Controller.FileTreeListAction = (params) => {
      const scope = params.scope as Row | undefined;
      return host.list(
        scope?.kind === "subtree" ? { ...params, scope: undefined } : params
      ) as ReturnType<Controller.FileTreeListAction>;
    };
    const tree = new api.FileTreeController({
      list,
      rows: [],
      params: {},
      settings: api.resolveFileTreeSettings(
        COLUMNS,
        assetTableOptions.filetree,
        { expanded: [] }
      ),
      hooks: {},
      getRowId: (row) => String(row.id),
      locale: "en",
      events: {
        open: () => undefined,
        notify: () => undefined,
        focus: () => undefined,
        persist: () => undefined,
        folder: () => undefined,
        requestDelete: () => undefined,
        menu: () => undefined,
      },
    });
    tree.start();
    await flush();
    await tree.expandAll();
    await flush();
    assert.equal(outline(tree).length, 22);
    const loaded = requests
      .filter((request) => request.scope === "children")
      .map((request) => request.parentId);
    assert.ok(loaded.includes("f-spring"));
  });

  test("a search shows matches with their ancestors, then the tree comes back", async () => {
    const { requests, tree } = setup(api, { params: { search: "banner" } });
    tree.start();
    await flush();
    assert.ok(requests.some((request) => request.scope === "tree-matches"));
    assert.deepEqual(outline(tree), [
      "Campaigns",
      "  2026",
      "    Spring launch",
      "      Banner 1.jpg",
      "      Banner 2.jpg",
      "      Banner 10.jpg",
    ]);
    assert.deepEqual([...tree.getState().matches].sort(), [
      "banner-1",
      "banner-10",
      "banner-2",
    ]);
    const fallback = setup(api, {
      params: { search: "banner" },
      scopes: false,
    });
    fallback.tree.start();
    await flush();
    assert.deepEqual(outline(fallback.tree), outline(tree));
    tree.setOptions({ ...optionsOf(tree), params: {} });
    await flush();
    assert.equal(tree.getState().searching, false);
    assert.ok(outline(tree).includes("Photos"));
  });
}

/** The options a controller was built with (tests replace one at a time). */
function optionsOf(tree: FileTree): Controller.FileTreeControllerOptions {
  return (tree as unknown as { options: Controller.FileTreeControllerOptions })
    .options;
}

function controllerMoveSuite(test: Test, api: ModelApi & ControllerApi) {
  test("moves at once, calls tree.move, and undo puts items back", async () => {
    const { host, notes, tree } = setup(api);
    tree.start();
    await flush();
    const moved = tree.move(["readme", "podcast"], "f-documents");
    assert.ok(!outline(tree).includes("README.md"));
    assert.equal(await moved, true);
    await flush();
    assert.ok(outline(tree).includes("  README.md"));
    const note = notes.find((item) => item.type === "success");
    assert.equal(note?.message, "Moved 2 items to Assets › Documents");
    assert.equal(
      (
        await host.list({
          scope: { kind: "children", parentId: "f-documents" },
        })
      ).data.length,
      2
    );
    await tree.undo();
    await flush();
    assert.deepEqual(outline(tree).slice(-2), [
      "Podcast intro.mp3",
      "README.md",
    ]);
    assert.ok(notes.some((item) => item.message === "Move undone"));
  });

  test("a refused move rolls back and shows the server's reason", async () => {
    const { host, notes, tree } = setup(api);
    tree.start();
    await flush();
    await host.tree.createFolder({ parentId: "f-photos", name: "README.md" });
    await tree.move(["readme"], "f-photos");
    await flush();
    assert.ok(outline(tree).includes("README.md"));
    assert.equal(notes.at(-1)?.type, "error");
    assert.equal(
      notes.at(-1)?.message,
      "An item named “README.md” already exists there."
    );
  });

  test("without tree.move, moves update the parent column; invalid moves say why", async () => {
    const { host, notes, tree } = setup(api, { tree: false });
    tree.start();
    await flush();
    await tree.move(["team"], "f-brand");
    await flush();
    assert.equal(
      (
        await host.list({ scope: { kind: "children", parentId: "f-brand" } })
      ).data.some((row) => row.id === "team"),
      true
    );
    await tree.move(["f-campaigns"], "f-2026");
    assert.equal(
      notes.at(-1)?.message,
      "You can't move a folder into one of its subfolders"
    );
  });

  test("cut and paste move with the keyboard", async () => {
    const { tree } = setup(api);
    tree.start();
    await flush();
    tree.focus("readme");
    assert.equal(tree.keydown({ key: "x", ctrlKey: true }), true);
    assert.deepEqual([...tree.getState().cut], ["readme"]);
    tree.focus("f-photos");
    tree.keydown({ key: "v", ctrlKey: true });
    await flush();
    assert.ok(outline(tree).includes("  README.md"));
    assert.equal(tree.getState().cut.size, 0);
  });

  test("drags refuse a descendant with a reason and drop into folders", async () => {
    const { tree } = setup(api);
    tree.start();
    await flush();
    tree.dragStart("f-campaigns");
    tree.dragOver("f-2026");
    assert.deepEqual(
      {
        valid: tree.getState().drag?.valid,
        message: tree.getState().drag?.message,
      },
      {
        valid: false,
        message: "You can't move a folder into one of its subfolders",
      }
    );
    tree.dragOver("office");
    assert.equal(tree.getState().drag?.parentId, "f-photos");
    assert.equal(
      tree.getState().drag?.message,
      "Move “Campaigns” to Assets › Photos"
    );
    tree.dragOver(api.FILETREE_ROOT_TARGET);
    assert.equal(tree.getState().drag?.message, "Already in this folder");
    tree.dragCancel();
    tree.dragStart("readme");
    tree.dragOver("f-brand");
    tree.dragEnd();
    await flush();
    assert.ok(outline(tree).includes("  README.md"));
  });

  test("renames through update; a clash stays on the row", async () => {
    const { tree } = setup(api);
    tree.start();
    await flush();
    tree.focus("readme");
    tree.keydown({ key: "F2" });
    assert.equal(tree.getState().renamingId, "readme");
    await tree.commitRename("Podcast intro.mp3");
    assert.equal(tree.getState().renamingId, "readme");
    assert.equal(
      tree.getState().renameError,
      "An item named “Podcast intro.mp3” already exists here."
    );
    await tree.commitRename("Read me.md");
    assert.equal(tree.getState().renamingId, undefined);
    assert.ok(outline(tree).includes("Read me.md"));
  });

  test("creates folders with tree.createFolder or create", async () => {
    const { tree } = setup(api);
    tree.start();
    await flush();
    tree.focus("f-photos");
    tree.startCreateFolder();
    assert.equal(tree.getState().draftParent, "f-photos");
    await tree.commitCreateFolder("Events");
    await flush();
    assert.ok(outline(tree).includes("  Events"));
    assert.equal(tree.getState().focusedId, "folder-1");
    const fallback = setup(api, { tree: false });
    fallback.tree.start();
    await flush();
    fallback.tree.startCreateFolder(null);
    await fallback.tree.commitCreateFolder("");
    await flush();
    assert.ok(outline(fallback.tree).includes("New folder"));
  });

  test("deletes through the table and shows the host's refusal", async () => {
    const { deletes, notes, tree } = setup(api);
    tree.start();
    await flush();
    tree.focus("f-brand");
    tree.keydown({ key: "Delete" });
    assert.deepEqual(deletes, [["f-brand"]]);
    await tree.remove(["f-brand"]);
    assert.equal(
      notes.at(-1)?.message,
      "“Brand” is not empty. Move or delete its content first."
    );
    await tree.remove(["f-documents"]);
    await flush();
    assert.ok(!outline(tree).includes("Documents"));
  });

  test("a linked folder opens with its ancestors; phones drill into folders", async () => {
    const { tree } = setup(api, { view: { expanded: [] } });
    tree.start("f-spring");
    await flush();
    assert.ok(outline(tree).includes("      Banner 10.jpg"));
    assert.equal(tree.getState().focusedId, "f-spring");
    assert.deepEqual(
      tree.getState().crumbs.map((crumb) => crumb.name),
      ["Assets", "Campaigns", "2026", "Spring launch"]
    );
    tree.setPhone(true);
    assert.equal(tree.getState().drillId, "f-spring");
    assert.deepEqual(outline(tree), [
      "Banner 1.jpg",
      "Banner 2.jpg",
      "Banner 10.jpg",
      "Hero video.mp4",
    ]);
    tree.back();
    await flush();
    assert.deepEqual(outline(tree), ["Spring launch", "Campaign brief.pdf"]);
    tree.click("brief");
    assert.equal(tree.getState().selection.size, 0);
    tree.activate("brief");
    tree.drill(null);
    assert.ok(outline(tree).includes("Campaigns"));
  });

  test("selection keys, select all and the menu entries", async () => {
    const { tree } = setup(api);
    tree.start();
    await flush();
    tree.focus("f-brand");
    tree.keydown({ key: "ArrowDown", shiftKey: true });
    assert.deepEqual([...tree.getState().selection], ["f-brand", "f-fonts"]);
    tree.keydown({ key: "a", ctrlKey: true });
    assert.equal(tree.getState().selection.size, 13);
    tree.keydown({ key: "Escape" });
    assert.equal(tree.getState().selection.size, 0);
    assert.deepEqual(
      tree.menuItems("f-brand").map((item) => item.key),
      ["info", "open", "rename", "move", "new-folder", "delete"]
    );
    assert.deepEqual(
      tree.menuItems("office", { preview: true }).map((item) => item.key),
      ["info", "preview", "open", "rename", "move", "delete"]
    );
  });
}

/** One suite, run by the React (bun) and Vue (vitest) editions on their own copies. */
export function fileTreeModelSuite(test: Test, api: ModelApi & ControllerApi) {
  modelSettingsSuite(test, api);
  modelTreeSuite(test, api);
  modelMoveSuite(test, api);
  modelKeyboardSuite(test, api);
  modelFormatSuite(test, api);
  controllerLoadSuite(test, api);
  controllerMoveSuite(test, api);
}
