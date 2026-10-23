---
"yayaw-table-workspace": minor
---

Inline editing: `select` and `multiSelect` form fields with `searchOptions` now edit in the cell, in React and Vue. The editor searches the server as you type (`searchMinLength`, `searchDebounceMs`), keeps the labels of searched choices, labels missing values with `resolveOptions`, and shows search failures in its list. Other field types with `searchOptions` still open the full form.
