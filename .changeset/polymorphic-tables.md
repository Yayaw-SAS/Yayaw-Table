---
"yayaw-table-workspace": minor
---

Add first-class polymorphic table support by separating table ids, table config types, and form config types. Form configs now receive row/value context for dynamic fields, edit forms can resolve their form type per row, toolbar actions receive selected-row context, and standard row actions support row-aware guards.
