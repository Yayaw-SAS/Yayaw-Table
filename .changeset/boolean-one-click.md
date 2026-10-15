---
"yayaw-table-workspace": patch
---

An editable boolean cell now toggles on its first click, in React and Vue. The click used to open the editor without changing the value, so a second click was needed; the new value is saved as any inline edit (React keeps the switch open with its autosave delay, Vue saves at once as its checkbox does).
