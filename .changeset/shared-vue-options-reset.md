---
"yayaw-table-workspace": patch
---

Make the Vue toolbar reset shortcut invoke the same handler as the Options menu
reset. Both clear column and advanced filters, restore configured default sorting
and column visibility, and remove grouping. They preserve search and unrelated
presentation state, and use the same `reset` translation for their label and tooltip.
