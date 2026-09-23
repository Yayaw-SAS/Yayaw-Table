---
"yayaw-table-workspace": minor
---

Add `loadScopedRows` to React and Vue for views that need every row of a window rather than one page. List actions may receive an optional `scope` (for example `{ kind: "dateRange", field, endField?, from, to }`) and answer `meta.scope: "applied"` when they filtered by it; otherwise rows are filtered locally. Results are capped and report truncation.
