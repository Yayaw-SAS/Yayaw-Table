---
"yayaw-table-workspace": minor
---

Add `table.bulkActionsPosition: "bottom" | "top"` (default `"bottom"`) and `table.bulkActionsTopOffset` (px, default 24) in React and Vue. With `"top"`, the multi-selection action bar is pinned to the top of the screen instead of under the table or at the bottom of the screen, for short screens where the bottom bar gets cut off; the offset clears a fixed application header.
