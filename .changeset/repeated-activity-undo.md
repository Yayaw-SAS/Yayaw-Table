---
"yayaw-table-workspace": minor
---

Record activity undo and redo (React and Vue):
- a newer change that was undone since no longer blocks undoing an older change of the same fields, so repeated Ctrl/Cmd+Z walks a field back one change at a time;
- Ctrl/Cmd+Shift+Z and Ctrl+Y redo the newest undo through the new opt-in `onRedoActivity(row, undoEvent)` handler. A redo appends an event with `redoes: undoEvent.id` (new optional `DetailActivity.redoes`); new labels `redoSuccess`, `redoError` and `redoUnavailable`.
