---
"yayaw-table-workspace": minor
---

Let a Gantt work from the table's own data like Kanban and Gallery. `createRowsPlanningAdapter`
derives the planning graph from the existing `list` action and saves date and hierarchy edits through
the existing `update` action, and React and Vue wire it automatically when `gantt.startColumn` and
`gantt.endColumn` are mapped and no `actions.planning` adapter is supplied. Add `gantt.parentColumn`
and `gantt.calendarColumn`, share one preview/apply transaction core between adapters, route every
timeline, dialog and settings label through `views.gantt.*` with the built-in vocabulary as fallback,
replace the planning row controls with design-system buttons and translated names, and withhold the
Gantt display mode when no planning graph can be built.
