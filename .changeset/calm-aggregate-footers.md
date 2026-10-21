---
"yayaw-table-workspace": patch
---

Footer calculations no longer load every matching row page by page when `actions.aggregate` fails or answers nothing, in React and Vue: the footers stay empty instead. The list fallback still serves tables without an aggregate action.
