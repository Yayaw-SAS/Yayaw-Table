---
"yayaw-table-workspace": minor
---

Add `table.kanban.dragFromCard` (default `false`) to React and Vue. With `allowDragUpdate`, a mouse or touch press anywhere on a Kanban card starts a drag, not only on its grip handle; a short click or tap still opens the record, and checkboxes, links and menus inside the card keep their own behavior. React keeps keyboard dragging on the handle; Vue keeps its move buttons.

Vue Kanban cards now show a grip handle and, by default, drag only from it, like React. Set `dragFromCard: true` to restore the previous whole-card drag.
