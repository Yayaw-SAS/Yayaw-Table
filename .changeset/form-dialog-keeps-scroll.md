---
"yayaw-table-workspace": patch
---

Vue: a record form in a drawer or modal no longer jumps back to its top when a select opens in it, and the select can be used. The dialog appended its form again on each render, which detached it and reset its scroll; it is now attached once. React keeps the form in its dialog and was not affected.
