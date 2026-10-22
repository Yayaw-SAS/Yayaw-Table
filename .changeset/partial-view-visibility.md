---
"yayaw-table-workspace": patch
---

Vue: applying a saved view whose `columnVisibility` does not mention a column now keeps that column's default visibility (`columns.visible`), as React already did. A view saved before a column existed, or listing only some columns, no longer shows columns hidden by default, such as filter-only columns that cannot be hidden from the columns menu.
