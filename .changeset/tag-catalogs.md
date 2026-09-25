---
"yayaw-table-workspace": minor
---

Tags columns backed by the host's tag catalog, the same in React and Vue.

- **Tags columns**: `tags: true` (or `{ create?, manage?, bulk? }`) on a `multiSelect` (a list of tag ids) or `select` (one id) column. With the new optional `actions.tags` (`list`, `create`, `update`, `merge`, `remove`, each called with `{ tableId, tableType, columnId }`), the column's options are the host's catalog, loaded once per table and column and cached: cells, cards, the Feed, filters, grouping and the record view show the tags' names and colors. Without `actions.tags`, static `options` work as before.
- **Create on the fly**: the tag picker (inline cells, record form fields bound to a tags column, bulk dialogs) searches names without case or accents and offers "Create “name”", which creates, selects and caches the tag. Colored chips, full keyboard support.
- **Bulk "Add tags" and "Remove tags"** in the bulk bar (tags columns holding lists, with `allowBulkEdit` and `bulkUpdate` or `update`): an optimistic patch of the selection; rows that fail are restored and stay selected. `bulkUpdate` receives each group of rows' resulting lists by default, or one `{ [field]: { add, remove } }` patch with `tags: { bulk: "patch" }`, applied on the server with `applyTagPatch()`.
- **"Manage tags"** in the column menu: rename, recolor from a palette (`TAG_COLOR_NAMES`; hosts may store any CSS color), merge into another tag, delete with the number of records using the tag (one `aggregate` call grouped by the column). `table.canManageTags: false` or `tags: { manage: false }` hide it.
- Tag colors: `tagAppearance()` takes a tag's own color (a palette name or a CSS color) over `tagColorMap` and the automatic hue; filter menus show tag swatches.
- Facets: a tags column in `table.facets` lists the catalog's tag names, each counted once per record, and a click filters with `contains`. The Assets demo adds a Tags facet.
- The shared, server-safe `tag-catalog.ts` (synced to Vue) holds the contract types and helpers (`resolveTagColumn`, `tagColumnsOf`, `normalizeTagList`, `tagOptions`, `applyTagPatch`, `isTagPatch`, `mergeTagValue`, `removeTagValue`, `tagUsageRequest`, `tagUsageCounts`, `tagLabels`), exported by both editions. EN/FR labels, overridable with `tags.<key>` translations.
- Vue editable cells no longer open the record view on a single click, as in React: double-click or Enter edits them.
- The React item's `useBulkActions().completeBulkEdit` takes the targets whose rows it deselects (optional).
- File tree: when the host ignores the tree's scopes, the tree built in the browser no longer stays on "Loading…" if new page rows arrive during its first load (React and Vue share the fix).
