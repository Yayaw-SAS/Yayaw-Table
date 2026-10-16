---
"yayaw-table-workspace": minor
---

The filter menu now works like Notion's, in React and Vue. A **Filter** button in the toolbar adds a rule from a searchable list of columns; each rule shows as a chip under the toolbar with its own editor (operators by column type, then the value), and an advanced filter combines rules with And / Or. Date rules offer relative periods (today, this week, last 30 days…), rolling periods such as `$last2Weeks` or `$next3Months`, an exact day or a range. `table.toolbarDateFilter: "<dateColumn>"` keeps one date column's period in the toolbar, with the days it covers today ("This month · Oct 1 – Oct 31"). Typed text and numbers filter once typing pauses, on Enter or on leaving the field. Incomplete rules stay as chips but never reach the query or a saved view. New translation keys live under `filters.menu.*` and `filters.menu.operators.*`. Vue's `AdvancedFilters` and `FilterRule` components are replaced by the new menu.
