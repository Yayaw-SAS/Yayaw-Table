---
"yayaw-table-workspace": patch
---

An editable boolean cell now toggles on its first click, in React and Vue. The click used to open the editor without changing the value, so a second click was needed; the new value is saved as any inline edit (React keeps the switch open with its autosave delay, Vue saves at once as its checkbox does).

In Vue, the click that opens a cell editor no longer reaches the row: with `rowClickMode: "activate"`, clicking a boolean mark used to open the record over the editor, because the editor replaced the clicked mark before the row's guard saw it.
