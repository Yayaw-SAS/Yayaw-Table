---
"yayaw-table-workspace": patch
---

Quick filters in the filter bar now search a column's `optionsLoader` on the
server, as the filter menu does: they honour `optionsSearchMinLength` and
`optionsSearchDebounceMs`, request nothing while closed, show the loading,
error and minimum-length states, and keep the labels of selected choices.
Before, such a filter only listed its static options and showed "No results".
