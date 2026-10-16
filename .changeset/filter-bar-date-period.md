---
"yayaw-table-workspace": minor
---

A `date` column listed in `table.filterBarColumns` now gets a period filter in the filter bar, in React and Vue: any date, the relative choices of date rules (this month, last 30 days…), or days from / to. The period is kept as one advanced filter rule, so it also filters charts, calendars and the other display modes that have no column headers, and hosts receive it as any date rule.
