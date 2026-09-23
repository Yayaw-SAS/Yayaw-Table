---
"yayaw-table-workspace": minor
---

Add a per-view manual order in React and Vue. With `table.manualOrder: true` and an `actions.reorder` handler, the sort menu offers "Manual order", saved with the view like any sort. List requests then carry the `__manual` sort and the active `viewId` (`null` for the default view), so the host applies that view's own order. In the List view, lines can be moved by dragging or with Alt+Arrow keys, within their group; each move calls `reorder({ viewId, id, previousId, nextId })` and never edits the records.
