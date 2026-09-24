---
"yayaw-table-workspace": patch
---

React/Vue parity fixes for grouping and Gantt titles:

- Table grouping by a date column now always groups by calendar month, headed with the month's name, in both editions — also when the column has an `accessorKey` or `accessorFn` (React grouped those by exact value, Vue always did).
- Kanban lanes, Gallery sections and List sections head records without a value "No value" ("Aucune valeur" in French) in both editions; Vue Kanban and Gallery showed "Unassigned", and a Vue Kanban card moved to that lane now writes `""` like React instead of the string "Unassigned".
- Without `gantt.titleColumn`, the Vue Gantt titles tasks with the first visible data column, like React, instead of the first column definition.
