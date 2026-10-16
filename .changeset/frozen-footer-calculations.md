---
"yayaw-table-workspace": minor
---

Footer calculations are read-only until the viewer turns on the new View settings switch "Edit calculations" (not saved, off on each visit), which replaces the "Footer calculations" shown/hidden toggle: off, the footer shows each column's calculation as plain text and no "Calculate" button. Developers can freeze calculations with `lockCalculation` on a column or `table.lockCalculations` for every column. New translation keys: React `menu.edit_calculations`, `menu.edit_calculations_on`, `menu.edit_calculations_off`; Vue `editCalculations`, `editCalculationsOn`, `editCalculationsOff`. React and Vue.
