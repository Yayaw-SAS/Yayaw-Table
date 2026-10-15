---
"yayaw-table-workspace": minor
---

Footer calculations now follow the selection, in React and Vue: while rows are selected, each footer shows its calculation over the selected rows, labelled with their number ("Sum · Selection (2)"), per currency as before. The result's tooltip gives the other scopes: the page shown when the matching rows span several pages, and every matching row under a selection. New translation keys: `calculations.selection`, `calculations.page` and `calculations.all` (React `calcSelection`, `calcPage`, `calcAllRows`).
