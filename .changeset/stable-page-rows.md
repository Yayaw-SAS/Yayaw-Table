---
"yayaw-table-workspace": patch
---

React display modes keep the same page rows until the data changes, as in Vue.

- **No reload without new data** (React): the page rows the table hands display modes (`context.rows`) were a new array at many renders: every render while no page was loaded, and every time the column order (`<tableId>-order`) was written or read again, which the table does itself after mounting. Each new array moved `context.revision`, so the File tree, Feed, Calendar, Chart and Map loaded their records again (the File tree: one list call per loaded folder, or every row when the host ignores scopes). The rows are now the page the query returned, the same array until the data changes.
- **Row order** (React): the table sorted the page rows by `<tableId>-order`, which holds column ids, so a row whose id equals a column id moved to the top. Rows keep the order `list` returns, as in Vue; a manual row order stays a sort (`__manual`).
- The `getRowId` option of `useTableUrlData` (React) is deprecated and ignored: rows are no longer sorted.
