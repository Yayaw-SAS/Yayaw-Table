---
"yayaw-table-workspace": minor
---

Render the Gantt timeline with a native component in each edition, so it reaches its table the way
Kanban and Gallery do: the table's own selection and title cells in the left column, row click through
to the record details, the loading overlay and the bulk-actions anchor. React gains
`components/gantt-view.tsx` and Vue `components/planning/GanttView.vue`, both computing rows,
virtualization geometry, bar placement, dependency paths, header cells and every date edit from a new
shared `planning/timeline` model. The shared DOM renderer keeps only the planning dialog, which needs
no table state. A task from another source, or one outside the table's current page, still renders
without cells rather than disappearing.
