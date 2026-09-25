# File tree view — specification

Status: Shipped in 3.6.0 · Editions: React and Vue (parity required)

## 1. Purpose

A **File tree** display mode that shows the same records as the table, gallery or
list as a hierarchy of folders and files, like the sidebar of Finder, Google
Drive or VS Code. It is an alternative view for a classic asset manager: people
browse and reorganise assets by folder, while the gallery keeps showing
thumbnails and the table keeps showing metadata.

The library owns the tree logic and interface. The host owns storage, the
hierarchy on the server, permissions and the actual moves (see
[table owns UI, host owns server](FRAMEWORK-PARITY.md)).

## 2. Scope

In scope:

- Folders and files from one table, linked by a parent column.
- Lazy, server-side loading of a folder's children.
- Expand, collapse, expand all, collapse all, select, open, preview, rename,
  create folder, move (drag and drop and keyboard), delete.
- Search and filters that keep matching items visible with their ancestors.
- Breadcrumbs, an optional details/preview pane, and counts per folder.
- Saved per view like other display modes; URL state for the open folder.

Out of scope for the first release (follow-ups):

- Uploading files by dropping them from the desktop (hosts wire it through
  `onDropFiles`, see §7; the library ships no uploader).
- Symlinks/shortcuts, one record in several folders.
- Cross-table trees (folders from one table, files from another).
- Version history of files.

## 3. Data model

Each record is a **node**. The view reads these columns, chosen in its settings:

| Setting | Required | Meaning |
|---|---|---|
| `parentColumn` | yes | Id of the parent folder record; empty for root items. Detected from a column named `parentId`, `parent_id`, `parent`, `folderId`, `folder_id` or `folder`. |
| `kindColumn` | no | `"folder"` or `"file"`. Without it, a record is a folder when it has children or when `isFolder(row)` returns true. |
| `nameColumn` | yes | Label of the node; defaults to a column named `name`/`title`, else the first text column. |
| `sizeColumn` | no | Bytes, shown formatted (`1.2 MB`, decimal units) and summed per folder when the host returns totals. |
| `updatedColumn` | no | Shown as a relative date ("2 hours ago", "Yesterday") and usable for sorting. |
| `media` | no | Reuses `table.gallery.media` (`urlColumn`, `mimeTypeColumn`, `getMedia`) for icons, thumbnails and preview. |

Rules:

- A folder's children are ordered **folders first**, then by the view's sort
  (default: name, natural order `file2` < `file10`, locale-aware).
- Cycles and missing parents are tolerated: a node whose parent is unknown or
  would create a cycle is shown under a virtual "Unfiled" folder, never lost.
  This applies whenever the tree is built in the browser (client fallback and
  search results); with the `children` scope the host decides what its root
  contains.
- Depth is unlimited; indentation stops growing after 8 levels (still readable
  on phones) and the breadcrumb shows the full path.

## 4. Server contract (additive)

Server first: a tree of 100,000 assets must not load at once. Scopes are sent
as `params.scope` with a `kind`, like the calendar's `dateRange` scope, and the
host confirms it applied one with `meta.scope: "applied"`.

### 4.1 Children

```ts
list({ ...query, scope: { kind: "children", parentId: string | null } })
// → { data, meta: { scope: "applied", totalCount, childCounts?: Record<id, number>, sizes?: Record<id, number> } }
```

- `parentId: null` means the root.
- `childCounts` lets the view show expanders and counts without loading
  grandchildren. When missing, every folder shows an expander that may turn out
  empty.
- Pagination: a folder with many children loads 200 at a time with a
  "Show more (N)" row (`N` from `totalCount`; "Show more" when the host gives
  no total).
- Hosts that ignore the scope (`meta.scope` not `"applied"`) get a client-side
  fallback: the view loads rows through the capped all-rows loader (2,000 rows)
  and builds the tree in memory, with the usual truncation notice.

### 4.2 Subtree (Expand all)

"Expand all" opens every folder, not only the loaded ones:

```ts
list({ ...query, scope: { kind: "subtree", parentId: null }, pageSize: 2000 })
// → { data: every descendant, meta: { scope: "applied", truncated?, childCounts?, sizes? } }
```

The host may cap the answer and set `meta.truncated`. Fallback: folders are
loaded breadth first, level by level, until 2,000 nodes; beyond that the view
shows "Expanded the first N items".

### 4.3 Search inside the tree

When a search or filter is active, the view calls `list` **without** the
children scope and asks for ancestors:

```ts
list({ ...query, scope: { kind: "tree-matches" } })
// → { data: matches, meta: { scope: "applied", ancestors: Row[], truncated? } }
```

Matching nodes are shown with their ancestor folders expanded and the matches
highlighted; non-matching siblings are hidden. Fallback: the matches come from
the query, the ancestors from the rows loaded without it (both capped).

### 4.4 Path

`actions.tree.path?(id) → Row[]` returns the ancestors of a node, root first,
for breadcrumbs and deep links. Fallback: walk `parentColumn` over loaded rows.

### 4.5 Mutations

| Action | Signature | Notes |
|---|---|---|
| Move | `actions.tree.move({ ids, parentId, beforeId? }) → { moved?, failed? }` | Batch; server re-checks permissions, cycles and name clashes. `failed: [{ id, error? }]` is rolled back and the first error shown. Fallback: `update` of `parentColumn` per record. |
| Create folder | `actions.tree.createFolder({ parentId, name }) → Row` | Fallback: `create` with `kindColumn = "folder"`. |
| Rename | inline edit of `nameColumn` through `update` | Name clash → the server's error stays on the row. |
| Delete | `actions.delete` per record, after a confirmation | Deleting a folder: the host decides (recursive, refuse if not empty, or move children up); the view shows the host's message. |

Moves are optimistic with rollback and undoable: the notification carries an
"Undo" action ("Moved 3 items to Brand › 2026 · Undo") and Ctrl/Cmd+Z reverts
the last move.

## 5. Interface

### 5.1 Layout

- **Desktop (default):** a table-style tree. A header shows the root label
  (default: the table's name) and a summary line ("6 folders · 15 files", the
  known nodes), the view actions ("New folder", "Expand all", "Collapse all",
  "Details") and the breadcrumbs of the current folder. Then a table with a
  selection checkbox column, the Name column (indentation per level, chevron
  for folders, colored folder/file-type icons, child count) and the view's
  other columns (Size right-aligned and formatted, Modified relative; folders
  show "--" for size unless the host returns totals), and a row menu.
  Column headers sort (folders stay first).
- **Details pane (optional, `showDetails` default false):** opens from the
  "Details" toggle or a row's "Info" action; resizable (drag or arrow keys on
  its edge). Preview (media thumbnail opening the native viewer, or a large
  icon), name, kind, location, item count, the view's columns and
  `detailFields`, plus actions (Preview, Open, Rename, Move to…, New folder,
  Delete). `renderDetails(row)` replaces its body.
- A floating selection bar ("3 selected · Move to… · Delete · Clear
  selection") appears below the tree without moving the rows.
- **Phones:** no side pane; tapping a folder drills into it (breadcrumb and a
  back button), tapping a file opens the preview/record; the always-visible
  checkboxes select. Moves use "Move to…"
  (the folder picker becomes a bottom sheet), not drag.

### 5.2 Rows

Each row: expander (folders), icon (folder open/closed, or file type from the
media contract, MIME type or extension: image, video, audio, PDF/document,
archive, code, generic; `getIcon` may return a kind or an image), name (with
match highlight), then the columns, which hide on narrow widths. Selection
checkbox on hover and when any item is selected. Folder rows show a child
count when known.

### 5.3 Interactions

| Gesture | Result |
|---|---|
| Click row | Select and focus; show in the details pane. |
| Double-click / Enter | Folder: expand/collapse. File: open preview (media) or record view (non-media), following `rowClick` settings. |
| Click expander / → ← | Expand / collapse (→ on an open folder moves to its first child, ← on a child moves to its parent). |
| Shift/Cmd-click, Shift+↑↓, Space, Cmd/Ctrl+A | Range / toggle / all selection. |
| `*` | Expand every folder beside the focused row (tree pattern). |
| Alt+Shift+↓ / Alt+Shift+↑ | Expand all / Collapse all (`aria-keyshortcuts` on the buttons). |
| F2 | Rename inline. |
| Drag rows onto a folder | Move (drop target highlighted, auto-expand after 600 ms hover, auto-scroll near edges, a label near the pointer). Dropping onto a file moves into its parent; dropping onto the header moves to the root. Invalid targets (itself, a descendant, Unfiled, no permission, already there) show a not-allowed cursor and the reason. |
| Cmd/Ctrl+X then Cmd/Ctrl+V on a row | Keyboard move (into the folder, or the file's folder). Escape cancels. |
| "Move to…" in the row menu or selection bar | Folder picker dialog (searchable tree; invalid targets disabled with their reason), works everywhere. |
| Delete / Backspace | Delete with confirmation. |
| Shift+F10 / context menu key | Row menu. |
| Type-ahead | Jump to the next visible item starting with the typed letters. |
| Ctrl/Cmd+Z | Undo the last move. |

### 5.4 Accessibility

- WAI-ARIA **treegrid** pattern: `role="treegrid"` with
  `aria-multiselectable`; rows are `role="row"` with `aria-level`,
  `aria-setsize`, `aria-posinset`, `aria-expanded`, `aria-selected` and the
  node name as label; cells are `gridcell`/`columnheader` (`aria-sort`). One
  tab stop, roving focus on rows; controls inside rows are not tab stops and
  have keyboard equivalents.
- Every drag action has a keyboard and menu equivalent (§5.3).
- Loading children announces "Loading…" then the count via a polite live
  region; moves, renames and creations are announced too.
- Windowed rendering keeps `aria-setsize`/`aria-posinset` correct (they come
  from the tree, not the rendered slice).

### 5.5 Performance

- Windowed rendering of the flattened visible tree above 150 rows (40 px rows,
  the scroll area is capped at `min(70vh, 40rem)`).
- Children cached per folder; reloaded after moves, creates, renames, deletes,
  table mutations and on refresh; a new query or column setting clears the
  cache.
- Expanded state kept per view (saved, `expanded` ids capped at 500, or
  `expandedAll`) and in the URL for the current folder
  (`<tableId>-folder=<id>`), so a link opens the same folder.

## 6. Settings (per view, saved)

`parentColumn`, `kindColumn`, `nameColumn`, `sizeColumn`, `updatedColumn`,
`columns` (the columns after Name; default size and updated),
`showDetails` (default false), `detailFields` (list), `foldersFirst` (default
true), `sort` (`{ id, desc }`; header clicks set it, default name),
`defaultExpandedDepth` (0–2, default 1: top-level folders open on first load),
`rootLabel` (default the table name), `expanded` / `expandedAll`.
`table.filetree` sets defaults and holds the host hooks; `false` disables the
mode. Two table-level flags (not saved per view) govern the folders in the
other views (section 11): `newFolderAction` and `folderFilter`, both true by
default. The mode is only offered when a parent column is configured or
detectable, and when `"filetree"` is in `displayModes`. The settings panel
(View → Card settings) offers the columns, a columns preset (size and
modified, size, modified, name only), the details pane, folders first and the
first-load depth.

## 7. Host extension points

- `isFolder(row)`, `getIcon(row)` for custom kinds.
- `renderDetails(row)` to replace the details pane body (a React node, or a
  Vue render result).
- `onDropFiles({ parentId, files })` (optional): when present, dropping files
  from the desktop onto a folder calls it (the host uploads); the view shows
  an "Uploading N files…" notice and reloads the folder. Not implemented by
  the library itself.
- `canMove(row, target)`, `canCreateFolder(parent)`, `canRename(row)` for
  permissions in the interface (the server still decides).

## 8. Labels

EN/FR via `filetree.<key>` (e.g. "New folder", "Move to…", "Moved {count}
items to {path}", "Unfiled", "Show more ({count})", "Empty folder",
"You can't move a folder into itself", "Expand all", "Collapse all", and for
the other views "Root", "Parent folder", "In", "No folders", "The folder
could not be created.").

## 9. Parity and tests

- Shared pure model `utils/filetree-model.ts`, controller
  `utils/filetree-controller.ts`, DOM helpers `utils/filetree-dom.ts` and
  stylesheet `utils/filetree.css` (all synced to Vue): building and flattening
  the tree, folders-first natural sort, cycle/orphan handling, move validation
  (self, descendant, permissions), keyboard navigation state machine,
  search-with-ancestors, expanded-state serialization, expand-all ordering and
  cap, loading, moves, undo, rename, folder creation, deletion, drag state.
- Shared unit suite (`tests/filetree-model-suite.ts`) run by both editions.
- Playwright on both demos (`e2e/filetree.spec.ts`): lazy load (asserting the
  `children` requests), expand all (asserting the `subtree` request) and
  collapse all, details pane, drag a file into a folder and undo, invalid drop
  into a descendant, cut/paste and "Move to…", create folder, rename with F2
  (and a clash), keyboard navigation, search with ancestors, deep link to a
  folder, the client fallback with Unfiled, phone drill-down, view settings;
  `e2e/facets.spec.ts` creates a folder from the gallery under a chosen
  parent and filters the gallery by a folder and by the root.
- Demo: an "Assets" table (folders Brand, Campaigns/2026, Photos…, files with
  image/video/PDF URLs reused from the gallery media demo) with File tree,
  Gallery and Table modes (`?example=assets`), an in-memory `list` supporting
  the children, subtree and tree-matches scopes and `tree.path`, `tree.move`
  and `tree.createFolder`; `?example=assets-fallback` ignores the scopes.

## 10. Rollout

- `TableDisplayMode` gains `"filetree"` (typing note in the changeset for hosts
  with exhaustive maps).
- Core item (no new dependency); drag and drop is a shared pointer-event
  helper in both editions (see Deviations).
- Companion EN/FR docs page "File tree view" in Yayaw docs.
- Yayaw integration later: the media library's folders map onto
  `parentColumn`, with `tree.move` and `createFolder` as server actions.

## 11. Folders in the other views

A table whose rows form a file tree offers its folders in its other views
(table, list, gallery, Kanban, calendar, map…), so people do not have to
switch to the File tree:

- **New folder** in the toolbar (not in the File tree, which has its own, nor
  in the Form view or Gantt), when folders can be created
  (`actions.tree.createFolder`, else `create` with `allowCreate`). A dialog
  asks for the name and the parent folder: a searchable picker of every
  folder with its location, the root first. It starts in the folder the view
  is filtered on (one folder), else the root. The name follows the File
  tree's rules (trimmed; blank is "New folder"), `canCreateFolder(parent)`
  is asked, and the host's error (a name clash) shows in the dialog. The
  table reloads after it.
- **The folder filter**: the parent column filters with the same picker in
  the filter menus, the root or folders, written as `isAnyOf` with the folder
  ids (the folders' direct content) or `isEmpty` for the root, and read "In"
  and the folder's name. A facet on the parent column
  (`table.facets`) lists the same folders with their numbers of records.
- `table.filetree.newFolderAction: false` and `folderFilter: false` turn
  them off.

Folders load once, when a picker or a facet first needs them, and again after
the table's data changes: `list` with `scope: { kind: "subtree", parentId:
null }` and, with a kind column, a rule keeping folders (`isAnyOf`
`["folder"]`), up to 2,000; a host that does not apply the scope gets the
capped all-rows loader, and folders are picked from the rows. Shared rules:
`utils/folder-directory.ts` (synced to Vue).

## Deviations from the draft

- **Table-style tree by default.** The draft described a plain tree with a
  mandatory details pane. Following the design direction (shadcn "tables file
  tree" block), the default is a table with a tree in the Name column, the
  WAI-ARIA *treegrid* pattern instead of *tree*, a header with a summary line,
  and an optional details pane (`showDetails` default false). `compactColumns`
  became `columns` (any column ids), with presets in the settings panel.
- **Expand all / Collapse all** gained a `subtree` scope and a breadth-first
  fallback capped at 2,000 nodes, persisted as `expandedAll`; Alt+Shift+↓/↑
  are their shortcuts, `*` expands siblings.
- **Scope objects use `kind`** (`{ kind: "children", parentId }`), like the
  existing `dateRange` scope, instead of `type`; list answers keep the existing
  `{ data, meta }` shape (`meta.totalCount`, not `total`).
- **Drag and drop** uses one shared pointer-event helper (`filetree-dom.ts`) in
  both editions rather than `@dnd-kit` in React: the List view already drags
  with pointer events in both editions, and one helper gives both the same
  auto-expand, auto-scroll, floating reason label and cursor. Touch drags are
  off (phones use "Move to…").
- **Undo** is a notification action plus Ctrl/Cmd+Z owned by the tree; the
  table's activity undo is about record history and does not cover moves.
- **Unfiled** appears when the tree is built in the browser (client fallback,
  search results). With the `children` scope, orphans and cycles are the
  host's to place.
- **Dialogs** (Move to…, delete confirmation) are native `<dialog>` elements
  in both editions for identical behaviour; row menus use each edition's menu
  primitive.
- **The renderer context grew** (additive): `title`, `tree`, `patchRow`,
  `deleteRow`, `canDeleteRow`, `media`, `imageColumn`, `selection`, `syncUrl`
  and `refresh`, so the built-in renderer never reaches into table internals.
- **Selection** is the tree's own (it spans folders that are not on the
  table's current page); bulk actions are "Move to…" and "Delete" in the
  selection bar.
- The React table's page pagination is hidden in this mode (the tree pages
  each folder itself), as in Vue.
